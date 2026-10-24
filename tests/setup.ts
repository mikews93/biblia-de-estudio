// Sustitutos de los módulos nativos para correr src/lib en Node: AsyncStorage en memoria y lo mínimo de React Native.
import { beforeEach, vi } from 'vitest';

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => storage.get(k) ?? null,
    setItem: async (k: string, v: string) => void storage.set(k, v),
    removeItem: async (k: string) => void storage.delete(k),
    clear: async () => storage.clear(),
  },
}));

vi.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: () => ({ remove: () => {} }) },
  Platform: { OS: 'web', select: (o: Record<string, unknown>) => ('web' in o ? o.web : o.default) },
  Share: { share: vi.fn(async () => ({ action: 'sharedAction' })) },
  useColorScheme: () => 'light',
}));

vi.mock('expo-speech', () => ({
  getAvailableVoicesAsync: async () => [],
  speak: vi.fn(),
  stop: vi.fn(),
  VoiceQuality: { Default: 'Default', Enhanced: 'Enhanced' },
}));

vi.mock('expo-audio', () => ({ createAudioPlayer: vi.fn(), setAudioModeAsync: vi.fn(async () => {}) }));
vi.mock('expo-router', () => ({ router: { push: vi.fn(), replace: vi.fn() } }));

// Cada prueba empieza con el almacén vacío.
beforeEach(() => storage.clear());
