// Compone con Eleven Music las cortinas del audio dramatizado a pedido (api/dramatizado.ts): para cada tono, una
// entrada, un paso entre escenas y un cierre, instrumentales y sin voces, en public/audio/cortinas/. Solo compone las
// que faltan: para rehacer una, se borra su MP3 y se vuelve a correr. Necesita ELEVENLABS_API_KEY.
//   node pipeline/audio_dramatizado/cortinas.mjs [tono ...]
// Costo: unos 900 créditos por minuto de música; las 15 cortinas suman unos 2 minutos.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const KEY = process.env.ELEVENLABS_API_KEY;
const URL_BASE = process.env.ELEVENLABS_BASE_URL ?? 'https://api.elevenlabs.io';
const DIR = path.join(process.cwd(), 'public', 'audio', 'cortinas');
const MODELOS = (process.env.MUSICA_MODELOS ?? 'music_v2,music_v1').split(',');

// El color de cada tono. Todas instrumentales: suenan junto al narrador y no deben distraer del texto.
const TONOS = {
  paz: 'gentle, warm and peaceful underscore for a Bible audio drama, soft sustained strings, ney flute, light oud plucks, pastoral, calm',
  esperanza: 'hopeful, tender cinematic theme for a Bible audio drama, warm strings, soft solo piano, gentle ney flute, a slow uplifting swell',
  tension: 'tense, suspenseful cinematic underscore for a Bible audio drama, low string ostinato, deep frame drum pulses, dark drone, ancient Middle Eastern colour, restrained',
  duelo: 'sorrowful, mournful lament for a Bible audio drama, solo duduk over low sustained strings, slow, grieving, intimate',
  gloria: 'majestic, awe-filled cinematic cue for a Bible audio drama, warm full orchestra swell, soft brass, timpani roll, shimmering strings, reverent',
};
// Cada momento: cuánto dura y cómo empieza y termina.
const MOMENTOS = {
  entrada: { ms: 9000, forma: 'opening cue: begins softly, grows a little and resolves gently at the end so a narrator can start speaking' },
  paso: { ms: 4500, forma: 'very short transition sting between two scenes, a single gentle phrase that ends cleanly' },
  cierre: { ms: 11000, forma: 'closing cue with a final, peaceful resolution, fading out completely at the end' },
};
const COMUN = 'instrumental only, no vocals, no choir words, no modern drums, no electronic sounds, high quality orchestral recording';

async function componer(prompt, ms) {
  let ultimo = '';
  for (const model_id of MODELOS) {
    const res = await fetch(`${URL_BASE}/v1/music?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, music_length_ms: ms, model_id, force_instrumental: true }),
    });
    if (res.ok) return { mp3: new Uint8Array(await res.arrayBuffer()), model_id };
    ultimo = `${model_id} ${res.status}: ${(await res.text()).slice(0, 300)}`;
    if (![400, 404, 422].includes(res.status)) break;
  }
  throw new Error(ultimo);
}

if (!KEY) {
  console.error('Falta ELEVENLABS_API_KEY');
  process.exit(1);
}
await mkdir(DIR, { recursive: true });
const pedidos = process.argv.slice(2).filter((t) => t in TONOS);
const tonos = pedidos.length ? pedidos : Object.keys(TONOS);
let hechas = 0;
let fallos = 0;
for (const tono of tonos) {
  for (const [momento, { ms, forma }] of Object.entries(MOMENTOS)) {
    const file = path.join(DIR, `${tono}-${momento}.mp3`);
    if (existsSync(file)) continue;
    const prompt = `${TONOS[tono]}. ${forma}. ${COMUN}.`;
    try {
      const { mp3, model_id } = await componer(prompt, ms);
      await writeFile(file, mp3);
      hechas++;
      console.log(`✓ ${tono}-${momento} (${model_id}, ${(mp3.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      fallos++;
      console.error(`✗ ${tono}-${momento}: ${err.message}`);
    }
  }
}
console.log(`${hechas} cortinas nuevas, ${fallos} fallos.`);
if (fallos && !hechas) process.exit(1);
