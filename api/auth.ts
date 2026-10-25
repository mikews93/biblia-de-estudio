// Entrar con Google, Apple o Facebook (Auth.js): el inicio del viaje, la vuelta de cada proveedor y la página final.
// vercel.json reescribe /api/auth/<ruta> aquí. Todo vive en authRoute de /api/comunidades, donde están las cuentas.
import { authRoute } from './comunidades';

export const GET = authRoute;
export const POST = authRoute;
