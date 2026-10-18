import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

const light = {
  background: '#FBF8F3',
  surface: '#FFFFFF',
  text: '#1F1B16',
  muted: '#6B6358',
  border: '#E5DED3',
  accent: '#8A4B2A',
  accentSoft: '#F3E6DC',
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
  accent: '#8A4B2A',
  accentSoft: '#EADBC0',
  highlight: '#F2DFA6',
  greek: '#3D5470',
};

const dark: Colors = {
  background: '#151311',
  surface: '#1E1B18',
  text: '#EDE7DE',
  muted: '#A39A8E',
  border: '#36312B',
  accent: '#E0A07A',
  accentSoft: '#3A2A20',
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
};

const DEFAULTS: Settings = { theme: 'auto', fontSize: 19, font: 'serif', layout: 'parrafo', study: false, version: 'rv1909', enfoque: 'devocional' };
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

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(initialSettings);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setSettings((s) => ({ ...s, ...JSON.parse(raw) })))
      .catch(() => {});
  }, []);

  const update = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });

  return createElement(SettingsContext.Provider, { value: { settings, update } }, children);
}

export const useSettings = () => useContext(SettingsContext);

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

export const saveLastRead = (book: string, chapter: number) =>
  AsyncStorage.setItem(LAST, JSON.stringify({ book, chapter })).catch(() => {});

export async function getLastRead(): Promise<{ book: string; chapter: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
