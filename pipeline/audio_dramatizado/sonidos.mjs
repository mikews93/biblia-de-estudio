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
  // consultas: se prueban en orden; palabras: alguna tiene que estar en el nombre o las etiquetas; voces: se aceptan
  // grabaciones con gente hablando (multitudes y mercados, sin palabras que se entiendan).
  { id: 'desierto-viento', tipo: 'ambiente', consultas: ['desert wind', 'wind dry open landscape', 'wind ambience'], palabras: ['desert', 'wind'], descripcion: 'dry desert wind, open wilderness', dur: [20, 180] },
  { id: 'campo-dia', tipo: 'ambiente', consultas: ['meadow birds countryside', 'countryside ambience birds', 'field birds summer'], palabras: ['meadow', 'countryside', 'field', 'rural'], descripcion: 'open countryside by day, distant birds, light breeze', dur: [20, 180] },
  { id: 'campo-noche', tipo: 'ambiente', consultas: ['night crickets', 'crickets night ambience'], palabras: ['cricket', 'night'], descripcion: 'quiet night in the fields, crickets', dur: [20, 180] },
  { id: 'lago-orilla', tipo: 'ambiente', consultas: ['lake shore waves', 'gentle waves shore', 'lake water lapping'], palabras: ['lake', 'shore', 'waves', 'lapping'], descripcion: 'calm lake shore, gentle small waves', dur: [20, 180] },
  { id: 'mar-tormenta', tipo: 'ambiente', consultas: ['storm sea waves', 'stormy ocean wind', 'heavy waves storm'], palabras: ['storm', 'stormy', 'rough'], descripcion: 'stormy sea, strong wind and crashing waves', dur: [15, 180] },
  { id: 'rio', tipo: 'ambiente', consultas: ['river flowing', 'river stream ambience', 'stream water flowing'], palabras: ['river', 'stream', 'creek'], descripcion: 'flowing river, steady current', dur: [20, 180] },
  { id: 'lluvia', tipo: 'ambiente', consultas: ['steady rain', 'rain ambience'], palabras: ['rain'], descripcion: 'steady rain', dur: [20, 180] },
  { id: 'mercado', tipo: 'ambiente', consultas: ['market crowd', 'bazaar', 'souk', 'outdoor market ambience'], palabras: ['market', 'bazaar', 'souk'], voces: true, descripcion: 'busy outdoor market crowd murmuring', dur: [15, 180] },
  { id: 'multitud', tipo: 'ambiente', consultas: ['crowd murmur', 'walla crowd', 'crowd outdoor ambience'], palabras: ['crowd', 'walla', 'murmur'], voces: true, descripcion: 'large crowd murmuring outdoors', dur: [15, 180] },
  { id: 'patio-piedra', tipo: 'ambiente', consultas: ['church interior ambience', 'cathedral ambience people', 'large hall reverb ambience'], palabras: ['church', 'cathedral', 'hall', 'temple', 'monastery'], voces: true, descripcion: 'large stone hall or temple interior, distant murmur, echo', dur: [15, 180] },
  { id: 'casa-noche', tipo: 'ambiente', consultas: ['fireplace crackling room', 'fire crackling indoor', 'fireplace'], palabras: ['fire', 'fireplace', 'crackling'], descripcion: 'quiet house at night, small fire crackling', dur: [15, 180] },
  { id: 'cueva', tipo: 'ambiente', consultas: ['cave dripping', 'cave ambience', 'cave water drops'], palabras: ['cave', 'cavern', 'grotto'], descripcion: 'cave, water dripping, hollow silence', dur: [15, 180] },
  { id: 'rebano-ovejas', tipo: 'ambiente', consultas: ['sheep flock', 'sheep bleating'], palabras: ['sheep', 'flock', 'lamb'], descripcion: 'flock of sheep bleating in a field', dur: [10, 120] },
  { id: 'fogata', tipo: 'ambiente', consultas: ['campfire', 'campfire crackling'], palabras: ['campfire', 'fire', 'bonfire'], descripcion: 'campfire crackling', dur: [15, 180] },
  { id: 'cabras', tipo: 'sonido', consultas: ['goats bleating', 'goat'], palabras: ['goat'], descripcion: 'goats bleating', dur: [2, 20] },
  { id: 'burro', tipo: 'sonido', consultas: ['donkey bray', 'donkey'], palabras: ['donkey'], descripcion: 'a donkey braying', dur: [1, 12] },
  { id: 'camello', tipo: 'sonido', consultas: ['camel', 'camel grunt', 'camel growl'], palabras: ['camel'], descripcion: 'a camel grunting', dur: [1, 20] },
  { id: 'gallo', tipo: 'sonido', consultas: ['rooster crowing', 'rooster'], palabras: ['rooster', 'cock'], descripcion: 'a rooster crowing', dur: [1, 10] },
  { id: 'palomas', tipo: 'sonido', consultas: ['doves cooing', 'pigeon cooing'], palabras: ['dove', 'pigeon', 'cooing'], descripcion: 'doves cooing', dur: [2, 15] },
  { id: 'caballos', tipo: 'sonido', consultas: ['horses galloping', 'horse gallop'], palabras: ['horse', 'gallop'], descripcion: 'horses galloping', dur: [2, 15] },
  { id: 'pasos-piedra', tipo: 'sonido', consultas: ['footsteps stone', 'footsteps on stone floor', 'footsteps concrete'], palabras: ['footstep', 'footsteps', 'steps', 'walking'], descripcion: 'footsteps on stone', dur: [2, 15] },
  { id: 'pasos-arena', tipo: 'sonido', consultas: ['footsteps sand', 'footsteps gravel', 'walking dirt'], palabras: ['footstep', 'footsteps', 'steps', 'walking'], descripcion: 'footsteps on sand and gravel', dur: [2, 15] },
  { id: 'remos', tipo: 'sonido', consultas: ['rowing oars', 'rowing boat', 'oar water'], palabras: ['row', 'rowing', 'oar', 'paddle'], descripcion: 'oars rowing in water', dur: [2, 15] },
  { id: 'barca-cruje', tipo: 'sonido', consultas: ['wooden boat creak', 'boat creaking', 'ship creak wood'], palabras: ['boat', 'ship', 'hull', 'mast'], descripcion: 'a wooden boat creaking', dur: [2, 20] },
  { id: 'red-pesca', tipo: 'sonido', consultas: ['fishing net', 'net pulled water', 'wet rope water splash'], palabras: ['net', 'fishing', 'rope'], descripcion: 'a fishing net pulled out of the water', dur: [1, 15] },
  { id: 'agua-vasija', tipo: 'sonido', consultas: ['pouring water jug', 'pouring water', 'water pour pot'], palabras: ['pour', 'pouring'], descripcion: 'water poured into a clay jar', dur: [1, 12] },
  { id: 'chapoteo', tipo: 'sonido', consultas: ['water splash', 'splash'], palabras: ['splash', 'splashing'], descripcion: 'splashing in water', dur: [1, 8] },
  { id: 'puerta-madera', tipo: 'sonido', consultas: ['wooden door creak', 'door creak'], palabras: ['door'], descripcion: 'an old wooden door opening', dur: [1, 8] },
  { id: 'piedra-rueda', tipo: 'sonido', consultas: ['stone rolling', 'heavy stone drag', 'rock scrape', 'stone grinding'], palabras: ['stone', 'rock', 'boulder'], descripcion: 'a heavy stone rolled away, grinding', dur: [1, 12] },
  { id: 'monedas', tipo: 'sonido', consultas: ['coins drop', 'coins jingle'], palabras: ['coin', 'coins'], descripcion: 'coins falling and jingling', dur: [1, 6] },
  { id: 'cadenas', tipo: 'sonido', consultas: ['chains rattle', 'metal chain', 'chain'], palabras: ['chain', 'chains', 'shackle'], descripcion: 'chains rattling', dur: [1, 10] },
  { id: 'martillo-clavos', tipo: 'sonido', consultas: ['hammer nail', 'hammering nails'], palabras: ['hammer', 'nail'], descripcion: 'hammering nails into wood', dur: [1, 8] },
  { id: 'espadas', tipo: 'sonido', consultas: ['sword clash', 'sword unsheath', 'sword'], palabras: ['sword', 'blade'], descripcion: 'swords drawn and clashing', dur: [1, 10] },
  { id: 'trueno', tipo: 'sonido', consultas: ['thunder rumble', 'distant thunder', 'thunder'], palabras: ['thunder'], descripcion: 'distant thunder rumbling', dur: [3, 25] },
  { id: 'terremoto', tipo: 'sonido', consultas: ['earthquake', 'earthquake rumble', 'ground rumble'], palabras: ['earthquake', 'quake', 'rumble'], descripcion: 'an earthquake rumbling', dur: [3, 25] },
  { id: 'cuerno-shofar', tipo: 'sonido', consultas: ['shofar', 'ram horn', 'horn blow'], palabras: ['shofar', 'horn'], descripcion: "a ram's horn (shofar) blown", dur: [2, 15] },
  { id: 'viento-fuerte', tipo: 'sonido', consultas: ['wind gust', 'strong wind', 'howling wind'], palabras: ['wind', 'gust'], descripcion: 'a strong gust of wind', dur: [2, 15] },
  { id: 'pan-partir', tipo: 'sonido', consultas: ['bread break', 'breaking bread', 'tearing bread'], palabras: ['bread'], descripcion: 'bread being broken', dur: [1, 6] },
];

