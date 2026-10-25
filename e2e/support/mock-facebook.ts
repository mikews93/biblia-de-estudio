// Facebook simulado para las pruebas: la página donde la persona acepta (/__facebook/dialog) y la API Graph
// (/__facebook/graph) que usa Auth.js desde api/_entrar.ts. El código de la vuelta lleva el nombre que se escribió en la
// página, así cada prueba elige quién es en Facebook.

import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

// La «foto de Facebook» es el favicon de la app: una imagen de verdad, para que el navegador la muestre.
const FOTO = readFileSync(path.resolve('assets/favicon.png'));

const decode = (code: string) => JSON.parse(Buffer.from(code, 'base64url').toString()) as { nombre: string };

export function configureFacebook(base: string) {
  process.env.FACEBOOK_APP_ID ??= 'app-de-prueba';
  process.env.FACEBOOK_APP_SECRET ??= 'secreto-de-prueba';
  process.env.FACEBOOK_DIALOG_URL ??= `${base}/__facebook/dialog`;
  process.env.FACEBOOK_GRAPH_URL ??= `${base}/__facebook/graph`;
}

export function handleFacebook(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const q = url.searchParams;
  if (url.pathname === '/__facebook/dialog') {
    const back = (extra: Record<string, string>) =>
      `${q.get('redirect_uri')}?${new URLSearchParams({ state: q.get('state') ?? '', ...extra })}`;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><meta charset="utf-8"><title>Facebook</title>
<form id="f">
<label>Tu nombre en Facebook <input name="nombre" value="Priscila"></label>
<button>Continuar como en Facebook</button></form>
<script>
document.getElementById('f').onsubmit = (e) => {
  e.preventDefault();
  const code = btoa(JSON.stringify({ nombre: e.target.nombre.value })).replace(/=+$/, '').replace(/[+]/g, '-').replace(/[/]/g, '_');
  location.href = ${JSON.stringify(back({}))} + '&code=' + code;
};
</script>
<a href="${back({ error: 'access_denied' })}">Cancelar</a>`);
  }
  res.setHeader('content-type', 'application/json');
  if (url.pathname === '/__facebook/graph/oauth/access_token') {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => res.end(JSON.stringify({ access_token: new URLSearchParams(raw).get('code'), token_type: 'bearer' })));
    return;
  }
  if (url.pathname === '/__facebook/graph/me') {
    const { nombre } = decode((req.headers.authorization ?? '').replace(/^Bearer /, ''));
    return res.end(
      JSON.stringify({ id: `fb-${nombre}`, name: nombre, picture: { data: { url: `http://localhost:${process.env.PORT ?? 8081}/__facebook/foto.png`, is_silhouette: false } } }),
    );
  }
  if (url.pathname === '/__facebook/foto.png') {
    res.setHeader('content-type', 'image/png');
    return res.end(FOTO);
  }
  res.writeHead(404);
  res.end('{}');
}
