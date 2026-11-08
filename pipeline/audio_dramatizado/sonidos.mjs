// Arma con Freesound la biblioteca de sonidos reales del audio dramatizado a pedido (api/dramatizado.ts): para cada
// sonido de la lista, busca el mejor valorado con licencia CC0 o CC BY (las dos permiten usarlo en la app; CC BY pide
// citar al autor, y la app lo cita en el crédito de cada capítulo que lo usa) y guarda su versión MP3 en
// public/audio/sonidos/<id>.mp3, con su ficha en public/audio/sonidos/indice.json. Las licencias no comerciales
// (NC) y «Sampling+» quedan fuera. Solo busca los que faltan: para cambiar uno, se borra su MP3 y se vuelve a correr.
// Necesita FREESOUND_API_KEY (https://freesound.org/apiv2/apply).
//   node pipeline/audio_dramatizado/sonidos.mjs [id ...]
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const KEY = process.env.FREESOUND_API_KEY;
const API = 'https://freesound.org/apiv2';
const DIR = path.join(process.cwd(), 'public', 'audio', 'sonidos');
const INDICE = path.join(DIR, 'indice.json');

// tipo: «ambiente» suena de fondo en bucle toda la escena; «sonido», un detalle corto bajo la voz o un efecto.
// La descripción en inglés es la que lee la IA para elegirlo.
const LISTA = [
  { id: 'desierto-viento', tipo: 'ambiente', consulta: 'desert wind ambience', descripcion: 'dry desert wind, open wilderness', dur: [20, 180] },
  { id: 'campo-dia', tipo: 'ambiente', consulta: 'countryside field ambience birds day', descripcion: 'open countryside by day, distant birds, light breeze', dur: [20, 180] },
  { id: 'campo-noche', tipo: 'ambiente', consulta: 'night crickets field ambience', descripcion: 'quiet night in the fields, crickets', dur: [20, 180] },
  { id: 'lago-orilla', tipo: 'ambiente', consulta: 'lake shore gentle waves ambience', descripcion: 'calm lake shore, gentle small waves', dur: [20, 180] },
  { id: 'mar-tormenta', tipo: 'ambiente', consulta: 'storm sea waves wind', descripcion: 'stormy sea, strong wind and crashing waves', dur: [15, 180] },
  { id: 'rio', tipo: 'ambiente', consulta: 'river stream flowing ambience', descripcion: 'flowing river, steady current', dur: [20, 180] },
  { id: 'lluvia', tipo: 'ambiente', consulta: 'rain ambience steady', descripcion: 'steady rain', dur: [20, 180] },
  { id: 'mercado', tipo: 'ambiente', consulta: 'crowd market murmur outdoor', descripcion: 'busy outdoor market crowd murmuring', dur: [20, 180] },
  { id: 'multitud', tipo: 'ambiente', consulta: 'crowd murmur large outdoor walla', descripcion: 'large crowd murmuring outdoors', dur: [15, 180] },
  { id: 'patio-piedra', tipo: 'ambiente', consulta: 'courtyard reverberant people murmur stone', descripcion: 'stone courtyard with people murmuring, echo', dur: [15, 180] },
  { id: 'casa-noche', tipo: 'ambiente', consulta: 'quiet room night fire crackling', descripcion: 'quiet house at night, small fire crackling', dur: [15, 180] },
  { id: 'cueva', tipo: 'ambiente', consulta: 'cave ambience dripping water', descripcion: 'cave, water dripping, hollow silence', dur: [15, 180] },
  { id: 'rebano-ovejas', tipo: 'ambiente', consulta: 'sheep flock bleating field', descripcion: 'flock of sheep bleating in a field', dur: [10, 120] },
  { id: 'fogata', tipo: 'ambiente', consulta: 'campfire crackling', descripcion: 'campfire crackling', dur: [15, 180] },
  { id: 'cabras', tipo: 'sonido', consulta: 'goats bleating', descripcion: 'goats bleating', dur: [2, 15] },
  { id: 'burro', tipo: 'sonido', consulta: 'donkey bray', descripcion: 'a donkey braying', dur: [1, 10] },
  { id: 'camello', tipo: 'sonido', consulta: 'camel grunt', descripcion: 'a camel grunting', dur: [1, 10] },
  { id: 'gallo', tipo: 'sonido', consulta: 'rooster crowing', descripcion: 'a rooster crowing', dur: [1, 8] },
  { id: 'palomas', tipo: 'sonido', consulta: 'doves cooing', descripcion: 'doves cooing', dur: [2, 15] },
  { id: 'caballos', tipo: 'sonido', consulta: 'horses galloping', descripcion: 'horses galloping', dur: [2, 15] },
  { id: 'pasos-piedra', tipo: 'sonido', consulta: 'footsteps sandals stone', descripcion: 'footsteps on stone', dur: [2, 12] },
  { id: 'pasos-arena', tipo: 'sonido', consulta: 'footsteps sand gravel walking', descripcion: 'footsteps on sand and gravel', dur: [2, 12] },
  { id: 'remos', tipo: 'sonido', consulta: 'rowing boat oars water', descripcion: 'oars rowing in water', dur: [2, 15] },
  { id: 'barca-cruje', tipo: 'sonido', consulta: 'wooden boat creaking', descripcion: 'a wooden boat creaking', dur: [2, 15] },
  { id: 'red-pesca', tipo: 'sonido', consulta: 'fishing net water splash pull', descripcion: 'a fishing net pulled out of the water', dur: [2, 12] },
  { id: 'agua-vasija', tipo: 'sonido', consulta: 'pouring water into clay jar', descripcion: 'water poured into a clay jar', dur: [2, 12] },
  { id: 'chapoteo', tipo: 'sonido', consulta: 'water splash person', descripcion: 'splashing in water', dur: [1, 8] },
  { id: 'puerta-madera', tipo: 'sonido', consulta: 'old wooden door creak open', descripcion: 'an old wooden door opening', dur: [1, 8] },
  { id: 'piedra-rueda', tipo: 'sonido', consulta: 'heavy stone rolling grinding', descripcion: 'a heavy stone rolled away, grinding', dur: [2, 10] },
  { id: 'monedas', tipo: 'sonido', consulta: 'coins jingle drop', descripcion: 'coins falling and jingling', dur: [1, 6] },
  { id: 'cadenas', tipo: 'sonido', consulta: 'chains rattle', descripcion: 'chains rattling', dur: [1, 8] },
  { id: 'martillo-clavos', tipo: 'sonido', consulta: 'hammer nails wood', descripcion: 'hammering nails into wood', dur: [1, 8] },
  { id: 'espadas', tipo: 'sonido', consulta: 'sword unsheathe clash', descripcion: 'swords drawn and clashing', dur: [1, 8] },
  { id: 'trueno', tipo: 'sonido', consulta: 'thunder rumble distant', descripcion: 'distant thunder rumbling', dur: [3, 20] },
  { id: 'terremoto', tipo: 'sonido', consulta: 'earthquake rumble', descripcion: 'an earthquake rumbling', dur: [3, 20] },
  { id: 'cuerno-shofar', tipo: 'sonido', consulta: 'shofar horn', descripcion: 'a ram\'s horn (shofar) blown', dur: [2, 15] },
  { id: 'viento-fuerte', tipo: 'sonido', consulta: 'strong wind gust', descripcion: 'a strong gust of wind', dur: [2, 15] },
  { id: 'pan-partir', tipo: 'sonido', consulta: 'breaking bread', descripcion: 'bread being broken', dur: [1, 6] },
];

