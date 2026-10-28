// Dibuja una vez la imagen de fondo de /conexiones: las 286 602 referencias cruzadas de OpenBible.info como arcos
// entre capítulos, de Génesis 1 a Apocalipsis 22. Son 141 001 arcos: demasiados para dibujarlos en el teléfono cada vez,
// así que se pintan aquí con el canvas de Chromium y la app solo dibuja encima los del libro o capítulo elegido.
//
// Uso: node pipeline/arcos_imagen.mjs [public/data]   (después de npm run data). Escribe assets/arcos/{claro,oscuro}.webp.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = process.argv[2] ?? join(root, 'public/data');
const books = JSON.parse(readFileSync(join(data, 'books.json'), 'utf8'));

// Pares [capítulo a, capítulo b, conexiones] con a < b
const pairs = [];
let start = 0;
for (const b of books) {
  const rows = JSON.parse(readFileSync(join(data, 'arcos', `${b.id}.json`), 'utf8'));
  rows.forEach((row, i) => {
    const a = start + i;
    for (let k = 0; k < row.length; k += 2) if (row[k] > a) pairs.push([a, row[k], row[k + 1]]);
  });
  start += b.chapters;
}
const total = start;
console.log(`${pairs.length} arcos entre ${total} capítulos`);

const W = 2000;
const H = W / 2;

function draw({ pairs, total, W, H, dark, stops }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const mix = (f) => {
    const i = Math.min(stops.length - 2, Math.floor(f * (stops.length - 1)));
    const t = f * (stops.length - 1) - i;
    return stops[i].map((c, k) => Math.round(c + (stops[i + 1][k] - c) * t));
  };
  // Los largos primero: los cortos, que son más, quedan encima
  pairs.sort((p, q) => q[1] - q[0] - (p[1] - p[0]));
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = 1;
  const x = (i) => ((i + 0.5) / total) * W;
  for (const [a, b, n] of pairs) {
    const f = (b - a) / total;
    const [r, g, bl] = mix(Math.pow(f, 0.6));
    const alpha = Math.min(0.7, (dark ? 0.007 : 0.0085) * n);
    ctx.strokeStyle = `rgba(${r},${g},${bl},${alpha})`;
    const x1 = x(a);
    const x2 = x(b);
    ctx.beginPath();
    ctx.arc((x1 + x2) / 2, H, (x2 - x1) / 2, Math.PI, 0);
    ctx.stroke();
  }
  return canvas.toDataURL('image/webp', 0.8);
}

// Del arco corto al largo: ámbar, rosa, violeta, azul. Iguales a ESPECTRO en src/lib/conexiones.ts.
const ESPECTRO = {
  claro: [[176, 102, 30], [184, 76, 96], [112, 84, 168], [44, 98, 150]],
  oscuro: [[226, 168, 104], [222, 120, 140], [160, 136, 222], [110, 166, 220]],
};

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage();
for (const [name, dark] of [['claro', false], ['oscuro', true]]) {
  const url = await page.evaluate(draw, { pairs, total, W, H, dark, stops: ESPECTRO[name] });
  const file = join(root, 'assets/arcos', `${name}.webp`);
  writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`${file}: ${Math.round(url.length * 0.75 / 1024)} KB`);
}
await browser.close();
