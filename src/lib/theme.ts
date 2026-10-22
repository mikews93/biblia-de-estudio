import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { cambio, registrar } from './sincronia';

const light = {
  background: '#F9F8F6',
  surface: '#FFFFFF',
  text: '#1C1B19',
  muted: '#6A6660',
  border: '#E3E0DB',
  accent: '#2A2826',
  accentSoft: '#ECEAE6',
  /** El toque cálido: solo en lo destacado (versículo del día, el día de hoy, el aviso de la campana). */
  warm: '#A8641F',
  warmSoft: '#F5E9D8',
  highlight: '#FFF1C7',
  greek: '#2F4A6B',
};

export type Colors = typeof light;

const sepia: Colors = {
  background: '#F4ECD8',
  surface: '#FBF5E6',
  text: '#3B2F22',
  muted: '#7A6A55',
  border: '#E0D3B8',
  accent: '#3E362E',
  accentSoft: '#E6DAC2',
  warm: '#9A5A1E',
  warmSoft: '#EED9B8',
  highlight: '#F2DFA6',
  greek: '#3D5470',
};

const dark: Colors = {
  background: '#131313',
  surface: '#1C1C1B',
  text: '#ECEAE6',
  muted: '#9D9A94',
  border: '#302F2D',
  accent: '#E6E3DE',
  accentSoft: '#2C2B29',
  warm: '#E2A868',
  warmSoft: '#36291B',
  highlight: '#4A3F1E',
  greek: '#9DB8D9',
};

export type ThemeName = 'auto' | 'claro' | 'sepia' | 'oscuro';

export type Settings = {
  theme: ThemeName;
  fontSize: number;
  font: 'serif' | 'sans';
  layout: 'parrafo' | 'versiculo';
  study: boolean;
  version: string;
  /** Último modo elegido en el estudio con IA. */
  enfoque: 'devocional' | 'profundo';
  /** Versiones elegidas para comparar (vacío: las de src/lib/comparar.ts). */
  comparar: string[];
  /** Para quién se ve la app: para todos, el Modo Jóvenes (src/lib/jovenes.ts) o el Espacio Niños (src/lib/ninos.ts). */
  modo: Modo;
};

export type Modo = 'general' | 'jovenes' | 'ninos';

const DEFAULTS: Settings = { theme: 'auto', fontSize: 19, font: 'serif', layout: 'parrafo', study: false, version: 'rv1909', enfoque: 'devocional', comparar: [], modo: 'general' };
const KEY = 'ajustes';

type Ctx = { settings: Settings; update: (patch: Partial<Settings>) => void };

const SettingsContext = createContext<Ctx>({ settings: DEFAULTS, update: () => {} });

/** En la web los ajustes se leen ya en el primer render: si no, la app se pinta un instante con el tema por defecto. */
function initialSettings(): Settings {
  if (Platform.OS !== 'web') return DEFAULTS;
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

// Los ajustes viven fuera de React para que la sincronía con la cuenta (sincronia.ts) los lea y los cambie.
let current: Settings = initialSettings();
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) current = { ...current, ...JSON.parse(raw) };
    })
    .catch(() => {})
    .then(() => listeners.forEach((l) => l()));
  return loaded;
}

function write(next: Settings) {
  current = next;
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  listeners.forEach((l) => l());
}

// En la cuenta cada ajuste es una entrada: cambiar la letra en el teléfono no pisa el tema elegido en el computador.
registrar<Settings>({
  nombre: 'ajustes',
  leer: () => load().then(() => current),
  escribir: write,
  partir: (s) => s,
  unir: (entradas) => ({ ...DEFAULTS, ...(entradas as Partial<Settings>) }),
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(current);

  useEffect(() => {
    const l = () => setSettings(current);
    listeners.add(l);
    load();
    return () => {
      listeners.delete(l);
    };
  }, []);

  const update = (patch: Partial<Settings>) => {
    write({ ...current, ...patch });
    cambio();
  };

  return createElement(SettingsContext.Provider, { value: { settings, update } }, children);
}

export const useSettings = () => useContext(SettingsContext);

/** Los ajustes fuera de React (por ejemplo, para saber el modo al pedir un estudio a la IA). */
export const getSettings = () => current;

export function useColors(): Colors {
  const scheme = useColorScheme();
  const { theme } = useSettings().settings;
  if (theme === 'sepia') return sepia;
  if (theme === 'oscuro' || (theme === 'auto' && scheme === 'dark')) return dark;
  return light;
}

export const isDark = (c: Colors) => c === dark;

export const serif = Platform.select({
  web: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
  ios: 'Georgia',
  default: 'serif',
});

export const sans = Platform.select({
  web: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  default: undefined,
});

export const themeSwatches: { name: ThemeName; label: string; colors: Colors | null }[] = [
  { name: 'auto', label: 'Auto', colors: null },
  { name: 'claro', label: 'Claro', colors: light },
  { name: 'sepia', label: 'Sepia', colors: sepia },
  { name: 'oscuro', label: 'Oscuro', colors: dark },
];

const LAST = 'ultima-lectura';

const lastListeners = new Set<(last: { book: string; chapter: number } | null) => void>();

export function saveLastRead(book: string, chapter: number) {
  cambio();
  return AsyncStorage.setItem(LAST, JSON.stringify({ book, chapter })).catch(() => {});
}

/** La última lectura; cambia si llega una más nueva de otro dispositivo. */
export function useLastRead() {
  const [last, setLast] = useState<{ book: string; chapter: number } | null>(null);
  useEffect(() => {
    getLastRead().then(setLast);
    lastListeners.add(setLast);
    return () => {
      lastListeners.delete(setLast);
    };
  }, []);
  return last;
}

export async function getLastRead(): Promise<{ book: string; chapter: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

registrar<{ book: string; chapter: number } | null>({
  nombre: 'ultima-lectura',
  leer: getLastRead,
  escribir: (last) => {
    if (last) AsyncStorage.setItem(LAST, JSON.stringify(last)).catch(() => {});
    else AsyncStorage.removeItem(LAST).catch(() => {});
    lastListeners.forEach((l) => l(last));
  },
  partir: (last) => (last ? { ultima: last } : {}),
  unir: (entradas) => (entradas.ultima as { book: string; chapter: number } | undefined) ?? null,
});
