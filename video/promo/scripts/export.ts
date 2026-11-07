/**
 * Los entregables (como el demo de DeusRex): renderiza los dos cortes, nivela la mezcla a −16 LUFS
 * (loudnorm de ffmpeg en dos pasadas, lineal = una ganancia simple), codifica para la web, escribe los
 * subtítulos en español (WebVTT, para YouTube) y una portada. Todo queda en out/release/ (fuera de git).
 *
 *   bun scripts/export.ts              # todo
 *   bun scripts/export.ts --no-render  # vuelve a codificar out/*.mp4 y los subtítulos
 *
 * Necesita public/vo/ y public/music/ (la acción «Video promocional» los sube a la versión de GitHub
 * «video-promo»; ver README) y public/capturas/ (scripts/capturas.mjs).
 */
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const ROOT = join(import.meta.dir, '..');
const OUT = join(ROOT, 'out');
const REL = join(OUT, 'release');
mkdirSync(REL, {recursive: true});

const run = (cmd: string[], quiet = false) => {
  const p = Bun.spawnSync(cmd, {cwd: ROOT, stdout: quiet ? 'pipe' : 'inherit', stderr: 'pipe'});
  const err = p.stderr.toString();
  if (p.exitCode !== 0) throw new Error(`${cmd.slice(0, 3).join(' ')} falló:\n${err.slice(-2000)}`);
  return err;
};

const CUTS = [
  {id: 'Promo16x9', master: 'promo.mp4', out: 'zarza-promo-1080p.mp4'},
  {id: 'Reel9x16', master: 'reel.mp4', out: 'zarza-reel-9x16.mp4'},
];
if (!process.argv.includes('--no-render')) {
  for (const c of CUTS) {
    console.log(`render ${c.id}`);
    run(['bunx', 'remotion', 'render', 'src/index.ts', c.id, `out/${c.master}`, '--log=error', '--audio-bitrate=320k', '--concurrency=4']);
  }
}

const TARGET = {I: -16, TP: -1.5, LRA: 11};
type Loud = {input_i: string; input_tp: string; input_lra: string; input_thresh: string; target_offset: string};
const lastJson = (s: string) => JSON.parse(s.slice(s.lastIndexOf('{'), s.lastIndexOf('}') + 1)) as Loud;
const measure = (file: string) => lastJson(run(['ffmpeg', '-hide_banner', '-i', file, '-af', `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:print_format=json`, '-vn', '-f', 'null', '-'], true));
const VIDEO = ['-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-g', '30', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'];
const AUDIO = ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000'];
for (const c of CUTS) {
  const m = measure(join(OUT, c.master));
  const af = `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  console.log(`encode ${c.out} (entra a ${m.input_i} LUFS)`);
  run(['ffmpeg', '-y', '-hide_banner', '-i', join(OUT, c.master), ...VIDEO, '-af', af, ...AUDIO, '-movflags', '+faststart', join(REL, c.out)], true);
}

// Portada: el cierre con la llama y el nombre.
run(['bunx', 'remotion', 'still', 'src/index.ts', 'Promo16x9', join(REL, 'zarza-promo-portada.jpg'), '--frame=1330', '--jpeg-quality=92', '--log=error']);

// Subtítulos: cada frase en trozos de hasta 7 palabras, con los tiempos reales de ElevenLabs.
type Word = {w: string; start: number; end: number};
const timing = JSON.parse(readFileSync(join(ROOT, 'src/vo-timing.json'), 'utf8')) as Record<string, {words: Word[]}>;
const script = JSON.parse(readFileSync(join(ROOT, 'script.json'), 'utf8')) as {lines: {id: string; at: number}[]};
const cues: {start: number; end: number; text: string}[] = [];
for (const {id, at} of script.lines) {
  const base = Math.round(at * 30) / 30;
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) cues.push({start: base + cur[0].start, end: base + cur[cur.length - 1].end + 0.3, text: cur.map((w) => w.w).join(' ')});
    cur = [];
  };
  for (const w of timing[id].words) {
    cur.push(w);
    if (cur.length >= 7 || /[.…:]$/.test(w.w)) flush();
  }
  flush();
}
cues.forEach((c, k) => (c.end = Math.min(Math.max(c.end, c.start + 1.2), (cues[k + 1]?.start ?? Infinity) - 0.04)));
const ts = (s: number) => {
  const ms = Math.round(s * 1000);
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor((ms % 3600000) / 60000))}:${p(Math.floor((ms % 60000) / 1000))}.${p(ms % 1000, 3)}`;
};
writeFileSync(join(REL, 'zarza-promo.es.vtt'), `WEBVTT\n\n${cues.map((c, k) => `${k + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}`).join('\n\n')}\n`);

for (const f of [...CUTS.map((c) => c.out), 'zarza-promo-portada.jpg', 'zarza-promo.es.vtt']) {
  const p = join(REL, f);
  if (existsSync(p)) console.log(`${f.padEnd(26)} ${(statSync(p).size / 1e6).toFixed(2).padStart(6)} MB`);
}
process.exit(0);