// Solo CC0 y CC BY (no NC, no Sampling+).
const licencia = (url) =>
  /publicdomain\/zero/.test(url) ? 'CC0' : /licenses\/by\/\d/.test(url) ? 'CC BY' : null;

async function buscar(s) {
  const params = new URLSearchParams({
    query: s.consulta,
    filter: `duration:[${s.dur[0]} TO ${s.dur[1]}]`,
    sort: 'rating_desc',
    fields: 'id,name,username,license,url,duration,previews,avg_rating,num_ratings,num_downloads,tags',
    page_size: '40',
    token: KEY,
  });
  const res = await fetch(`${API}/search/text/?${params}`);
  if (!res.ok) throw new Error(`Freesound ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { results = [] } = await res.json();
  const validos = results.filter(
    (r) => licencia(r.license) && !(r.tags ?? []).some((t) => /music|loop-?music|song|voice|speech|talking|synth|electronic/i.test(t)),
  );
  // El mejor valorado con suficientes votos; si no hay, el más descargado.
  validos.sort((a, b) => (b.num_ratings >= 3) - (a.num_ratings >= 3) || b.avg_rating - a.avg_rating || b.num_downloads - a.num_downloads);
  return validos[0] ?? null;
}

if (!KEY) {
  console.error('Falta FREESOUND_API_KEY');
  process.exit(1);
}
await mkdir(DIR, { recursive: true });
const indice = existsSync(INDICE) ? JSON.parse(await readFile(INDICE, 'utf8')) : [];
const pedidos = process.argv.slice(2);
let nuevos = 0;
let fallos = 0;
for (const s of LISTA) {
  if (pedidos.length && !pedidos.includes(s.id)) continue;
  const file = path.join(DIR, `${s.id}.mp3`);
  if (existsSync(file) && indice.some((x) => x.id === s.id)) continue;
  try {
    const r = await buscar(s);
    if (!r) throw new Error('sin resultados con licencia CC0 o CC BY');
    const mp3 = await fetch(r.previews['preview-hq-mp3']);
    if (!mp3.ok) throw new Error(`vista previa ${mp3.status}`);
    await writeFile(file, new Uint8Array(await mp3.arrayBuffer()));
    const ficha = {
      id: s.id,
      tipo: s.tipo,
      descripcion: s.descripcion,
      titulo: r.name,
      autor: r.username,
      licencia: licencia(r.license),
      licenciaUrl: r.license,
      enlace: r.url,
      freesound: r.id,
      duracion: Math.round(r.duration * 10) / 10,
    };
    const i = indice.findIndex((x) => x.id === s.id);
    if (i >= 0) indice[i] = ficha;
    else indice.push(ficha);
    nuevos++;
    console.log(`✓ ${s.id}: «${r.name}» de ${r.username} (${ficha.licencia}, ${ficha.duracion} s)`);
  } catch (err) {
    fallos++;
    console.error(`✗ ${s.id}: ${err.message}`);
  }
}
indice.sort((a, b) => LISTA.findIndex((x) => x.id === a.id) - LISTA.findIndex((x) => x.id === b.id));
await writeFile(INDICE, JSON.stringify(indice, null, 2) + '\n');
console.log(`${nuevos} sonidos nuevos, ${fallos} fallos.`);
if (fallos && !nuevos) process.exit(1);
