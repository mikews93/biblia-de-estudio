// Pantallas del video de función «Despertar con la Biblia» (no es una prueba).  node video/promo/scripts/funciones/despertador.mjs
import { abrir, guardarToques } from './comun.mjs';

const activo = { activo: true, hora: 360, dias: 0b0111110, modo: 'versiculo' };
const { p, shot, toque, sinAviso, wait, cerrar } = await abrir('despertador', {
  reloj: '2026-11-04T11:00:00Z',
  guardar: { avisos: { endpoint: null, hora: 420, avisos: {}, despertar: activo } },
  args: ['--autoplay-policy=no-user-gesture-required'],
});
await p.addInitScript(() => {
  speechSynthesis.speak = (u) => setTimeout(() => u.onend?.(new Event('end')), 6000);
  // Un teléfono con la voz de Google en español (la del navegador sin ventana no trae ninguna).
  const voz = (name, lang, local) => {
    const v = Object.create(SpeechSynthesisVoice.prototype);
    for (const [k, val] of Object.entries({ name, lang, voiceURI: name, localService: local, default: false })) Object.defineProperty(v, k, { value: val });
    return v;
  };
  const voces = [voz('Google español de Estados Unidos', 'es-US', false), voz('Español (Colombia)', 'es-CO', true)];
  speechSynthesis.getVoices = () => voces;
});
const bajar = async (px) => {
  await p.mouse.move(200, 400);
  await p.mouse.wheel(0, px);
};

await p.goto('/despertador');
await p.getByText('Despertar con la Biblia').first().waitFor();
await p.getByText('Tu progreso quedó guardado').waitFor({ timeout: 6000 }).catch(() => {});
await sinAviso();
await shot('1-ajustes', null, 2500);
await bajar(700);
await shot('2-que-suena', null, 1200);
await bajar(900);
await shot('3-rutina', null, 1200);
await p.goto('/despertar');
await p.getByTestId('versiculo-despertar').waitFor();
await shot('4-amanece', null, 2500);
await shot('5-versiculo', null, 7000);
await bajar(600);
await shot('6-abajo', null, 1500);

await cerrar();
guardarToques('despertador');
