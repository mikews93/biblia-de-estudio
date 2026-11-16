// En Android y iPhone el fetch de React Native no deja leer el cuerpo por partes (res.body no existe) y la respuesta
// de la IA aparecía entera al final. El de expo/fetch sí lo entrega mientras llega. Ver porPartes.ts.
//
// Además se pide sin comprimir («Accept-Encoding: identity»). Sin esa cabecera expo/fetch pide «zstd, br, gzip» y en
// Android descomprime con BrotliInputStream, que espera a llenar su búfer (unos KB de texto) antes de entregar nada:
// la respuesta de una pregunta cabe entera ahí y salía de golpe al final, aunque el servidor la mandara por partes.
// El texto de la IA pesa poco; sin compresión llega cada trozo en cuanto sale.
import { fetch as expoFetch } from 'expo/fetch';

export const fetchPorPartes = ((input: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  headers.set('Accept-Encoding', 'identity');
  return expoFetch(input, { ...(init as object), headers } as never);
}) as unknown as typeof fetch;
