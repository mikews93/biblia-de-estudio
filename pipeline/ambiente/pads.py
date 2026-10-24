"""Pads de ambiente para estudiar (Mike, 24-10): música suave que suena debajo del devocional, el estudio profundo
y el modo presentar del Taller. Se sintetizan aquí, sin servicios ni licencias: acordes lentos con armónicos suaves,
un poco desafinados para que respiren, y una reverberación larga.

Cada pista dura LOOP segundos y se repite sin costura: las envolventes y la reverberación dan la vuelta al final
(convolución circular). El archivo lleva COLA segundos más, iguales al principio, para que la app pueda empezar la
vuelta siguiente un poco antes y cruzar las dos sin el hueco que deja el MP3 al repetirse.

    python3 pipeline/ambiente/pads.py        # escribe public/audio/ambiente/<id>.mp3
"""

import math
import os
import subprocess
import sys

import numpy as np

SR = 44100
COLA = 6.0
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'audio', 'ambiente')


def hz(nota: str) -> float:
    """'D3' → frecuencia. Sostenidos con #."""
    nombres = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    n = nombres[nota[0]] + (1 if '#' in nota else 0) - (1 if nota[1] == 'b' else 0)
    octava = int(nota[-1])
    return 440.0 * 2 ** ((n + 12 * (octava + 1) - 69) / 12)


def ventana(n: int) -> np.ndarray:
    """Subida y bajada de coseno: cada acorde entra y sale sin golpe."""
    return 0.5 - 0.5 * np.cos(2 * np.pi * np.arange(n) / n)


def pad(total: int, acordes, dur: float, brillo: float, rng) -> np.ndarray:
    """Acordes que se funden entre sí. brillo: cuánto pesan los armónicos altos (0 oscuro, 1 claro)."""
    out = np.zeros((2, total))
    largo = int(dur * 1.6 * SR)  # cada acorde dura más que su turno: se solapa con los vecinos
    t = np.arange(largo) / SR
    env = ventana(largo)
    for i, notas in enumerate(acordes):
        inicio = int((i * dur - dur * 0.3) * SR)
        idx = (inicio + np.arange(largo)) % total
        for nota in notas:
            f0 = hz(nota)
            peso = 1.0 if f0 < 400 else 0.7
            for canal in range(2):
                s = np.zeros(largo)
                for k in range(1, 9):
                    amp = (1 / k ** (2.2 - brillo)) * peso
                    if f0 * k > 5000:
                        break
                    for cents in (-6, 0, 6):
                        det = cents + rng.uniform(-2, 2) + (3 if canal else -3)
                        f = f0 * k * 2 ** (det / 1200)
                        # vibrato muy lento para que el sonido no quede quieto
                        lfo = 0.0015 * np.sin(2 * np.pi * rng.uniform(0.05, 0.12) * t + rng.uniform(0, 6.28))
                        s += amp * np.sin(2 * np.pi * f * t * (1 + lfo) + rng.uniform(0, 2 * np.pi))
                np.add.at(out[canal], idx, s * env)
    return out


def campanas(total: int, notas, cuantas: int, rng) -> np.ndarray:
    """Notas sueltas de campana suave (seno con armónico de octava y caída larga)."""
    out = np.zeros((2, total))
    largo = int(5 * SR)
    t = np.arange(largo) / SR
    for _ in range(cuantas):
        f = hz(rng.choice(notas))
        s = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2.01 * f * t)) * np.exp(-t / 1.4)
        s *= np.minimum(1, t / 0.02)
        inicio = int(rng.uniform(0, total))
        idx = (inicio + np.arange(largo)) % total
        pan = rng.uniform(0.2, 0.8)
        np.add.at(out[0], idx, s * (1 - pan) * 0.5)
        np.add.at(out[1], idx, s * pan * 0.5)
    return out


def reverb(x: np.ndarray, segundos: float, mezcla: float, rng) -> np.ndarray:
    """Reverberación de ruido que se apaga, aplicada en círculo para que la cola del final suene al principio."""
    total = x.shape[1]
    n = int(segundos * SR)
    t = np.arange(n) / SR
    out = np.empty_like(x)
    for c in range(2):
        ir = rng.standard_normal(n) * np.exp(-t * 6.9 / segundos)
        # quitar agudos de la cola: suena a sala grande, no a siseo
        ir = np.convolve(ir, np.ones(24) / 24, mode='same')
        ir /= np.sqrt(np.sum(ir ** 2))
        h = np.zeros(total)
        h[:n] = ir
        wet = np.fft.irfft(np.fft.rfft(x[c]) * np.fft.rfft(h), total)
        out[c] = (1 - mezcla) * x[c] + mezcla * wet * 3
    return out


