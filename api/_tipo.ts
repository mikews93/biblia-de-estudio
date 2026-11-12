// ¿Lo que se escribió en el buscador es una pregunta o una búsqueda de pasajes? (api/buscar.ts, modo rápido)
// 1. Un versículo recordado casi palabra por palabra («porque de tal manera amó Dios al mundo») es un versículo.
// 2. Lo que las reglas de src/lib/preguntarTexto.ts reconocen (signos, «qué», «de quién»…) es una pregunta.
// 3. Lo demás desde cuatro palabras («los animales van al cielo», «Caín tenía miedo de los demás») lo decide un modelo
//    pequeño y barato de Claude en una sola palabra. Si no responde a tiempo, es búsqueda.
// El modelo de vectores de la búsqueda rápida no sirve para esto: agrupa por tema, no por forma (se probó con 149
// ejemplos el 2026-11-02 y acertó menos que las reglas).
import Anthropic from '@anthropic-ai/sdk';

import { conClaude } from './_quilate';
import { esPregunta, sinAcentos } from '../src/lib/preguntarTexto';

export type Tipo = 'pregunta' | 'versiculo' | 'busqueda';

const MODEL = process.env.TIPO_MODEL ?? 'claude-haiku-5-5';
const ESPERA_MS = Number(process.env.TIPO_ESPERA_MS ?? 2500);
// Tope por instancia y día: si alguien abusa, el buscador sigue igual que antes (solo reglas).
const TOPE_DIA = Number(process.env.TIPO_TOPE_DIA ?? 4000);

const SYSTEM = `Clasificas lo que alguien escribió o dictó en el buscador de una app bíblica en español, a veces sin signos ni tildes.
- «pregunta»: espera una respuesta o una explicación («los animales van al cielo», «caín tenía miedo de quién», «el modalismo es herejía», «explícame el bautismo»).
- «busqueda»: quiere encontrar pasajes: un versículo que recuerda (aunque no sea exacto), un tema o una idea («cuando tengo miedo de noche», «la armadura de Dios», «versículos para un funeral», «dios cuida de los pájaros»).
Responde solo con la palabra.`;

const cache = new Map<string, Tipo>();
let dia = '';
let usados = 0;
let client: Anthropic | null = null;

const palabras = (t: string) => sinAcentos(t).split(' ').filter(Boolean).length;

/** Pregunta al modelo; «busqueda» si no responde a tiempo, falla o se pasó el tope del día. */
async function clasificar(query: string): Promise<Tipo> {
  const key = sinAcentos(query);
  const hit = cache.get(key);
  if (hit) return hit;
  const hoy = new Date().toISOString().slice(0, 10);
  if (hoy !== dia) [dia, usados] = [hoy, 0];
  if (usados >= TOPE_DIA || !process.env.ANTHROPIC_API_KEY) return 'busqueda';
  usados++;
  const ia = (client ??= new Anthropic());
  try {
    const pedido = query.slice(0, 300);
    const res = await conClaude('Tipo de búsqueda', { fn: 'buscar', model: MODEL, input: pedido }, () =>
      ia.messages.create(
        {
          model: MODEL,
          max_tokens: 5,
          system: SYSTEM,
          messages: [{ role: 'user', content: pedido }],
        },
        { timeout: ESPERA_MS, maxRetries: 0 },
      ),
    );
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').toLowerCase();
    const tipo: Tipo = text.includes('pregunta') ? 'pregunta' : 'busqueda';
    if (cache.size > 2000) cache.clear();
    cache.set(key, tipo);
    return tipo;
  } catch (err) {
    console.error('buscar: tipo', err);
    return 'busqueda';
  }
}

/**
 * El tipo de lo buscado, cuando ya se sabe si la búsqueda encontró el versículo recordado. Un versículo o lo que
 * reconocen las reglas no llaman al modelo; tampoco lo de menos de cuatro palabras («la ansiedad»).
 */
export async function tipoDe(query: string, recordado: boolean): Promise<Tipo> {
  if (recordado) return 'versiculo';
  if (esPregunta(query)) return 'pregunta';
  return palabras(query) >= 4 ? clasificar(query) : 'busqueda';
}

/** Solo para las pruebas. */
export function resetTipo() {
  cache.clear();
  usados = 0;
  client = null;
}
