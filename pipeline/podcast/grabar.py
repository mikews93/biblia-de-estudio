"""Graba con ElevenLabs un pódcast de capítulo (guion «ANA:» / «TOMÁS:», el mismo formato que prepara /api/estudiar).

  python3 pipeline/podcast/grabar.py jhn-3

Elige en la biblioteca de ElevenLabs dos voces en español con tono de conversación (Ana y Tomás), graba el guion con
Text to Dialogue en tramos de pocas intervenciones y los une con ffmpeg. Deja pipeline/podcast/salida/<id>.mp3 e
informe.json (voces, créditos, duración). Cada tramo se guarda en caché por su contenido.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
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
MODEL = os.environ.get('MODELO', 'eleven_v4')
FORMAT = 'mp3_44100_128'
TURNS_PER_CHUNK = 8
LATIN = ('latin', 'mexic', 'colombia', 'argentin', 'venezuel', 'peru', 'chile', 'caribbean', 'central american')
VOICES = {
    'ANA': {'gender': 'female', 'age': 'young', 'use_cases': 'conversational'},
    'TOMÁS': {'gender': 'male', 'age': 'middle_aged', 'use_cases': 'conversational'},
}

spent: list[int] = []


def notice(kind: str, msg: str) -> None:
    flat = msg.replace('%', '%25').replace('\n', '%0A')
    print(f'::{kind}::{flat}' if os.environ.get('GITHUB_ACTIONS') else f'[{kind}] {msg}', flush=True)


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
                spent.append(int(float(cost)))
    except urllib.error.HTTPError as err:
        raise RuntimeError(f'{method} {path} → {err.code}: {err.read().decode(errors="replace")[:500]}') from None
    return payload if raw else json.loads(payload)


def parse(text: str) -> list[tuple[str, str]]:
    turns = []
    for line in text.splitlines():
        m = re.match(r'^\s*(ANA|TOM[ÁA]S)\s*:\s*(.+)$', line)
        if m:
            turns.append(('ANA' if m[1] == 'ANA' else 'TOMÁS', m[2].strip()))
    return turns


def pick_voices(informe: dict) -> dict[str, str]:
    mine = call('GET', 'voices').get('voices', [])
    by_name = {v['name']: v['voice_id'] for v in mine}
    chosen: dict[str, str] = {}
    informe['voces'] = {}
    for role, want in VOICES.items():
        name = f'Podcast {role}'
        if name in by_name:
            chosen[role] = by_name[name]
            informe['voces'][role] = {'voice_id': by_name[name], 'ya_en_cuenta': True}
            continue
        candidates = []
        for drop in ((), ('use_cases',), ('use_cases', 'age')):
            q = {k: v for k, v in want.items() if k not in drop}
            res = call('GET', 'shared-voices', query={'language': 'es', 'page_size': 100, 'sort': 'usage_character_count_1y', **q})
            candidates = [v for v in res.get('voices', []) if v['voice_id'] not in chosen.values()]
            if candidates:
                break
        if not candidates:
            raise RuntimeError(f'No hay voces en español para {role}')

        def score(v: dict) -> tuple:
            accent = (v.get('accent') or '').lower()
            return (0 if any(a in accent for a in LATIN) else 1, -(v.get('usage_character_count_1y') or 0))

        best = sorted(candidates, key=score)[0]
        try:
            added = call('POST', f'voices/add/{best["public_owner_id"]}/{best["voice_id"]}', {'new_name': name})
            chosen[role] = added['voice_id']
        except RuntimeError as err:
            fallback = next((v for v in mine if v.get('category') == 'premade' and (v.get('labels') or {}).get('gender') == want['gender']
                             and v['voice_id'] not in chosen.values()), None)
            if not fallback:
                raise
            notice('warning', f'{role}: no se pudo añadir «{best.get("name")}» ({err}); se usa «{fallback["name"]}».')
            chosen[role] = fallback['voice_id']
            informe['voces'][role] = {'voice_id': fallback['voice_id'], 'nombre': fallback['name'], 'de_elevenlabs': True}
            continue
        informe['voces'][role] = {k: best.get(k) for k in ('name', 'accent', 'age', 'gender', 'use_case', 'preview_url')}
        informe['voces'][role]['voice_id'] = chosen[role]
    return chosen


def chunk_audio(inputs: list[dict]) -> Path:
    body = {'inputs': inputs, 'model_id': MODEL, 'language_code': 'es', 'seed': 7}
    key = hashlib.sha256(json.dumps(['podcast', body], sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:20]
    path = CACHE / f'podcast-{key}.mp3'
    if not path.exists():
        audio = call('POST', 'text-to-dialogue', body, {'output_format': FORMAT}, raw=True)
        CACHE.mkdir(parents=True, exist_ok=True)
        path.write_bytes(audio)
    return path


def join(paths: list[Path], dst: Path) -> None:
    args = ['ffmpeg', '-v', 'error', '-y']
    for p in paths:
        args += ['-i', str(p)]
    n = len(paths)
    # Una pausa breve entre tramos, como el respiro entre intervenciones.
    chain = ''.join(f'[{i}:a]aresample=44100,aformat=channel_layouts=stereo,apad=pad_dur=0.35[s{i}];' for i in range(n))
    chain += ''.join(f'[s{i}]' for i in range(n)) + f'concat=n={n}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11[out]'
    args += ['-filter_complex', chain, '-map', '[out]', '-ar', '44100', '-b:a', '128k', str(dst)]
    subprocess.run(args, check=True)


def main(guion_id: str) -> None:
    turns = parse((HERE / f'{guion_id}.txt').read_text())
    chars = sum(len(t) for _, t in turns)
    informe: dict = {'guion': guion_id, 'modelo': MODEL, 'intervenciones': len(turns), 'caracteres': chars}
    if not KEY:
        notice('error', 'Falta el secreto ELEVENLABS_API_KEY.')
        sys.exit(1)
    sub = call('GET', 'user/subscription')
    left = (sub.get('character_limit') or 0) - (sub.get('character_count') or 0)
    notice('notice', f'Plan {sub.get("tier")}: quedan {left} créditos; el guion tiene {chars} caracteres.')
    if left < chars * 1.1:
        notice('warning', f'No hay créditos suficientes: quedan {left} y hacen falta unos {int(chars * 1.1)}. No se grabó nada.')
        sys.exit(0)
    voices = pick_voices(informe)
    pieces = [
        chunk_audio([{'text': text, 'voice_id': voices[who]} for who, text in turns[i:i + TURNS_PER_CHUNK]])
        for i in range(0, len(turns), TURNS_PER_CHUNK)
    ]
    OUT.mkdir(parents=True, exist_ok=True)
    dst = OUT / f'{guion_id}.mp3'
    join(pieces, dst)
    seconds = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', str(dst)],
                                   capture_output=True, text=True, check=True).stdout)
    informe.update({'duracion_s': round(seconds, 1), 'creditos': sum(spent)})
    (OUT / 'informe.json').write_text(json.dumps(informe, ensure_ascii=False, indent=2))
    notice('notice', f'{dst.name}: {seconds / 60:.1f} min, {sum(spent)} créditos.')
    print(json.dumps(informe, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'jhn-3')
