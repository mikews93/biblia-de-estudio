// La ronda de avisos (recordatorio diario, despertador, «10 minutos más» y racha) servida desde Cloud Run.
//
// Por qué: el despertador necesita una ronda cada minuto, y en Vercel esa llamada constante gastaba buena parte de las
// 4 h de CPU del plan gratis (si se pasan, Vercel pausa todos los proyectos del equipo). Aquí corre el mismo código de
// api/notificaciones.ts, llamado cada minuto por Cloud Scheduler, y Vercel queda solo para lo que piden las personas.
//
// Sin llave propia: el servicio de Cloud Run no admite llamadas anónimas y Cloud Scheduler entra con su cuenta de
// servicio (OIDC). Ver servidor/README.md.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { GET } from '../api/notificaciones';

async function responder(req: IncomingMessage, res: ServerResponse) {
  const ruta = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (ruta !== '/') return void res.writeHead(404).end();
  if (req.method !== 'GET' && req.method !== 'POST') return void res.writeHead(405, { Allow: 'GET, POST' }).end();
  const r = await GET(new Request('http://localhost/api/notificaciones?accion=enviar'));
  res.writeHead(r.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(await r.text());
}

export function crearServidor() {
  return createServer((req, res) => {
    responder(req, res).catch((err) => {
      console.error('avisos', err);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
}

// Al correr como programa (la imagen de Cloud Run), escucha en el puerto que da Cloud Run.
if (process.env.AVISOS_ESCUCHAR === '1') {
  const port = Number(process.env.PORT ?? 8080);
  crearServidor().listen(port, () => console.log(`avisos en el puerto ${port}`));
}
