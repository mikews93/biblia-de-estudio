// Capturas de preguntas dictadas y herejías en el buscador (no es una prueba): node e2e/capturas-herejias.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts), que simula la IA (e2e/support/mock-anthropic.ts).
import { chromium, devices } from "@playwright/test";

const BASE = "http://localhost:8081";
const OUT = process.argv[2];
const CAIN =
  "A qué le huía Caín, o de quién huía más bien, a qué le tenía miedo después de matar a Abel, si no había nadie más excepto sus papás";

const cuenta = await (
  await fetch(`${BASE}/api/comunidades`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accion: "registrarse",
      nombre: "Mike",
      correo: `capturas-${Date.now()}@prueba.test`,
      clave: "clave-segura-1",
    }),
  })
).json();

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page({ desktop = false, theme } = {}) {
  const scheme = {
    colorScheme: theme === "oscuro" ? "dark" : "light",
    locale: "es-CO",
  };
  const ctx = await browser.newContext(
    desktop
      ? { viewport: { width: 1280, height: 860 }, ...scheme }
      : {
          ...devices["Pixel 7"],
          viewport: { width: 412, height: 915 },
          ...scheme,
        },
  );
  const p = await ctx.newPage();
  await p.addInitScript((cu) => {
    localStorage.setItem("cuenta", cu);
    localStorage.setItem("permiso-ia", "si");
  }, JSON.stringify(cuenta));
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name) => {
  await wait(900);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};
const bajar = async (p, px) => {
  await p.mouse.move(200, 400);
  await p.mouse.wheel(0, px);
};

async function recorrido(prefix, opts) {
  const p = await page(opts);
  // La pregunta de Caín, dictada sin signos: ahora sale como pregunta
  await p.goto(`${BASE}/buscar?q=${encodeURIComponent(CAIN)}`);
  await p.getByText("Ver la respuesta completa ›").waitFor({ timeout: 60000 });
  await wait(4500);
  await shot(p, `${prefix}-1-cain-pregunta`);
  // «modalismo» a secas: se ofrece «¿Era una pregunta?»
  await p.goto(`${BASE}/buscar?q=modalismo`);
  await p.getByText("¿Era una pregunta?").waitFor({ timeout: 60000 });
  await shot(p, `${prefix}-2-era-pregunta`);
  await p.getByText("¿Era una pregunta?").click();
  await p.getByText("Ver la respuesta completa ›").waitFor({ timeout: 60000 });
  await p.getByText("máscaras", { exact: false }).first().waitFor();
  await shot(p, `${prefix}-3-modalismo-tarjeta`);
  await p.getByText("Ver la respuesta completa ›").click();
  await p.getByText("Por qué se rechazó").waitFor({ timeout: 60000 });
  await shot(p, `${prefix}-4-modalismo-respuesta`);
  await bajar(p, 900);
  await shot(p, `${prefix}-5-modalismo-fuentes`);
  // Las preguntas preparadas de herejías y concilios
  await p.goto(`${BASE}/buscar`);
  await p.getByText("Herejías y concilios").click();
  await bajar(p, 200);
  await shot(p, `${prefix}-6-preparadas`);
  await p.context().close();
}

await recorrido("m", {});
await recorrido("o", { theme: "oscuro" });
await recorrido("d", { desktop: true });
await browser.close();
