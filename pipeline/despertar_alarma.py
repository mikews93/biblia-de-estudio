"""Sonido de la alarma del despertador en la app nativa (assets/sonidos/amanecer.wav), hecho aquí con síntesis:
un acorde de Re que se abre y campanitas que suben, unos 9 segundos, sin derechos de nadie.

La música que suena después, en la pantalla /despertar, es public/audio/ambiente/amanecer.mp3 (pipeline/ambiente).

Uso: python3 pipeline/despertar_alarma.py   (necesita numpy)
"""

from pathlib import Path
import wave

import numpy as np

SR = 44100
ROOT = Path(__file__).resolve().parent.parent
rng = np.random.default_rng(7)


def hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def pad_voice(freq: float, n: int, detune_cents: float) -> np.ndarray:
    """Una nota de pad: tres senos un poco desafinados y un armónico suave, con un vaivén lento."""
    t = np.arange(n) / SR
    out = np.zeros(n)
    for cents, amp in ((-detune_cents, 1.0), (0.0, 0.8), (detune_cents, 1.0)):
        f = freq * 2 ** (cents / 1200)
        phase = rng.uniform(0, 2 * np.pi)
        out += amp * np.sin(2 * np.pi * f * t + phase)
        out += 0.18 * amp * np.sin(2 * np.pi * 2 * f * t + phase * 1.3)
    wobble = 1 + 0.12 * np.sin(2 * np.pi * rng.uniform(0.05, 0.11) * t + rng.uniform(0, 6))
    return out * wobble


def envelope(n: int, attack: float, release: float) -> np.ndarray:
    env = np.ones(n)
    a, r = int(attack * SR), int(release * SR)
    env[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    env[-r:] = np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return env


def bell(freq: float, seconds: float) -> np.ndarray:
    n = int(seconds * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2.01 * t) * np.exp(-t * 3)
    return tone * np.exp(-t * 1.6) * np.minimum(1, t * 400)


def reverb(x: np.ndarray, seconds=4.5) -> np.ndarray:
    """Sala grande: convolución con ruido que se apaga (en bucle, para que el final empalme con el comienzo)."""
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 6.5 / seconds)
    ir[0] = 0
    size = len(x)
    spec = np.fft.rfft(x, size) * np.fft.rfft(ir, size)
    wet = np.fft.irfft(spec, size)  # circular: la cola del final cae sobre el comienzo
    wet /= np.max(np.abs(wet)) + 1e-9
    return wet


def alarm() -> np.ndarray:
    """Unos 9 segundos: un acorde que se abre y campanitas que suben (Re · Fa# · La · Re · Mi · Fa#)."""
    n = int(9 * SR)
    out = np.zeros(n)
    env = envelope(n, 2.5, 3.0)
    for note in (50, 57, 62, 66):
        out += pad_voice(hz(note), n, 8) * env * 0.35
    for i, note in enumerate((74, 78, 81, 86, 88, 90)):
        b = bell(hz(note), 4.0) * 0.5
        at = int((0.6 + i * 0.75) * SR)
        end = min(n, at + len(b))
        out[at:end] += b[: end - at]
    out = 0.7 * out + 0.5 * reverb(out, 2.5)
    out *= envelope(n, 0.05, 1.5)
    return out / np.max(np.abs(out)) * 0.8


def write_wav(path: Path, data: np.ndarray):
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(data, -1, 1) * 32767).astype('<i2')
    channels = 1 if pcm.ndim == 1 else pcm.shape[0]
    frames = pcm if pcm.ndim == 1 else pcm.T.reshape(-1)
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(frames.tobytes())


if __name__ == '__main__':
    write_wav(ROOT / 'assets' / 'sonidos' / 'amanecer.wav', alarm())
    print('listo: assets/sonidos/amanecer.wav')
