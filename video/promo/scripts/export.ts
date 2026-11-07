/**
 * The release set (#804): renders the three compositions, normalises the mix
 * to −16 LUFS integrated (two-pass ffmpeg loudnorm, linear = a plain gain),
 * encodes for the web, writes the WebVTT subtitles and a contact sheet per
 * social cut. Everything lands in out/release/ (gitignored). Free: no API calls.
 *
 *   bun scripts/export.ts            # everything
 *   bun scripts/export.ts --no-render  # re-encode existing out/*.mp4 + subtitles only
 *
 * Needs public/vo/ (scripts/vo.ts) and the bed, public/music/eleven-music-b.mp3
 * (Eleven Music, kept out of git like the voice) — without the voice the cuts
 * render with the bed alone.
 */
import {copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {MUSIC} from '../src/audio';
import {FILM_VO} from '../src/film/Film';

const ROOT = join(import.meta.dir, '..');
const OUT = join(ROOT, 'out');
const REL = join(OUT, 'release');
mkdirSync(REL, {recursive: true});
if (!existsSync(join(ROOT, 'public', MUSIC))) throw new Error(`missing public/${MUSIC} — the Eleven Music bed (see README)`);

const run = (cmd: string[], quiet = false) => {
  const p = Bun.spawnSync(cmd, {cwd: ROOT, stdout: quiet ? 'pipe' : 'inherit', stderr: 'pipe'});
  const err = p.stderr.toString();
  if (p.exitCode !== 0) throw new Error(`${cmd.slice(0, 3).join(' ')} failed:\n${err.slice(-2000)}`);
  return err;
};

/* ── 1. render ─────────────────────────────────────────────────────────── */
const CUTS = [
  {id: 'Landing16x9', master: 'film.mp4'},
  {id: 'Reel9x16', master: 'reel.mp4'},
  {id: 'Square1x1', master: 'square.mp4'},
];
if (!process.argv.includes('--no-render')) {
  for (const c of CUTS) {
    console.log(`render ${c.id}`);
    run(['bunx', 'remotion', 'render', 'src/index.ts', c.id, `out/${c.master}`, '--log=error', '--audio-bitrate=320k']);
  }
}

/* ── 2. loudness + encode ──────────────────────────────────────────────── */
const TARGET = {I: -16, TP: -1.5, LRA: 11};
type Loud = {input_i: string; input_tp: string; input_lra: string; input_thresh: string; target_offset: string; output_i?: string; output_tp?: string};
const lastJson = (s: string) => JSON.parse(s.slice(s.lastIndexOf('{'), s.lastIndexOf('}') + 1)) as Loud;
const measure = (file: string) => lastJson(run(['ffmpeg', '-hide_banner', '-i', file, '-af', `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:print_format=json`, '-vn', '-f', 'null', '-'], true));

const VIDEO = ['-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-g', '30', '-keyint_min', '30', '-sc_threshold', '0', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
const AUDIO = ['-c:a', 'aac', '-b:a', '160k', '-ar', '48000'];

const loudness: Record<string, {before: Loud; after: Loud}> = {};
const encode = (master: string, out: string, scale?: string) => {
  const m = measure(join(OUT, master));
  const af = `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const vf = [scale ? `scale=${scale}:flags=lanczos` : '', 'format=yuv420p'].filter(Boolean).join(',');
  console.log(`encode ${out}  (in ${m.input_i} LUFS, TP ${m.input_tp})`);
  run(['ffmpeg', '-y', '-hide_banner', '-i', join(OUT, master), '-vf', vf, ...VIDEO, '-level', scale ? '4.0' : '4.1', '-af', af, ...AUDIO, '-movflags', '+faststart', join(REL, out)], true);
  loudness[out] = {before: m, after: measure(join(REL, out))};
};
encode('film.mp4', 'demo-1080p.mp4');
encode('film.mp4', 'demo-720p.mp4', '1280:720');
encode('reel.mp4', 'reel-9x16.mp4');
encode('square.mp4', 'square-1x1.mp4');
copyFileSync(join(REL, 'demo-1080p.mp4'), join(OUT, 'demo.mp4'));
writeFileSync(join(REL, 'loudness.json'), JSON.stringify(loudness, null, 2));

/* ── 3. poster: the tally beside her evening (finale, counters running) ── */
run(['bunx', 'remotion', 'still', 'src/index.ts', 'Landing16x9', join(REL, 'demo-poster.jpg'), '--frame=2400', '--jpeg-quality=92', '--log=error']);

/* ── 4. subtitles ──────────────────────────────────────────────────────── */
type Word = {w: string; start: number; end: number};
const timing = JSON.parse(readFileSync(join(ROOT, 'src/vo-timing.json'), 'utf8')) as Record<string, {words: Word[]}>;
const script = JSON.parse(readFileSync(join(ROOT, 'script.json'), 'utf8')) as {lines: {id: string; text: string}[]};
const spoken = (t: string) => t.replace(/\[[^\]]*\]\s*/g, '').trim();
const subs = JSON.parse(readFileSync(join(ROOT, 'subtitles.json'), 'utf8')) as Record<string, {es: string; en: string; pt: string}[]>;

type VttCue = {start: number; end: number; es: string; en: string; pt: string};
const cues: VttCue[] = [];
for (const {id, at} of FILM_VO) {
  const line = script.lines.find((l) => l.id === id)!;
  const parts = subs[id];
  if (parts.map((p) => p.es).join(' ') !== spoken(line.text)) throw new Error(`subtitles.json «${id}» does not join back to script.json`);
  const words = timing[id].words;
  let i = 0;
  for (const p of parts) {
    const n = p.es.split(/\s+/).length;
    cues.push({start: at / 30 + words[i].start, end: at / 30 + words[i + n - 1].end + 0.3, ...p});
    i += n;
  }
}
// a cue stays up ≥ 1.2 s when there is room, and never overlaps the next one
cues.forEach((c, k) => {
  const next = cues[k + 1]?.start ?? Infinity;
  c.end = Math.min(Math.max(c.end, c.start + 1.2), next - 0.04);
});
const ts = (s: number) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
};
for (const lang of ['es', 'en', 'pt'] as const) {
  const body = cues.map((c, k) => `${k + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c[lang]}`).join('\n\n');
  writeFileSync(join(REL, `demo.${lang}.vtt`), `WEBVTT\n\n${body}\n`);
}

/* ── 5. contact sheets of the social cuts ──────────────────────────────── */
for (const [file, w] of [['reel-9x16.mp4', 270], ['square-1x1.mp4', 360]] as const) {
  const sheet = join(REL, `contact-${file.replace('.mp4', '')}.jpg`);
  run(['ffmpeg', '-y', '-v', 'error', '-i', join(REL, file), '-vf', `fps=1/1.5,scale=${w}:-1,tile=8x3`, '-frames:v', '1', sheet], true);
}

/* ── summary ───────────────────────────────────────────────────────────── */
const probe = (f: string) => Number(Bun.spawnSync(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout.toString());
for (const f of ['demo-1080p.mp4', 'demo-720p.mp4', 'reel-9x16.mp4', 'square-1x1.mp4', 'demo-poster.jpg', 'demo.es.vtt', 'demo.en.vtt', 'demo.pt.vtt']) {
  const p = join(REL, f);
  if (!existsSync(p)) continue;
  const d = f.endsWith('.mp4') ? `${probe(p).toFixed(2)} s` : '';
  const l = loudness[f]?.after;
  console.log(`${f.padEnd(16)} ${(statSync(p).size / 1e6).toFixed(2).padStart(6)} MB  ${d.padEnd(8)} ${l ? `${l.input_i} LUFS, TP ${l.input_tp}` : ''}`);
}
// the compositions' font loaders keep Bun's event loop alive
process.exit(0);
