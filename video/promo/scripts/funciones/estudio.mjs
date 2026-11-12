// Pantallas del video de función «Estudio profundo» (no es una prueba).  node video/promo/scripts/funciones/estudio.mjs
// La respuesta de /api/estudiar se simula en el navegador con el estudio de ejemplo de e2e/capturas-estudio-detallado.mjs.
import { abrir, guardarToques } from './comun.mjs';

const PASOS = [
  { type: 'paso', tipo: 'teologia', texto: 'el desposorio judío en tiempos de Jesús' },
  { type: 'paso', tipo: 'temas', texto: 'el poder de Dios' },
  { type: 'paso', tipo: 'teologia', texto: 'la omnipotencia de Dios' },
  { type: 'paso', tipo: 'leer', texto: 'Génesis 18:9-15' },
];

const F = (n, label, extra = {}) => ({ type: 'source', n, label, ...extra });
const ESTUDIO = [
  F(1, 'Lucas 1:36', { ref: 'luk.1.36' }),
  F(2, 'Ficha de María (STEPBible)', { url: 'https://zarzabiblia.com/ficha/maria', nota: 'STEPBible TIPNR · CC BY 4.0' }),
  F(3, 'Edersheim, La vida social judía, Chapter IX. Betrothal and marriage', { url: 'https://ccel.org/ccel/edersheim/sketches', nota: 'Alfred Edersheim · 1876 · historia y costumbres judías · dominio público' }),
  F(4, 'Lucas 1:25', { ref: 'luk.1.25' }),
  F(5, 'Diccionario bíblico Tyndale, «Anunciación»', { url: 'https://github.com/BibleAquifer/AquiferOpenBibleDictionary', nota: 'Tyndale Open Bible Dictionary · 2023 · CC BY-SA 4.0' }),
  F(6, 'Léxico UBS, ἀδυνατέω', { url: 'https://github.com/ubsicap/ubs-open-license', nota: 'Sociedades Bíblicas Unidas · 2023 · CC BY-SA 4.0' }),
  F(7, 'Léxico UBS, ῥῆμα', { url: 'https://github.com/ubsicap/ubs-open-license', nota: 'Sociedades Bíblicas Unidas · 2023 · CC BY-SA 4.0' }),
  F(8, 'Credo de los Apóstoles (Schaff, Credos de la cristiandad)', { url: 'https://ccel.org/ccel/schaff/creeds2', nota: 'Philip Schaff · 1877 · credos · dominio público' }),
  F(9, 'Génesis 18:14', { ref: 'gen.18.14' }),
  F(10, 'Jeremías 32:17', { ref: 'jer.32.17' }),
  F(11, 'Marcos 10:27', { ref: 'mrk.10.27' }),
  F(12, 'Temas de la Biblia de Nave, «God, Omnipotence»', { url: 'https://github.com/BradyStephenson/bible-data', nota: "Nave's Topical Bible · 1896 · dominio público" }),
  F(13, 'Éxodo 14:21', { ref: 'exo.14.21' }),
  F(14, 'Romanos 4:20-21', { ref: 'rom.4.20' }),
  {
    type: 'text',
    text: `## Panorama

Gabriel acaba de anunciar a María que concebirá por obra del Espíritu Santo, y le da una señal que puede comprobar: Elisabet, anciana y estéril, ya está en su sexto mes.⟦1⟧ El versículo 37 cierra el anuncio y prepara la respuesta de María en el 38.

## Su mundo

María vive en Nazaret, una aldea pequeña de Galilea, y está desposada con José, de la casa de David.⟦2⟧

## Costumbres y trasfondo

- **El desposorio.** Entre los judíos, el desposorio ya era un compromiso legal que solo se rompía con divorcio, aunque los novios todavía no vivían juntos. Un embarazo en ese tiempo ponía en juego la honra de María.⟦3⟧
- **La esterilidad.** No tener hijos se vivía como una afrenta pública; Elisabet lo dice con esas palabras.⟦4⟧
- **La señal.** El ángel no pide fe a ciegas: da una señal cercana que María irá a ver en los versículos siguientes.⟦5⟧

## Palabras del griego

- **adynatēsei** («será imposible»): el léxico lo define como algo imposible por falta de poder para cambiarlo. Con la negación y en futuro, Lucas dice que no habrá nada que Dios no pueda hacer.⟦6⟧
- **rhēma** («cosa», «palabra»): puede ser lo que se dice o el hecho del que se habla. Aquí une las dos ideas: ninguna palabra de Dios se queda sin cumplir.⟦7⟧

## Interpreta

Para los primeros lectores, el versículo enlaza a María con Sara: la misma pregunta de Génesis vuelve a sonar y recibe la misma respuesta.⟦9⟧

## Lo que enseña

El poder de Dios no es fuerza sin dirección: es el poder con que cumple lo que promete. Por eso la Iglesia confiesa desde muy temprano «creo en Dios Padre todopoderoso».⟦8⟧

## Pasajes relacionados

- Dios le pregunta a Abraham si hay algo difícil para Él, antes del nacimiento de Isaac.⟦9⟧
- Jeremías compra un campo en plena invasión porque nada es difícil para Dios.⟦10⟧
- Jesús dice lo mismo de la salvación: para los hombres es imposible, para Dios no.⟦11⟧

## La Biblia sobre este tema

El índice de temas reúne el poder de Dios a lo largo de toda la Biblia.⟦12⟧ Abre el mar en el éxodo,⟦13⟧ da un hijo a Sara y a Elisabet, y Pablo lo pone como ejemplo de fe: Abraham estaba convencido de que Dios era poderoso para cumplir lo prometido.⟦14⟧

## Hacia Cristo

Lo imposible que aquí se anuncia es el Hijo mismo: Dios hecho hombre en el vientre de una joven de Nazaret.

## Para aplicar

- ¿Qué promesa de Dios te parece hoy «imposible»?
- ¿Qué cambia en ti si lo crees como María en el versículo 38?`,
  },
  { type: 'done' },
];

