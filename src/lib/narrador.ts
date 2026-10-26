import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';

import { pauseAudio } from './audio';
import { chunks, pickVoices } from './podcast';
import { paraHablar } from './voces';

// El narrador del Espacio Niños: lee en voz alta, con la voz del dispositivo, una lista de partes (la entrada de
// la historia, cada versículo, una pregunta) y avisa cuál suena para iluminarla. Un poco más lento que el pódcast,
// para oídos pequeños. Solo suena una cosa a la vez: empezar otra lectura corta la anterior.

const RITMO = 0.9;

let turno = 0;

export function callar() {
  turno++;
  Speech.stop();
}

/** Lee desde la parte «desde» hasta el final, o solo esa parte con «una». Sin «voz», la de Ana del pódcast. */
export async function narrar(
  partes: string[],
  alCambiar: (i: number | null) => void,
  desde = 0,
  una = false,
  opciones: { voz?: string; ritmo?: number } = {},
) {
  callar();
  pauseAudio();
  const mio = turno;
  const voz = opciones.voz ? { voice: opciones.voz, pitch: 1 } : (await pickVoices()).ana;
  const parte = (i: number) => {
    if (mio !== turno) return;
    if (i >= partes.length || (una && i > desde)) return alCambiar(null);
    alCambiar(i);
    const trozos = chunks(paraHablar(partes[i]));
    const decir = (j: number) => {
      if (mio !== turno) return;
      if (j >= trozos.length) return parte(i + 1);
      Speech.speak(trozos[j], {
        language: 'es',
        voice: voz.voice,
        pitch: voz.pitch,
        rate: opciones.ritmo ?? RITMO,
        onDone: () => decir(j + 1),
        onStopped: () => {
          if (mio === turno) alCambiar(null);
        },
        onError: () => {
          if (mio === turno) alCambiar(null);
        },
      });
    };
    decir(0);
  };
  parte(desde);
}

/** Lo que suena ahora (índice de la parte) y cómo empezar o parar. Se calla al salir de la pantalla. */
export function useNarrador(partes: string[]) {
  const [actual, setActual] = useState<number | null>(null);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      callar();
    };
  }, []);
  const cambiar = (i: number | null) => {
    if (vivo.current) setActual(i);
  };
  return {
    actual,
    sonando: actual !== null,
    leer: (desde = 0, una = false) => narrar(partes, cambiar, desde, una),
    parar: () => {
      callar();
      setActual(null);
    },
  };
}
