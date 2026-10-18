// Genera todos los iconos de la app a partir de assets/icono/*.svg.
// Uso: node pipeline/iconos.mjs   (usa el Chromium de Playwright)
import { chromium } from '@playwright/test';
import fs from 'fs';

const svg = (f) => `data:image/svg+xml;base64,${fs.readFileSync(`assets/icono/${f}.svg`).toString('base64')}`;
const FONDO = svg('fondo');
const LAMPARA = svg('lampara');

// capas: [imagen, escala]; la escala encoge la figura hacia el centro (zonas seguras).
const SALIDAS = [
  // Icono completo (iOS recorta las esquinas solo).
  { out: 'assets/icon.png', size: 1024, capas: [[FONDO, 1], [LAMPARA, 1]] },
  { out: 'assets/favicon.png', size: 48, capas: [[FONDO, 1], [LAMPARA, 1.12]], redondo: 0.22 },
  // Android adaptativo: la figura debe caber en el círculo de 66/108.
  { out: 'assets/android-icon-background.png', size: 1024, capas: [[FONDO, 1]] },
  { out: 'assets/android-icon-foreground.png', size: 1024, capas: [[LAMPARA, 0.86]] },
  { out: 'assets/android-icon-monochrome.png', size: 1024, capas: [[LAMPARA, 0.86]], mono: true },
  // Pantalla de inicio nativa (expo-splash-screen).
  { out: 'assets/splash-icon.png', size: 1024, capas: [[LAMPARA, 1]] },
  // Web / PWA.
  { out: 'public/logo192.png', size: 192, capas: [[FONDO, 1], [LAMPARA, 1]] },
  { out: 'public/logo512.png', size: 512, capas: [[FONDO, 1], [LAMPARA, 1]] },
  { out: 'public/maskable512.png', size: 512, capas: [[FONDO, 1], [LAMPARA, 0.9]] },
  { out: 'public/apple-touch-icon.png', size: 180, capas: [[FONDO, 1], [LAMPARA, 1]] },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const s of SALIDAS) {
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