const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('estudio', { guardar: { ajustes: { enfoque: 'profundo' } } });
await p.addInitScript(
  ([pasos, estudio]) => {
    const real = window.fetch;
    window.fetch = (url, init) => {
      if (!String(url).endsWith('/api/estudiar')) return real(url, init);
      const body = JSON.parse(init.body);
      if (body.senales) return Promise.resolve(new Response(JSON.stringify({ ayudo: 0, mio: { ayudo: false, raro: false }, frecuentes: [] }), { headers: { 'Content-Type': 'application/json' } }));
      const enc = new TextEncoder();
      const stream = new ReadableStream({
        async start(c) {
          const send = (e) => c.enqueue(enc.encode(JSON.stringify(e) + '\n'));
          const espera = (ms) => new Promise((r) => setTimeout(r, ms));
          for (const paso of pasos) {
            send(paso);
            await espera(150);
          }
          while (!window.__soltar) await espera(100);
          estudio.forEach(send);
          c.close();
        },
      });
      return Promise.resolve(new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } }));
    };
  },
  [PASOS, ESTUDIO],
);
const ir = async (texto) => {
  await p.getByText(texto, { exact: true }).first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await p.mouse.move(206, 450);
  await p.mouse.wheel(0, -260);
};

await p.goto('/lucas/1/37');
await wait(3500);
await p.getByText('Tu progreso quedó guardado').waitFor({ timeout: 6000 }).catch(() => {});
await sinAviso();
const boton = p.getByRole('button', { name: 'Estudiar', exact: true });
await shot('1-versiculo', await toque(boton), 600);
await boton.click();
await p.getByText(/Consultando teologías clásicas|Leyendo/).first().waitFor();
await shot('2-investigando', null, 900);
await p.evaluate(() => (window.__soltar = true));
await p.getByText('Costumbres y trasfondo').waitFor();
await shot('3-estudio', null, 900);
await ir('Costumbres y trasfondo');
await shot('4-costumbres', null, 1200);
await ir('Palabras del griego');
await shot('5-griego', null, 1200);
await ir('Lo que enseña');
await shot('6-doctrina', null, 1200);
await ir('Para aplicar');
await shot('7-aplicar', null, 1200);

await cerrar();
guardarToques('estudio');
