// En Android y iPhone el fetch de React Native no deja leer el cuerpo por partes (res.body no existe) y la respuesta
// de la IA aparecía entera al final. El de expo/fetch sí lo entrega mientras llega. Ver porPartes.ts.
import { fetch as expoFetch } from 'expo/fetch';

export const fetchPorPartes = expoFetch as unknown as typeof fetch;