def suavizar(x: np.ndarray, hz_corte: float) -> np.ndarray:
    """Filtro paso bajo en círculo (en frecuencia), con caída suave."""
    total = x.shape[1]
    f = np.fft.rfftfreq(total, 1 / SR)
    g = 1 / np.sqrt(1 + (f / hz_corte) ** 4)
    return np.fft.irfft(np.fft.rfft(x, axis=1) * g, total, axis=1)


PISTAS = {
    # Re mayor cálido: lo de siempre para el devocional.
    'quietud': dict(
        acordes=[['D3', 'A3', 'E4', 'F#4'], ['B2', 'F#3', 'D4', 'A4'], ['G2', 'D3', 'B3', 'F#4'], ['A2', 'E3', 'D4', 'E4']],
        dur=16, brillo=0.5, corte=2400, reverb=5.0, mezcla=0.55,
    ),
    # Sol con notas de campana sueltas, más clara: para empezar el día.
    'amanecer': dict(
        acordes=[['G3', 'D4', 'A4', 'B4'], ['E3', 'B3', 'G4', 'D5'], ['C3', 'G3', 'E4', 'B4'], ['D3', 'A3', 'F#4', 'A4']],
        dur=15, brillo=0.8, corte=3600, reverb=5.5, mezcla=0.55,
        campanas=(['G5', 'A5', 'B5', 'D6', 'E6'], 9),
    ),
    # La menor grave y lento: estudio de noche, concentración.
    'noche': dict(
        acordes=[['A2', 'E3', 'C4', 'B4'], ['F2', 'C3', 'A3', 'E4'], ['C3', 'G3', 'E4', 'D4'], ['E2', 'B2', 'G3', 'D4']],
        dur=18, brillo=0.25, corte=1400, reverb=6.0, mezcla=0.6,
    ),
    # Una nota que casi no cambia: debajo de la voz al presentar, sin distraer.
    'presencia': dict(
        acordes=[['E2', 'B2', 'E3', 'G#3'], ['E2', 'B2', 'E3', 'F#3', 'B3'], ['E2', 'B2', 'E3', 'G#3'], ['E2', 'B2', 'C#4', 'E3']],
        dur=16, brillo=0.35, corte=1800, reverb=6.0, mezcla=0.6,
    ),
}


def render(nombre: str, p: dict) -> np.ndarray:
    rng = np.random.default_rng(sum(map(ord, nombre)))
    total = int(len(p['acordes']) * p['dur'] * SR)
    x = pad(total, p['acordes'], p['dur'], p['brillo'], rng)
    if 'campanas' in p:
        notas, cuantas = p['campanas']
        x += campanas(total, notas, cuantas, rng) * np.max(np.abs(x)) * 0.35
    x = suavizar(x, p['corte'])
    x = reverb(x, p['reverb'], p['mezcla'], rng)
    x -= x.mean(axis=1, keepdims=True)
    # -20 dBFS de media: suave de por sí; la app lo baja más con su volumen
    x *= 10 ** (-20 / 20) / np.sqrt(np.mean(x ** 2))
    pico = np.max(np.abs(x))
    if pico > 0.89:
        x = np.tanh(x / 0.89) * 0.89
    cola = x[:, : int(COLA * SR)]
    return np.concatenate([x, cola], axis=1)


def main():
    os.makedirs(OUT, exist_ok=True)
    solo = sys.argv[1:]
    for nombre, p in PISTAS.items():
        if solo and nombre not in solo:
            continue
        x = render(nombre, p)
        pcm = (np.clip(x.T, -1, 1) * 32767).astype('<i2').tobytes()
        dest = os.path.join(OUT, f'{nombre}.mp3')
        subprocess.run(
            ['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-',
             '-c:a', 'libmp3lame', '-b:a', '112k', dest],
            input=pcm, check=True,
        )
        print(nombre, f'{x.shape[1] / SR:.1f} s', f'{os.path.getsize(dest) / 1e6:.2f} MB')


if __name__ == '__main__':
    main()
