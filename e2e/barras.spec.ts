// Las barras que se apartan al bajar leyendo (src/lib/chrome.ts). Al apartarse cambia el alto de lo que se
// desplaza y, cerca del final, el navegador corrige la posición: antes eso volvía a mostrar la barra, que volvía a
// empujar, y la pantalla temblaba arriba y abajo sin parar.

import type { Page } from '@playwright/test';

import { conSesion, cuentaNueva, expect, modoProfundo, test } from './support/fixtures';

/** El área que se desplaza dentro de `raiz` (la más alta), con algo de alto extra para que haya recorrido. */
async function prepararScroll(page: Page, raiz: string, extra: number) {
  await page.evaluate(
    ([raiz, extra]) => {
      const base = document.querySelector(raiz as string) ?? document;
      const sc = [...base.querySelectorAll('div')]
        .filter((d) => d.scrollHeight > d.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(d).overflowY))
        .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
      if (extra) {
        const relleno = document.createElement('div');
        relleno.style.height = `${extra}px`;
        sc.firstElementChild!.prepend(relleno);
      }
      (window as unknown as { __sc: HTMLElement }).__sc = sc;
    },
    [raiz, extra] as const,
  );
}

/** Cuántas veces cambia de sentido el alto visible al bajar desde cerca del final hasta el final, y un poco después. */
async function vaivenesAlFinal(page: Page, antesDelFinal: number) {
  await page.evaluate((antes) => {
    const w = window as unknown as { __sc: HTMLElement; __altos: number[] };
    w.__sc.scrollTop = w.__sc.scrollHeight - w.__sc.clientHeight - antes;
    w.__altos = [];
    const mirar = () => {
      const h = w.__sc.clientHeight;
      if (w.__altos.at(-1) !== h) w.__altos.push(h);
      if (w.__altos.length < 200) requestAnimationFrame(mirar);
    };
    mirar();
  }, antesDelFinal);
  const caja = await page.evaluate(() => {
    const r = (window as unknown as { __sc: HTMLElement }).__sc.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.waitForTimeout(300);
  await page.mouse.move(caja.x, caja.y);
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 30);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(1500);
  const altos = await page.evaluate(() => (window as unknown as { __altos: number[] }).__altos);
  let cambios = 0;
  let sentido = 0;
  for (let i = 1; i < altos.length; i++) {
    const s = Math.sign(altos[i] - altos[i - 1]);
    if (s && s !== sentido) {
      cambios++;
      sentido = s;
    }
  }
  return cambios;
}

test('al final del estudio la cabecera no sube y baja sola', async ({ page, request }) => {
  await modoProfundo(page);
  await conSesion(page, await cuentaNueva(request, 'Lectora Barras'));
  await page.goto('/juan/3/16');
  await page.getByRole('button', { name: 'Estudiar', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Estudio simulado del pasaje').first()).toBeVisible();
  await page.waitForTimeout(800);
  await prepararScroll(page, '[role=dialog]', 600);
  // Puede apartarse una vez; antes se movía decenas de veces sin tocar nada
  expect(await vaivenesAlFinal(page, 40)).toBeLessThanOrEqual(1);
});

test('al final del capítulo las barras no se esconden para volver a salir', async ({ page }) => {
  await page.goto('/juan/3');
  await expect(page.getByText('De tal manera amó Dios al mundo', { exact: false }).first()).toBeVisible();
  await prepararScroll(page, 'body', 0);
  // A 150 px del final bajar las escondía y, al llegar, volvían a salir de golpe
  expect(await vaivenesAlFinal(page, 150)).toBe(0);
});
