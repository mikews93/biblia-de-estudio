import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// Diario devocional: lo que la persona escribe al terminar un devocional (la frase que la detuvo,
// su oración y el paso para hoy). Se guarda solo en el dispositivo, como las notas.

export type Entrada = {
  id: string;
  book: string;
  chapter: number;
  verse?: number;
  /** «Juan 3:16», para mostrarla sin cargar los libros. */
  reference: string;
  /** La palabra o frase que detuvo a la persona al meditar. */
  palabra: string;
  oracion: string;
  paso: string;
  /** Versículo para llevar durante el día, con su texto. */
  llevar?: { verse: number; text: string };
  created: number;
  /** Si la persona marcó que ya dio el paso. */
  hecho?: boolean;
};

const KEY = 'diario';

let state: Entrada[] = [];
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) state = JSON.parse(raw);
    })
    .catch(() => {})
    .then(() => listeners.forEach((l) => l()));
  return loaded;
}

function save(next: Entrada[]) {
  state = next;
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

/** Guarda la entrada (o la reemplaza si ya existe con el mismo id) y la deja la primera. */
export async function saveEntrada(entrada: Entrada) {
  await load();
  save([entrada, ...state.filter((e) => e.id !== entrada.id)]);
}

export async function toggleHecho(id: string) {
  await load();
  save(state.map((e) => (e.id === id ? { ...e, hecho: !e.hecho } : e)));
}

export async function deleteEntrada(id: string) {
  await load();
  save(state.filter((e) => e.id !== id));
}

/** Entradas del diario, de la más reciente a la más antigua. */
export function useDiario(): Entrada[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    load();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}

export type Devocional = {
  observa: string;
  medita: string[];
  ora: { label: string; text: string }[];
  vive: string[];
  llevar?: number;
};

const ORA_LABELS = ['Adora', 'Confiesa', 'Agradece', 'Pide'];

/** Separa la respuesta de la IA en los pasos del devocional; tolera que llegue a medias mientras se escribe. */
export function parseDevocional(text: string): Devocional {
  const sections: Record<string, string> = {};
  let current = '';
  for (const line of text.split('\n')) {
    const h = line.match(/^#{1,3}\s+(.+?)\s*$/);
    if (h) {
      current = h[1].toLowerCase();
      sections[current] = '';
    } else if (current) {
      sections[current] += line + '\n';
    }
  }
  const find = (word: string) => Object.entries(sections).find(([k]) => k.includes(word))?.[1] ?? '';
  const bullets = (s: string) =>
    s
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^[-*•]\s|^\d+[.)]\s/.test(l))
      .map((l) => l.replace(/^([-*•]|\d+[.)])\s+/, ''));
  const ora = bullets(find('ora')).map((line) => {
    const m = line.match(/^\**([A-Za-zÁÉÍÓÚáéíóúñ]+)\**\s*:\s*\**\s*(.*)$/);
    return m && ORA_LABELS.includes(m[1]) ? { label: m[1], text: m[2] } : { label: '', text: line };
  });
  const llevar = Number(find('llév').match(/\d+/)?.[0] ?? find('llev').match(/\d+/)?.[0]);
  return {
    observa: find('observa').trim(),
    medita: bullets(find('medita')),
    ora,
    vive: bullets(find('vive')),
    llevar: Number.isInteger(llevar) && llevar > 0 ? llevar : undefined,
  };
}
