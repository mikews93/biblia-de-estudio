// Genera todos los iconos de la app a partir de assets/icono/*.svg.
// Uso: node pipeline/iconos.mjs [parte del nombre]   (usa el Chromium de Playwright)
import { chromium } from '@playwright/test';
import fs from 'fs';

const svg = (f) => `data:image/svg+xml;base64,${fs.readFileSync(`assets/icono/${f}.svg`).toString('base64')}`;
const FONDO = svg('fondo');
const LLAMA = svg('llama');

// capas: [imagen, escala]; la escala encoge la figura hacia el centro (zonas seguras).
const SALIDAS = [
  // Icono completo (iOS recorta las esquinas solo).
  { out: 'assets/icon.png', size: 1024, capas: [[FONDO, 1], [LLAMA, 1]] },
  { out: 'assets/favicon.png', size: 48, capas: [[FONDO, 1], [LLAMA, 1.1]], redondo: 0.22 },
  // Android adaptativo: la figura debe caber en el círculo de 66/108.
  { out: 'assets/android-icon-background.png', size: 1024, capas: [[FONDO, 1]] },
  { out: 'assets/android-icon-foreground.png', size: 1024, capas: [[LLAMA, 0.7]] },
  { out: 'assets/android-icon-monochrome.png', size: 1024, capas: [[LLAMA, 0.7]], mono: true },
  // Pantalla de inicio nativa (expo-splash-screen).
  { out: 'assets/splash-icon.png', size: 1024, capas: [[LLAMA, 1]] },
  // Web / PWA.
  { out: 'public/logo192.png', size: 192, capas: [[FONDO, 1], [LLAMA, 1]] },
  { out: 'public/logo512.png', size: 512, capas: [[FONDO, 1], [LLAMA, 1]] },
  { out: 'public/maskable512.png', size: 512, capas: [[FONDO, 1], [LLAMA, 0.85]] },
  { out: 'public/apple-touch-icon.png', size: 180, capas: [[FONDO, 1], [LLAMA, 1]] },
  // Insignia de las notificaciones: Android solo usa la transparencia, así que va la llama sola en blanco.
  { out: 'public/badge96.png', size: 96, capas: [[LLAMA, 1.4]], mono: true },
];

const browser = await chromium.launch();
const page = await browser.newPage();
const filtro = process.argv[2] ?? '';
for (const s of SALIDAS.filter((x) => x.out.includes(filtro))) {
  await page.setViewportSize({ width: s.size, height: s.size });
  const imgs = s.capas
    .map(([src, k]) => `<img src="${src}" style="position:absolute;inset:0;width:100%;height:100%;transform:scale(${k});${s.mono ? 'filter:brightness(0) invert(1)' : ''}">`)
    .join('');
  const radio = s.redondo ? `border-radius:${s.redondo * 100}%;overflow:hidden;` : '';
  await page.setContent(`<body style="margin:0;background:transparent"><div style="position:relative;width:${s.size}px;height:${s.size}px;${radio}">${imgs}</div></body>`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.screenshot({ path: s.out, omitBackground: true, clip: { x: 0, y: 0, width: s.size, height: s.size } });
  console.log(s.out);
}
await browser.close();
