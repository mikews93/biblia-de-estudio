// Entrar con Google, Apple y Facebook con Auth.js (@auth/core). Auth.js hace solo el viaje de OAuth: el estado,
// PKCE, el nonce, la vuelta de Apple por POST y comprobar el id_token de Google y Apple. Las cuentas y las sesiones
// siguen siendo las de /api/comunidades: al volver, el callback signIn de Auth.js entrega a comunidades quién es la
// persona en el proveedor y redirige a /api/auth/listo sin crear una sesión de Auth.js.
//
// Todo vive en una sola función de Vercel (api/auth.ts): vercel.json reescribe /api/auth/<ruta> a /api/auth?ruta=<ruta>.
//
// Variables en Vercel (ninguna va en el repositorio):
// - AUTH_SECRET: cualquier texto largo al azar; Auth.js firma con él sus cookies del viaje.
// - Google: AUTH_GOOGLE_ID y AUTH_GOOGLE_SECRET (cliente OAuth «Aplicación web» en Google Cloud).
// - Apple: AUTH_APPLE_ID (el Services ID), AUTH_APPLE_TEAM_ID, AUTH_APPLE_KEY_ID y AUTH_APPLE_PRIVATE_KEY (el .p8);
//   el «client secret» de Apple es un JWT que caduca, así que se firma aquí en cada viaje.
// - Facebook: FACEBOOK_APP_ID y FACEBOOK_APP_SECRET. Solo se piden public_profile y email (sin revisión de Meta).
// La URI de vuelta de cada proveedor es https://<dominio>/api/auth/callback/<google|apple|facebook>.

// @auth/core solo se publica como módulo ES y Vercel compila la API a CommonJS: se carga al usarse, no al
// importar este archivo, para que si falla se caiga solo la entrada con cuentas y no todo /api/comunidades.
import type { AuthConfig } from '@auth/core';
import { createHmac, createPrivateKey, sign } from 'node:crypto';

const cargarAuth = () =>
  Promise.all([
    import('@auth/core'),
    import('@auth/core/providers/apple'),
    import('@auth/core/providers/facebook'),
    import('@auth/core/providers/google'),
  ]).then(([core, apple, facebook, google]) => ({ core, Apple: apple.default, Facebook: facebook.default, Google: google.default }));
type AuthJs = Awaited<ReturnType<typeof cargarAuth>>;

export const PROVEEDORES = ['google', 'apple', 'facebook'] as const;
export type Proveedor = (typeof PROVEEDORES)[number];
export const NOMBRE: Record<Proveedor, string> = { google: 'Google', apple: 'Apple', facebook: 'Facebook' };
export const esProveedor = (p: unknown): p is Proveedor => PROVEEDORES.includes(p as Proveedor);

const env = process.env;
const SECRET = env.AUTH_SECRET;
const GOOGLE_ID = env.AUTH_GOOGLE_ID;
const GOOGLE_SECRET = env.AUTH_GOOGLE_SECRET;
const APPLE_ID = env.AUTH_APPLE_ID;
const APPLE_TEAM = env.AUTH_APPLE_TEAM_ID;
const APPLE_KEY_ID = env.AUTH_APPLE_KEY_ID;
// Vercel guarda la llave en una línea: los \n escritos a mano vuelven a ser saltos.
const APPLE_KEY = env.AUTH_APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const FB_ID = env.FACEBOOK_APP_ID ?? env.AUTH_FACEBOOK_ID;
const FB_SECRET = env.FACEBOOK_APP_SECRET ?? env.AUTH_FACEBOOK_SECRET;
const FB_VERSION = env.FACEBOOK_API_VERSION ?? 'v26.0';
// Para las pruebas: un Facebook simulado (e2e/support/mock-facebook.ts).
const FB_DIALOG = env.FACEBOOK_DIALOG_URL ?? `https://www.facebook.com/${FB_VERSION}/dialog/oauth`;
const FB_GRAPH = env.FACEBOOK_GRAPH_URL ?? `https://graph.facebook.com/${FB_VERSION}`;

