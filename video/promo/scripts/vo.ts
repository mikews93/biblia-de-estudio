/**
 * Voz del video promocional: Abel (voz de la biblioteca de ElevenLabs 452WrNT9o8dphaYW5YGU, la del
 * narrador del audio dramatizado) en eleven_v4, con `with-timestamps` para tener la alineación real de
 * cada letra. Copiado del demo de DeusRex (video/demo/scripts/vo.ts).
 *
 *   bun scripts/vo.ts            # graba las frases nuevas o cambiadas (se paga) y escribe la sincronía
 *   bun scripts/vo.ts --timing   # gratis: rehace src/vo-timing.json con las alineaciones guardadas
 *
 * Desde el contenedor api.elevenlabs.io está bloqueado: lo corre la acción «Video promocional»
 * (.github/workflows/video-promo.yml) con el secreto ELEVENLABS_API_KEY. La clave se lee del entorno y
 * nunca se imprime. Cada frase queda en caché por el SHA1 de voz + modelo + texto (public/vo/manifest.json),
 * así que solo se paga lo que cambió.
 */
import {appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

const ROOT = join(import.meta.dir, '..');
const VO = join(ROOT, 'public/vo');
type Line = {id: string; at: number; text: string};
const script = JSON.parse(readFileSync(join(ROOT, 'script.json'), 'utf8')) as {voice: {voiceId: string; model: string}; lines: Line[]};
const {voiceId, model} = script.voice;
const manifestPath = join(VO, 'manifest.json');
const manifest: Record<string, string> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const sha = (t: string) => createHash('sha1').update(`${voiceId}|${model}|${t}`).digest('hex');
/** The spoken text: delivery tags removed. */
export const stripTags = (t: string) => t.replace(/\[[^\]]*\]\s*/g, '').trim();

type Alignment = {characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[]};

const apiKey = () => {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error('Falta ELEVENLABS_API_KEY en el entorno');
  return k.trim();
};

const synthesize = async (i: number, key: string) => {
  const line = script.lines[i];
  const body = {
    text: line.text,
    model_id: model,
    language_code: 'es',
    previous_text: script.lines.slice(0, i).map((l) => stripTags(l.text)).join(' ').slice(-400) || undefined,
    next_text: script.lines[i + 1] ? stripTags(script.lines[i + 1].text) : undefined,
  };
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {'xi-api-key': key, 'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${line.id}: ElevenLabs ${res.status} ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as {audio_base64: string; alignment: Alignment; normalized_alignment?: Alignment};
  writeFileSync(join(VO, `${line.id}.mp3`), Buffer.from(j.audio_base64, 'base64'));
  writeFileSync(join(VO, `${line.id}.align.json`), JSON.stringify(j.normalized_alignment ?? j.alignment));
  return line.text.length;
};

const duration = (file: string) => {
  const p = Bun.spawnSync(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return Number(p.stdout.toString().trim());
};

type Word = {w: string; start: number; end: number};
/**
 * Words from the per-character alignment: tags (and the space after them) are
 * dropped, a word runs from its first character's start to its last LETTER's
 * end — trailing punctuation («…», «.») is read as silence, not as the word.
 */
const wordsOf = (a: Alignment): Word[] => {
  const words: Word[] = [];
  let tag = false;
  let afterTag = false;
  let cur: {chars: string[]; start: number; end: number} | null = null;
  const flush = () => {
    if (cur) words.push({w: cur.chars.join(''), start: +cur.start.toFixed(3), end: +cur.end.toFixed(3)});
    cur = null;
  };
  a.characters.forEach((ch, i) => {
    if (ch === '[') tag = true;
    if (tag) {
      if (ch === ']') {
        tag = false;
        afterTag = true;
      }
      return;
    }
    if (/\s/.test(ch)) {
      if (!afterTag) flush();
      afterTag = false;
      return;
    }
    afterTag = false;
    const s = a.character_start_times_seconds[i];
    const e = a.character_end_times_seconds[i];
    if (!cur) cur = {chars: [], start: s, end: e};
    cur.chars.push(ch);
    if (/[\p{L}\p{N}]/u.test(ch)) cur.end = e;
  });
  flush();
  return words;
};

const timing = (line: Line) => {
  const file = join(VO, `${line.id}.mp3`);
  const alignFile = join(VO, `${line.id}.align.json`);
  if (!existsSync(file) || !existsSync(alignFile)) throw new Error(`missing ${line.id}.mp3/.align.json — run without --timing (paid)`);
  const words = wordsOf(JSON.parse(readFileSync(alignFile, 'utf8')) as Alignment);
  const spoken = stripTags(line.text);
  if (words.map((w) => w.w).join(' ') !== spoken) throw new Error(`${line.id}: alignment does not match script.json («${words.map((w) => w.w).join(' ')}»)`);
  return {
    duration: +duration(file).toFixed(3),
    speechStart: words[0].start,
    speechEnd: words[words.length - 1].end,
    method: 'elevenlabs alignment (with-timestamps, per character)',
    words,
  };
};

if (import.meta.main) {
  mkdirSync(VO, {recursive: true});
  if (!process.argv.includes('--timing')) {
    const todo = script.lines.map((l, i) => i).filter((i) => {
      const l = script.lines[i];
      return !(existsSync(join(VO, `${l.id}.mp3`)) && existsSync(join(VO, `${l.id}.align.json`)) && manifest[l.id] === sha(l.text));
    });
    if (todo.length) {
      const key = apiKey();
      for (const i of todo) {
        const l = script.lines[i];
        const characters = await synthesize(i, key);
        manifest[l.id] = sha(l.text);
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        appendFileSync(join(ROOT, 'scripts/vo.log.jsonl'), JSON.stringify({at: new Date().toISOString(), id: l.id, provider: 'elevenlabs', voice: voiceId, model, characters}) + '\n');
        console.log(`synth ${l.id}: ${characters} chars`);
      }
    }
  }
  const result: Record<string, ReturnType<typeof timing>> = {};
  for (const line of script.lines) {
    result[line.id] = timing(line);
    const t = result[line.id];
    console.log(`${line.id.padEnd(9)} ${t.duration.toFixed(2)} s  speech ${t.speechStart}–${t.speechEnd}  ${t.words.length} words`);
  }
  writeFileSync(join(ROOT, 'src/vo-timing.json'), JSON.stringify(result, null, 1) + '\n');
}
