// Busca en la biblioteca de voces de ElevenLabs voces en español de hombres y mujeres mayores, para que el
// dramatizado tenga ancianos que suenen a ancianos (Zacarías, Elisabet, Simeón, Ana…). Solo lee la biblioteca: no
// graba nada ni gasta créditos. Escribe pipeline/audio_dramatizado/voces-mayores.json con el nombre, la descripción,
// el acento y la muestra de cada voz, para escucharlas y elegir. Necesita ELEVENLABS_API_KEY.
//   node pipeline/audio_dramatizado/voces-mayores.mjs
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const KEY = process.env.ELEVENLABS_API_KEY;
const URL_BASE = process.env.ELEVENLABS_BASE_URL ?? 'https://api.elevenlabs.io';
const SALIDA = path.join(process.cwd(), 'pipeline', 'audio_dramatizado', 'voces-mayores.json');
const POR_GENERO = 12;

async function buscar(params) {
  const q = new URLSearchParams({ page_size: '100', language: 'es', sort: 'usage_character_count_1y', ...params });
  const res = await fetch(`${URL_BASE}/v1/shared-voices?${q}`, { headers: { 'xi-api-key': KEY } });
  if (!res.ok) throw new Error(`shared-voices ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).voices ?? [];
}

const voces = [];
for (const gender of ['male', 'female']) {
  const vistas = new Set();
  const lista = [];
  // Primero las marcadas como mayores; si no alcanzan, las de mediana edad que se describen como viejas o graves.
  for (const params of [{ gender, age: 'old' }, { gender, age: 'middle_aged', search: gender === 'male' ? 'old' : 'old' }]) {
    for (const v of await buscar(params)) {
      if (vistas.has(v.voice_id) || !v.preview_url) continue;
      vistas.add(v.voice_id);
      lista.push(v);
    }
    if (lista.length >= POR_GENERO) break;
  }
  for (const v of lista.slice(0, POR_GENERO)) {
    voces.push({
      id: v.voice_id,
      dueño: v.public_owner_id,
      nombre: v.name,
      genero: gender === 'male' ? 'hombre' : 'mujer',
      edad: v.age,
      acento: v.accent,
      idioma: v.language,
      descripcion: (v.description ?? '').slice(0, 300),
      uso: v.usage_character_count_1y ?? 0,
      muestra: v.preview_url,
    });
  }
  console.log(`${gender}: ${lista.length} voces`);
}
await writeFile(SALIDA, JSON.stringify(voces, null, 2) + '\n');
console.log(`${voces.length} voces en ${SALIDA}`);