/** Qué proveedores tienen sus claves en el servidor. */
export function proveedoresListos(): Record<Proveedor, boolean> {
  const base = Boolean(SECRET);
  return {
    google: base && Boolean(GOOGLE_ID && GOOGLE_SECRET),
    apple: base && Boolean(APPLE_ID && APPLE_TEAM && APPLE_KEY_ID && APPLE_KEY),
    facebook: base && Boolean(FB_ID && FB_SECRET),
  };
}

/** El «client secret» de Apple: un JWT ES256 firmado con la llave .p8, válido una hora. */
function appleSecret() {
  const b64 = (v: object | Buffer) => (Buffer.isBuffer(v) ? v : Buffer.from(JSON.stringify(v))).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = `${b64({ alg: 'ES256', kid: APPLE_KEY_ID })}.${b64({ iss: APPLE_TEAM, iat: now, exp: now + 3600, aud: 'https://appleid.apple.com', sub: APPLE_ID })}`;
  const firma = sign('sha256', Buffer.from(data), { key: createPrivateKey(APPLE_KEY!), dsaEncoding: 'ieee-p1363' });
  return `${data}.${b64(firma)}`;
}

/** Quién es la persona en el proveedor, como lo recibe comunidades. */
export type Externo = { proveedor: Proveedor; id: string; nombre: string; correo: string | null; foto: string | null };

type FbPerfil = { id: string; name?: string; email?: string; picture?: { data?: { url?: string; is_silhouette?: boolean } } };

