// Cuenta las voces en español bien calificadas que hay en la biblioteca de ElevenLabs para cada género y edad, con
// los mismos criterios que usa api/dramatizado.ts al escoger voces sobre la marcha (profesional o de alta calidad,
// clonada por al menos DRAMA_VOZ_MIN_CLONES personas y con muestra). Solo lee la biblioteca: no gasta créditos.
// Escribe pipeline/audio_dramatizado/voces-catalogo.json con el recuento y las mejores de cada grupo.
//   node pipeline/audio_dramatizado/voces-catalogo.mjs
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const KEY = process.env.ELEVENLABS_API_KEY;
const URL_BASE = process.env.ELEVENLABS_BASE_URL ?? 'https://api.elevenlabs.io';
const SALIDA = path.join(process.cwd(), 'pipeline', 'audio_dramatizado', 'voces-catalogo.json');
const MIN_CLONES = Number(process.env.DRAMA_VOZ_MIN_CLONES) || 200;
const PAGINAS = 10;
const DESCARTADA = /\b(god|dios|jesus|jes[uú]s|cartoon|villain|robot|asmr|sexy|news|commercial)\b/i;

const buena = (v) =>
  !!v.preview_url && (v.category === 'professional' || v.category === 'high_quality') && (v.cloned_by_count ?? 0) >= MIN_CLONES &&
  !DESCARTADA.test(`${v.name ?? ''} ${v.description ?? ''}`);

async function pagina(params, page) {
  const q = new URLSearchParams({ page_size: '100', language: 'es', sort: 'usage_character_count_1y', page: String(page), ...params });
  const res = await fetch(`${URL_BASE}/v1/shared-voices?${q}`, { headers: { 'xi-api-key': KEY } });
  if (!res.ok) throw new Error(`shared-voices ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

const grupos = [];
for (const gender of ['male', 'female']) {
  for (const age of ['young', 'middle_aged', 'old']) {
    const todas = [];
    for (let p = 0; p < PAGINAS; p++) {
      const body = await pagina({ gender, age }, p);
      todas.push(...(body.voices ?? []));
      if (!body.has_more) break;
    }
    const buenas = todas.filter(buena);
    const latinas = buenas.filter((v) => /latin/i.test(v.accent ?? ''));
    grupos.push({
      genero: gender === 'male' ? 'hombre' : 'mujer',
      edad: { young: 'joven', middle_aged: 'adulto', old: 'mayor' }[age],
      revisadas: todas.length,
      bienCalificadas: buenas.length,
      latinoamericanas: latinas.length,
      mejores: buenas
        .sort((a, b) => (b.cloned_by_count ?? 0) - (a.cloned_by_count ?? 0))
        .slice(0, 15)
        .map((v) => ({ id: v.voice_id, nombre: v.name, acento: v.accent, clonada: v.cloned_by_count, descripcion: (v.description ?? '').slice(0, 160), muestra: v.preview_url })),
    });
    console.log(`${gender}/${age}: ${buenas.length} bien calificadas de ${todas.length} (${latinas.length} latinoamericanas)`);
  }
}
await writeFile(SALIDA, JSON.stringify({ minClones: MIN_CLONES, grupos }, null, 2) + '\n');
