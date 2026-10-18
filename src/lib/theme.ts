import { createContext, useContext } from 'react';
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
};

const dark: typeof light = {
  background: '#151311',
  surface: '#1E1B18',
  text: '#EDE7DE',
  muted: '#A39A8E',
  border: '#36312B',
  accent: '#E0A07A',
  accentSoft: '#3A2A20',
  highlight: '#4A3F1E',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const FontSizeContext = createContext<{ size: number; setSize: (n: number) => void }>({
  size: 19,
  setSize: () => {},
});

export const useFontSize = () => useContext(FontSizeContext);

export const serif = Platform.select({
  web: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
  ios: 'Georgia',
  default: 'serif',
});