function providers({ Apple, Facebook, Google }: AuthJs, listos: Record<Proveedor, boolean>) {
  const list: AuthConfig['providers'] = [];
  if (listos.google) list.push(Google({ clientId: GOOGLE_ID, clientSecret: GOOGLE_SECRET }));
  if (listos.apple) {
    try {
      list.push(Apple({ clientId: APPLE_ID, clientSecret: appleSecret() }));
    } catch (err) {
      // Una llave .p8 mal copiada no debe tumbar Google ni Facebook.
      console.error('auth: la llave de Apple no sirve', err);
    }
  }
  if (listos.facebook) {
    list.push(
      Facebook({
        clientId: FB_ID,
        clientSecret: FB_SECRET,
        authorization: { url: FB_DIALOG, params: { scope: 'public_profile email' } },
        token: `${FB_GRAPH}/oauth/access_token`,
        userinfo: {
          url: `${FB_GRAPH}/me`,
          async request({ tokens }: { tokens: { access_token?: string } }) {
            const token = tokens.access_token ?? '';
            const q = new URLSearchParams({
              fields: 'id,name,email,picture.width(512).height(512)',
              appsecret_proof: createHmac('sha256', FB_SECRET!).update(token).digest('hex'),
            });
            const res = await fetch(`${FB_GRAPH}/me?${q}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
            return res.json();
          },
        },
        profile: (p: FbPerfil) => ({
          id: String(p.id),
          name: p.name ?? null,
          email: p.email ?? null,
          image: p.picture?.data?.url && !p.picture.data.is_silhouette ? p.picture.data.url : null,
        }),
      }),
    );
  }
  return list;
}

// Las cookies del viaje van con SameSite=None: Apple vuelve con un POST desde su dominio.
const cookie = (name: string) => ({
  name: `zarza-auth.${name}`,
  options: { httpOnly: true, sameSite: 'none' as const, path: '/api/auth', secure: true },
});

/**
 * Pasa la petición a Auth.js. alVolver recibe a la persona cuando el proveedor la devuelve y responde a qué
 * dirección mandarla (siempre /api/auth/listo); si falla, Auth.js manda a /api/auth/listo?error=….
 */
export async function authJs(request: Request, alVolver: (externo: Externo) => Promise<string>) {
  const auth = await cargarAuth();
  return auth.core.Auth(request, {
    providers: providers(auth, proveedoresListos()),
    secret: SECRET,
    basePath: '/api/auth',
    trustHost: true,
    skipCSRFCheck: auth.core.skipCSRFCheck,
    pages: { error: '/api/auth/listo', signIn: '/api/auth/listo' },
    cookies: {
      state: cookie('state'),
      nonce: cookie('nonce'),
      pkceCodeVerifier: cookie('pkce'),
      callbackUrl: cookie('callback-url'),
      csrfToken: cookie('csrf'),
      sessionToken: cookie('session'),
    },
    logger: { error: (e) => console.error('auth', e.name, e.message), warn: () => {}, debug: () => {} },
    callbacks: {
      async signIn({ user, account }) {
        if (!account || !esProveedor(account.provider)) return false;
        let foto = user.image ?? null;
        // Google da la foto a 96 px: se pide más grande para el perfil.
        if (foto && account.provider === 'google') foto = foto.replace(/=s\d+-c$/, '=s512-c');
        const nombre = (user.name ?? '').trim();
        return alVolver({
          proveedor: account.provider,
          id: String(account.providerAccountId),
          // Apple solo manda el nombre la primera vez y a veces en su lugar el correo.
          nombre: (nombre && !nombre.includes('@') ? nombre : '').slice(0, 40),
          correo: user.email?.trim().toLowerCase() || null,
          foto,
        });
      },
    },
  });
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * La página que ve la persona al volver del proveedor. En una ventana aparte se cierra sola (la app ya está
 * esperando el resultado); en la misma pestaña vuelve a la pantalla de la app; en la app nativa abre la app.
 */
export function paginaVuelta(ok: boolean, titulo: string, texto: string, volver: string, nativo = false) {
  const destino = nativo ? 'bibliadeestudio://vuelta' : volver;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(titulo)} · Zarza</title><style>
:root{color-scheme:light dark;--bg:#F9F8F6;--card:#FFFFFF;--fg:#1C1B19;--muted:#6A6660;--line:#E3E0DB;--btn:#2A2826;--on:#fff;--warm:#A8641F;--soft:#F5E9D8}
@media (prefers-color-scheme:dark){:root{--bg:#131313;--card:#1C1C1B;--fg:#ECEAE6;--muted:#9D9A94;--line:#302F2D;--btn:#E6E3DE;--on:#131313;--warm:#E2A868;--soft:#36291B}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font-family:system-ui,-apple-system,sans-serif;padding:24px}
main{background:var(--card);border:1px solid var(--line);border-radius:24px;padding:36px 28px 28px;max-width:380px;width:100%;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.06)}
.sello{width:64px;height:64px;border-radius:32px;background:var(--soft);display:grid;place-items:center;margin:0 auto 18px}
h1{font-family:Georgia,'Times New Roman',serif;font-size:26px;margin:0 0 10px}p{color:var(--muted);line-height:1.55;margin:0 0 24px;font-size:15px}
a{display:block;background:var(--btn);color:var(--on);text-decoration:none;font-weight:700;padding:14px 22px;border-radius:24px}
small{display:block;margin-top:14px;color:var(--muted);font-size:13px}
</style></head><body><main>
<div class="sello">${
    ok
      ? '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--warm)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
      : '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--warm)" stroke-width="2.2" stroke-linecap="round"><path d="M12 7v6M12 16.5v.5"/><circle cx="12" cy="12" r="9.5"/></svg>'
  }</div>
<h1>${escape(titulo)}</h1><p>${escape(texto)}</p><a href="${escape(destino)}">Volver a Zarza</a>
${ok ? '<small>Esta ventana se cierra sola.</small>' : ''}</main>
<script>try{if(${nativo}){location.replace(${JSON.stringify(destino)})}else if(window.opener){setTimeout(function(){window.close()},${ok ? 600 : 2500})}else if(sessionStorage.getItem('entrar-misma-pestana')){location.replace(${JSON.stringify(volver)})}}catch(e){}</script>
</body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
