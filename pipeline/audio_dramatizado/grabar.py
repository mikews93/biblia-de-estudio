"""Graba un capítulo dramatizado con ElevenLabs a partir de su guion (pipeline/audio_dramatizado/<libro>-<cap>.json).

  python3 pipeline/audio_dramatizado/grabar.py mrk-1 [--revisar]

- Comprueba que el texto de cada versículo sea el de la Biblia (Español Sencillo), salvo las correcciones anotadas.
- Elige las voces que no estén fijadas en el guion en la biblioteca de ElevenLabs (voces nativas en español).
- Graba cada versículo con Text to Dialogue (eleven_v4), los efectos y ambientes con Sound Effects y la música con
  Eleven Music. Cada pieza se guarda en caché por su contenido: cambiar un versículo solo vuelve a grabar ese versículo.
- Mezcla todo con ffmpeg y deja en pipeline/audio_dramatizado/salida/: <id>.mp3, <id>.json (tiempos por versículo y
  créditos) e informe.json (voces, costo y avisos).

Con --revisar solo valida el guion y calcula los caracteres, sin llamar a ElevenLabs.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
CACHE = ROOT / 'pipeline' / '.cache' / 'eleven'
OUT = HERE / 'salida'
API = 'https://api.elevenlabs.io/v1'
KEY = os.environ.get('ELEVENLABS_API_KEY', '')
FORMAT = 'mp3_44100_128'

GAP = 0.35  # silencio entre versículos
SCENE_GAP = 2.0
AMBIENT_DB = -24
FX_DB = -10
MUSIC_DB = -15
# Acentos de Hispanoamérica primero: la app la leen sobre todo hispanohablantes de América.
LATIN = ('latin', 'mexic', 'colombia', 'argentin', 'venezuel', 'peru', 'chile', 'caribbean', 'central american')

warnings: list[str] = []
spent: list[dict] = []  # créditos que cobró ElevenLabs por cada pieza nueva


def notice(kind: str, msg: str) -> None:
    """Anotación de GitHub Actions (se lee desde la API de check-runs) y línea normal en local."""
    flat = msg.replace('%', '%25').replace('\r', '').replace('\n', '%0A')
    print(f'::{kind}::{flat}' if os.environ.get('GITHUB_ACTIONS') else f'[{kind}] {msg}', flush=True)


# ---------------------------------------------------------------- texto

def bible_text(book: str, chapter: int) -> dict[int, str]:
    data = json.load(gzip.open(ROOT / 'pipeline' / 'versions' / 'bes.json.gz'))
    ch = data[book][str(chapter)]
    return {int(v[0]): v[1] for v in ch} if isinstance(ch, list) else {int(k): v for k, v in ch.items()}


def norm(s: str) -> str:
    return ' '.join(s.replace('“', '').replace('”', '').replace('"', '').split()).lower()


def check_text(guion: dict) -> None:
    """El guion no puede añadir ni quitar nada al texto bíblico (las correcciones anotadas aparte)."""
    verses = bible_text(guion['libro'], guion['capitulo'])
    seen: set[int] = set()
    errors = []
    for scene in guion['escenas']:
        for step in scene['pasos']:
            if 'v' not in step:
                continue
            v = step['v']
            seen.add(v)
            said = norm(' '.join(l['texto'] for l in step['lineas']))  # una línea a coro cuenta una vez
            if said != norm(verses[v]) and str(v) not in guion.get('correcciones', {}):
                errors.append(f'v.{v}: el guion dice «{said}» y la Biblia «{norm(verses[v])}»')
    missing = sorted(set(verses) - seen)
    if missing:
        errors.append(f'faltan versículos: {missing}')
    if errors:
        notice('error', 'El texto del guion no coincide con la Biblia:\n' + '\n'.join(errors))
        sys.exit(1)


# ---------------------------------------------------------------- ElevenLabs

def call(method: str, path: str, body: dict | None = None, query: dict | None = None, raw: bool = False):
    url = f'{API}/{path}'
    if query:
        url += '?' + urllib.parse.urlencode({k: v for k, v in query.items() if v is not None})
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={'xi-api-key': KEY, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=300) as res:
            payload = res.read()
            cost = res.headers.get('character-cost') or res.headers.get('x-character-count')
            if method == 'POST' and cost:
                spent.append({'pieza': path, 'creditos': int(float(cost))})
    except urllib.error.HTTPError as err:
        detail = err.read().decode(errors='replace')[:500]
        raise RuntimeError(f'{method} {path} → {err.code}: {detail}') from None
    return payload if raw else json.loads(payload)


def cached(kind: str, request: dict, make) -> Path | None:
    """Pieza de audio guardada por el hash de su petición; se graba solo si no existe."""
    key = hashlib.sha256(json.dumps([kind, request], sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:20]
    path = CACHE / f'{kind}-{key}.mp3'
    if path.exists():
        return path
    try:
        audio = make()
    except RuntimeError as err:
        if kind == 'dialogo':
            raise
        warnings.append(f'{kind} sin grabar ({request.get("text") or request.get("prompt")}): {err}')
        return None
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_bytes(audio)
    return path


def dialogue(inputs: list[dict], guion: dict) -> Path:
    body = {'inputs': inputs, 'model_id': guion['modelo'], 'language_code': guion['idioma'], 'seed': 7}
    return cached('dialogo', body, lambda: call('POST', 'text-to-dialogue', body, {'output_format': FORMAT}, raw=True))


def sound(prompt: str, seconds: float | None, loop: bool = False) -> Path | None:
    body = {'text': prompt, 'duration_seconds': seconds, 'prompt_influence': 0.5, 'loop': loop}
    return cached('efecto', body, lambda: call('POST', 'sound-generation', body, {'output_format': FORMAT}, raw=True))


def music(prompt: str, ms: int) -> Path | None:
    body = {'prompt': prompt, 'music_length_ms': max(3000, ms), 'force_instrumental': True}
    return cached('musica', body, lambda: call('POST', 'music', body, {'output_format': FORMAT}, raw=True))


# ---------------------------------------------------------------- voces

def account_voices() -> list[dict]:
    """Voces que ya están en la cuenta (las propias de ElevenLabs y las añadidas)."""
    return call('GET', 'voices').get('voices', [])


def premade(mine: list[dict], gender: str | None, used: set[str]) -> dict | None:
    """Voz propia de ElevenLabs para cuando el plan no deja añadir más voces de la biblioteca."""
    for v in mine:
        labels = v.get('labels') or {}
        if v.get('category') == 'premade' and v['voice_id'] not in used and (not gender or labels.get('gender') == gender):
            return v
    return None


def pick_voices(guion: dict, guion_id: str, informe: dict) -> dict[str, str]:
    """voice_id por personaje: el fijado en el guion o el mejor candidato de la biblioteca, añadido a la cuenta."""
    chosen: dict[str, str] = {}
    mine = account_voices()
    by_name = {v['name']: v['voice_id'] for v in mine}
    used: set[str] = set()
    elsewhere = god_voices_elsewhere(guion_id)
    accents: dict[str, str] = {}
    informe['voces'] = {}
    for role, cfg in guion['voces'].items():
        if cfg.get('voice_id'):
            chosen[role] = cfg['voice_id']
            used.add(cfg['voice_id'])
            informe['voces'][role] = {'voice_id': cfg['voice_id'], 'fijada': True}
            continue
        # Las voces de Dios son de este capítulo y no se reutilizan en otros.
        name = f'Biblia {guion_id} {role}' if cfg.get('dios') else f'Biblia {guion["libro"]} {role}'
        if name in by_name:
            chosen[role] = by_name[name]
            used.add(by_name[name])
            informe['voces'][role] = {'voice_id': by_name[name], 'ya_en_cuenta': True}
            continue
        want = dict(cfg.get('buscar', {}))
        candidates = []
        # Si no hay voces con todos los filtros, se van quitando: primero el uso, luego la edad.
        for drop in ((), ('use_cases',), ('use_cases', 'age')):
            q = {k: v for k, v in want.items() if k not in drop}
            res = call('GET', 'shared-voices', query={'language': 'es', 'page_size': 100, 'sort': 'usage_character_count_1y', **q})
            banned = used | (elsewhere if cfg.get('dios') else set())
            candidates = [v for v in res.get('voices', []) if v['voice_id'] not in banned]
            if candidates:
                break
        if not candidates:
            raise RuntimeError(f'No hay voces en español para {role} con {want}')
        narrator_accent = accents.get('NARRADOR', '')

        def score(v: dict) -> tuple:
            accent = (v.get('accent') or '').lower()
            latin = any(a in accent for a in LATIN)
            other = cfg.get('acento_distinto') and accent and accent != narrator_accent
            return (0 if other or not cfg.get('acento_distinto') else 1, 0 if latin else 1, -(v.get('usage_character_count_1y') or 0))

        best = sorted(candidates, key=score)[0]
        try:
            added = call('POST', f'voices/add/{best["public_owner_id"]}/{best["voice_id"]}', {'new_name': name})
        except RuntimeError as err:
            fallback = premade(mine, want.get('gender'), used)
            if not fallback:
                raise
            warnings.append(f'{role}: no se pudo añadir «{best.get("name")}» ({err}); se usa la voz «{fallback["name"]}» de ElevenLabs.')
            chosen[role] = fallback['voice_id']
            used.add(fallback['voice_id'])
            informe['voces'][role] = {'voice_id': fallback['voice_id'], 'nombre': fallback['name'], 'de_elevenlabs': True}
            continue
        chosen[role] = added['voice_id']
        used.add(best['voice_id'])
        used.add(added['voice_id'])
        accents[role] = (best.get('accent') or '').lower()
        informe['voces'][role] = {
            'voice_id': added['voice_id'],
            'origen': best['voice_id'],
            'nombre': best.get('name'),
            'acento': best.get('accent'),
            'edad': best.get('age'),
            'genero': best.get('gender'),
            'uso': best.get('use_case'),
            'descripcion': (best.get('description') or '')[:160],
            'muestra': best.get('preview_url'),
        }
    return chosen


# ---------------------------------------------------------------- mezcla

def duration(path: Path) -> float:
    out = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def render(src: Path, dst: Path, filters: str) -> Path:
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(src), '-af', filters, '-ar', '44100', '-ac', '2', str(dst)], check=True)
    return dst


def ambient_bed(src: Path, seconds: float, dst: Path) -> Path:
    """Ambiente repetido hasta cubrir el tramo, con entrada y salida suaves."""
    fade = min(1.5, seconds / 3)
    subprocess.run([
        'ffmpeg', '-v', 'error', '-y', '-stream_loop', '-1', '-i', str(src), '-t', f'{seconds:.3f}',
        '-af', f'afade=t=in:d={fade:.2f},afade=t=out:st={seconds - fade:.3f}:d={fade:.2f}', '-ar', '44100', '-ac', '2', str(dst),
    ], check=True)
    return dst


def mix(clips: list[tuple[float, Path, float]], total: float, dst: Path) -> None:
    """clips: (segundo de inicio, archivo, ganancia en dB). Se suman sin normalizar y se ajusta el volumen final."""
    args = ['ffmpeg', '-v', 'error', '-y']
    parts = []
    for i, (start, path, db) in enumerate(clips):
        args += ['-i', str(path)]
        ms = int(start * 1000)
        parts.append(f'[{i}:a]aresample=44100,aformat=channel_layouts=stereo,volume={db}dB,adelay={ms}|{ms}[a{i}]')
    labels = ''.join(f'[a{i}]' for i in range(len(clips)))
    parts.append(f'{labels}amix=inputs={len(clips)}:normalize=0:duration=longest,apad=whole_dur={total:.3f},'
                 'loudnorm=I=-16:TP=-1.5:LRA=11[out]')
    script = OUT / 'mezcla.txt'
    script.write_text(';\n'.join(parts))
    args += ['-filter_complex_script', str(script), '-map', '[out]', '-ar', '44100', '-b:a', '128k', str(dst)]
    subprocess.run(args, check=True)


def overlay(paths: list[Path], dst: Path) -> Path:
    """Varias voces diciendo lo mismo a la vez."""
    args = ['ffmpeg', '-v', 'error', '-y']
    for p in paths:
        args += ['-i', str(p)]
    n = len(paths)
    args += ['-filter_complex', ''.join(f'[{i}:a]' for i in range(n)) + f'amix=inputs={n}:normalize=1:duration=longest', '-ar', '44100', '-ac', '2', str(dst)]
    subprocess.run(args, check=True)
    return dst


def concat(paths: list[Path], dst: Path) -> Path:
    args = ['ffmpeg', '-v', 'error', '-y']
    for p in paths:
        args += ['-i', str(p)]
    n = len(paths)
    chain = ''.join(f'[{i}:a]aresample=44100,aformat=channel_layouts=stereo[s{i}];' for i in range(n))
    args += ['-filter_complex', chain + ''.join(f'[s{i}]' for i in range(n)) + f'concat=n={n}:v=0:a=1', str(dst)]
    subprocess.run(args, check=True)
    return dst


def verse_audio(step: dict, guion: dict, voices: dict[str, str], piece) -> tuple[Path, list[dict]]:
    """Un versículo: las líneas seguidas sin efectos van en una sola petición de diálogo (suena más natural); una
    línea con eco o dicha a coro se graba aparte y se procesa sola."""
    segments: list[Path] = []
    layers: list[dict] = []
    plain: list[dict] = []

    def flush() -> None:
        if plain:
            segments.append(dialogue(list(plain), guion))
            plain.clear()

    for line in step['lineas']:
        reg = guion['registros'].get(line.get('registro', ''), {})
        tag = line.get('tag') or reg.get('tag') or ''
        text = f'{tag} {line["texto"]}'.strip()
        filt = line.get('filtro') or reg.get('filtro')
        if reg.get('capa'):
            layers.append(reg['capa'])
        who = speakers(line)
        if len(who) == 1 and not filt:
            plain.append({'text': text, 'voice_id': voices[who[0]]})
            continue
        flush()
        takes = [dialogue([{'text': text, 'voice_id': voices[w]}], guion) for w in who]
        seg = overlay(takes, piece(f'v{step["v"]}-coro')) if len(takes) > 1 else takes[0]
        segments.append(render(seg, piece(f'v{step["v"]}-eco'), filt) if filt else seg)
    flush()
    out = segments[0] if len(segments) == 1 else concat(segments, piece(f'v{step["v"]}'))
    return out, layers


# ---------------------------------------------------------------- guion → audio

def chars_of(step: dict, guion: dict) -> int:
    total = 0
    for line in step['lineas']:
        tag = line.get('tag') or guion['registros'].get(line.get('registro', ''), {}).get('tag') or ''
        total += len(f'{tag} {line["texto"]}'.strip()) * len(speakers(line))
    return total


def speakers(line: dict) -> list[str]:
    """Personajes que dicen una línea: uno, o varios a la vez («voces»), como la voz del cielo en Mc 1:11."""
    return line.get('voces') or [line['voz']]


def god_voices_elsewhere(guion_id: str) -> set[str]:
    """Voces usadas para Dios en otros capítulos: no se repiten, para que no haya «una voz de Dios» (Dt 4:15-16)."""
    ids: set[str] = set()
    for path in HERE.glob('*.json'):
        if path.stem == guion_id:
            continue
        for cfg in json.loads(path.read_text()).get('voces', {}).values():
            if cfg.get('dios'):
                ids.update(x for x in (cfg.get('voice_id'), cfg.get('origen')) if x)
    return ids


def build(guion_id: str, review: bool) -> None:
    guion = json.loads((HERE / f'{guion_id}.json').read_text())
    check_text(guion)
    chars = sum(chars_of(s, guion) for sc in guion['escenas'] for s in sc['pasos'] if 'v' in s)
    informe: dict = {'guion': guion_id, 'caracteres_dialogo': chars}
    if review:
        print(json.dumps(informe, ensure_ascii=False, indent=2))
        return
    if not KEY:
        notice('error', 'Falta el secreto ELEVENLABS_API_KEY.')
        sys.exit(1)

    try:
        sub = call('GET', 'user/subscription')
        informe['plan'] = {k: sub.get(k) for k in ('tier', 'character_count', 'character_limit', 'voice_limit', 'next_character_count_reset_unix')}
    except RuntimeError as err:
        warnings.append(f'No se pudo leer el plan: {err}')
    plan = informe.get('plan') or {}
    if plan.get('character_limit') is not None:
        left = plan['character_limit'] - (plan.get('character_count') or 0)
        # Además del diálogo, los efectos, ambientes y música también gastan créditos: se pide margen.
        need = int(chars * 1.2) + 3000
        notice('notice', f'Plan {plan.get("tier")}: quedan {left} créditos; este guion necesita unos {need} (sin contar la música).')
        if left < need:
            # No es un fallo del código: la acción termina bien y avisa, sin gastar nada.
            notice('warning', f'No hay créditos suficientes en ElevenLabs: quedan {left} y hacen falta unos {need}. No se grabó nada.')
            sys.exit(0)

    voices = pick_voices(guion, guion_id, informe)
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = OUT / 'piezas'
    tmp.mkdir(exist_ok=True)

    clips: list[tuple[float, Path, float]] = []
    stamps: list[list[float]] = []
    t = 0.0
    n = 0

    def piece(name: str) -> Path:
        nonlocal n
        n += 1
        return tmp / f'{n:03d}-{name}.wav'

    for scene in guion['escenas']:
        amb: tuple[float, Path, float] | None = None  # (inicio, archivo, dB)

        def close_ambient(at: float) -> None:
            nonlocal amb
            if amb and at - amb[0] > 1:
                clips.append((amb[0], ambient_bed(amb[1], at - amb[0] + 1.5, piece('ambiente')), amb[2]))
            amb = None

        for step in scene['pasos']:
            if 'ambiente' in step:
                close_ambient(t)
                if step['ambiente']:
                    src = sound(step['ambiente'], 22, loop=True)
                    if src:
                        amb = (max(0.0, t - 0.5), src, step.get('db', AMBIENT_DB))
            elif 'pausa' in step:
                t += step['pausa']
            elif 'musica' in step:
                src = music(step['musica'], step['ms'])
                if src:
                    length = min(duration(src), step['ms'] / 1000)
                    out = render(src, piece('musica'), f'atrim=0:{length:.3f},afade=t=in:d=0.8,afade=t=out:st={max(0, length - 2.5):.3f}:d=2.5')
                    clips.append((t, out, step.get('db', MUSIC_DB)))
            elif 'efecto' in step:
                src = sound(step['efecto'], step.get('dur'))
                if src:
                    length = duration(src)
                    clips.append((max(0.0, t - 0.15), src, step.get('db', FX_DB)))
                    if not step.get('encima'):
                        t += max(0.0, length - 0.3)
            elif 'v' in step:
                out, layers = verse_audio(step, guion, voices, piece)
                length = duration(out)
                stamps.append([step['v'], round(t, 2)])
                clips.append((t, out, 0.0))
                for layer in layers:
                    bed = sound(layer['prompt'], min(30, length + 2))
                    if bed:
                        clips.append((max(0.0, t - 0.5), bed, layer.get('db', -24)))
                t += length + GAP
        close_ambient(t)
        t += SCENE_GAP

    total = t
    final = OUT / f'{guion_id}.mp3'
    mix(clips, total, final)
    seconds = round(duration(final), 1)

    meta = {
        'id': guion_id,
        'titulo': guion['titulo'],
        'duracion': seconds,
        'timestamps': stamps,
        'credito': guion['credito'],
    }
    (OUT / f'{guion_id}.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2))
    informe.update({'duracion_segundos': seconds, 'piezas': len(clips), 'creditos_gastados': sum(s['creditos'] for s in spent), 'avisos': warnings})
    (OUT / 'informe.json').write_text(json.dumps(informe, ensure_ascii=False, indent=2))
    notice('notice', 'Informe de grabación:\n' + json.dumps(informe, ensure_ascii=False, indent=1))
    for w in warnings:
        notice('warning', w)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    try:
        build(args[0] if args else 'mrk-1', '--revisar' in sys.argv)
    except RuntimeError as err:
        notice('error', f'La grabación se detuvo: {err}\nPiezas nuevas cobradas: {json.dumps(spent, ensure_ascii=False)}')
        sys.exit(1)