// Solo CC0 y CC BY (no NC, no Sampling+).
const licencia = (url) =>
  /publicdomain\/zero/.test(url) ? 'CC0' : /licenses\/by\/\d/.test(url) ? 'CC BY' : null;

// Lo que delata el mundo de hoy o lo que no es un sonido real: no entra.
const MODERNO = /\b(city|urban|traffic|cars?|road|highway|street|airplane|aeroplane|plane|jet|train|tram|engine|motor|siren|phone|computer|plastic|synth|synthesizer|electronic|music|musical|song|radio|tv|television|construction|machine|factory|subway|metro|bus|truck|motorcycle|helicopter|beep|game|sci-?fi|cartoon|distorted)\b/i;
const HABLA = /\b(voice|voices|speech|talk|talking|speaking|conversation|dialogue|singing)\b/i;

async function candidatos(s, query) {
  const params = new URLSearchParams({
    query,
    filter: `duration:[${s.dur[0]} TO ${s.dur[1]}]`,
    sort: 'rating_desc',
    fields: 'id,name,username,license,url,duration,previews,avg_rating,num_ratings,num_downloads,tags,description',
    page_size: '50',
    token: KEY,
  });
  const res = await fetch(`${API}/search/text/?${params}`);
  if (!res.ok) throw new Error(`Freesound ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { results = [] } = await res.json();
  return results.filter((r) => {
    const texto = `${r.name} ${(r.tags ?? []).join(' ')}`;
    const todo = `${texto} ${r.description ?? ''}`;
    return (
      licencia(r.license) &&
      s.palabras.some((p) => new RegExp(`\\b${p}`, 'i').test(texto)) &&
      !MODERNO.test(todo) &&
      (s.voces || !HABLA.test(texto))
    );
  });
}

async function buscar(s) {
  for (const q of s.consultas) {
    const validos = await candidatos(s, q);
    // El mejor valorado con suficientes votos; si no hay, el más descargado.
    validos.sort((a, b) => (b.num_ratings >= 3) - (a.num_ratings >= 3) || b.avg_rating - a.avg_rating || b.num_downloads - a.num_downloads);
    if (validos[0]) return validos[0];
  }
  return null;
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
