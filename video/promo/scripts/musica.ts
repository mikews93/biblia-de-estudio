/**
 * Música del video: una pieza instrumental compuesta para el corte con Eleven Music (como el demo de
 * DeusRex). Se paga: la acción «Video promocional» solo la pide si public/music/zarza-promo.mp3 no existe
 * en la versión de GitHub. Si la cuenta no tiene Eleven Music, el video usa el pad de piano de la app
 * (public/audio/ambiente/piano.mp3, sintetizado por pipeline/ambiente/pads.py, sin licencias).
 *
 *   ELEVENLABS_API_KEY=… bun scripts/musica.ts
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const ROOT = join(import.meta.dir, '..');
const SECONDS = 47;
const prompt = [
  `Instrumental cinematic underscore for a ${SECONDS}-second promo of a Bible study app. No vocals.`,
  'Opens with a single soft felt piano over a warm, dark ambient pad (intimate, reverent).',
  'Around 11 s, gentle sustained strings join. Around 25 s, a light, steady pulse enters (soft low drum, no hi-hats).',
  'Builds with hope to a warm, full swell at 39 s, then resolves on one sustained major chord that rings out by 46 s.',
  'Modern ambient worship feel, not churchy, not epic trailer. Leaves room for a calm male narrator.',
].join(' ');

const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error('Falta ELEVENLABS_API_KEY');
const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192', {
  method: 'POST',
  headers: {'xi-api-key': key, 'Content-Type': 'application/json'},
  body: JSON.stringify({prompt, music_length_ms: SECONDS * 1000, model_id: 'music_v1', force_instrumental: true}),
});
if (!res.ok) throw new Error(`Eleven Music ${res.status} ${(await res.text()).slice(0, 300)}`);
mkdirSync(join(ROOT, 'public/music'), {recursive: true});
writeFileSync(join(ROOT, 'public/music/zarza-promo.mp3'), Buffer.from(await res.arrayBuffer()));
console.log('public/music/zarza-promo.mp3 listo');
