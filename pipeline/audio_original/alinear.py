"""Tiempos palabra por palabra de la lectura en hebreo y griego, para resaltar el interlineal mientras suena.

  python3 pipeline/audio_original/alinear.py jhn-3 gen-1 …   (sin argumentos: los de capitulos.txt)
  python3 pipeline/audio_original/alinear.py jhn-3 --texto     (solo muestra las palabras, sin audio)

Grabaciones (no se tocan ni se copian: la app las reproduce desde Internet Archive):
- Griego: Nuevo Testamento de Westcott-Hort leído por Marilyn Phemister (CC BY-NC 3.0).
- Hebreo: Tanaj leído por Abraham Shmuelof (CC BY-NC-ND 3.0).

Cada capítulo se alinea con su texto (TAGNT o TAHOT de STEPBible) con el modelo de alineación forzada MMS de Meta
(torchaudio). Las palabras van en la transliteración de STEPBible, sin acentos. Entre versículos se deja un comodín
(*) que absorbe las pausas, el título que se lee al principio y lo que no esté en el texto.

Salida: public/audio/original/<libro>-<cap>.json con la URL del audio, los tiempos por versículo y, por versículo,
[inicio, fin] de cada palabra en el mismo orden que el interlineal de la app (null si la palabra no se lee: en el NT
el interlineal sigue el texto tradicional y la lectura sigue Westcott-Hort).
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / 'pipeline'))

from books import BOOKS  # noqa: E402
from build_data import CANTILLATION, TAGNT_REF, fetch, hebrew_word  # noqa: E402

OUT = ROOT / 'public' / 'audio' / 'original'
CACHE = ROOT / 'pipeline' / '.cache' / 'original'
NT_IDS = [b[0] for b in BOOKS[39:]]
ID_TO_STEP = {b[0]: b[4] for b in BOOKS}
SLUG = {b[0]: b[5] for b in BOOKS}

GRIEGO = {
    'item': 'AudiogreeknewtestamentOfWescott.hort.readByMarilynPhemister',
    'credito': 'Lectura en griego: Marilyn Phemister, Nuevo Testamento de Westcott-Hort (CC BY-NC 3.0, Internet Archive)',
    'lector': 'Marilyn Phemister',
}
HEBREO = {
    'item': 'hebrewbible',
    'credito': 'Lectura en hebreo: Abraham Shmuelof, Tanaj (CC BY-NC-ND 3.0, Internet Archive)',
    'lector': 'Abraham Shmuelof',
}

# "Psa.23.0(23.1)#01=L": la referencia de la RV1909 y, entre paréntesis, la hebrea cuando es distinta.
TAHOT_REF = re.compile(r'^(\w+)\.(\d+)\.(\d+)(?:\((\d+)\.(\d+)\))?#\d+=(\S+)$')
# El nombre divino se lee «Adonai» (y «Elohim» cuando ya va junto a Adonai), no como se escribe.
QERE_PERPETUO = {'H3068': 'adonai', 'H3069': 'elohim'}


def romanize(text: str) -> str:
    """'anabebēken' -> 'anabebeken'; 'be./re.Shit' -> 'bereshit'. Solo quedan las letras del modelo (a-z)."""
    text = unicodedata.normalize('NFKD', text.lower())
    text = ''.join(c for c in text if not unicodedata.combining(c))
    return re.sub(r'[^a-z]', '', text.replace('ʼ', '').replace('ʽ', ''))


# ---------------------------------------------------------------- palabras de cada capítulo


def greek_words(book: str, chapter: int):
    """Palabras que se leen (Westcott-Hort) y, para cada una, su lugar en el interlineal (texto tradicional)."""
    step = ID_TO_STEP[book]
    names = ('tagnt1.txt', 'tagnt2.txt') if NT_IDS.index(book) < 4 else ('tagnt2.txt',)
    spoken, interlinear = [], defaultdict(int)
    for name in names:
        with fetch(name).open(encoding='utf-8-sig') as f:
            for line in f:
                cols = line.rstrip('\n').split('\t')
                m = TAGNT_REF.match(cols[0])
                if not m or m.group(1) != step:
                    continue
                _, ch, v, kch, kv, kind = m.groups()
                where = None
                # El mismo índice que build_data.py: las palabras K, en orden, por versículo de la RV1909.
                if 'K' in kind.upper():
                    key = (int(kch or ch), int(kv or v))
                    where = (key[1], interlinear[key]) if key[0] == chapter else None
                    interlinear[key] += 1
                if int(ch) != chapter or 'WH' not in cols[5].split('+'):
                    continue
                greek, _, translit = cols[1].partition(' (')
                spoken.append({'verse': int(v), 'text': greek.replace('¶', '').strip(),
                               'roman': romanize(translit.rstrip(')')), 'where': where})
    return spoken


def hebrew_words(book: str, chapter: int):
    """Palabras del capítulo hebreo que contiene el capítulo pedido (la grabación sigue los capítulos hebreos: Malaquías 4
    es Malaquías 3:19-24) y su lugar en el interlineal (versificación de la RV1909)."""
    step = ID_TO_STEP[book]
    rows, interlinear = [], defaultdict(int)
    for i in range(1, 5):
        with fetch(f'tahot{i}.txt').open(encoding='utf-8-sig') as f:
            for line in f:
                cols = line.rstrip('\n').split('\t')
                m = TAHOT_REF.match(cols[0])
                if not m or m.group(1) != step:
                    continue
                _, ch, v, hch, hv, kind = m.groups()
                # Mismo filtro que build_hebrew: Leningrado, qeré y texto restaurado; el título del salmo va en el 1.
                if kind[0] not in 'LQR':
                    continue
                hebrew = hebrew_word(cols[1].split('\\ ')[0])
                if not hebrew:
                    continue
                key = (int(ch), int(v) or 1)
                where = (key[1], interlinear[key]) if key[0] == chapter else None
                interlinear[key] += 1
                strong = next((s for s in QERE_PERPETUO if re.search(rf'{s}(?!\d)', cols[4])), None)
                roman = QERE_PERPETUO[strong] if strong else romanize(cols[2])
                rows.append((int(hch or ch), {'verse': key[1], 'text': CANTILLATION.sub('', hebrew), 'roman': roman,
                                              'where': where}))
    mine = Counter(h for h, w in rows if w['where'])
    if not mine:
        return []
    hebrew_chapter = mine.most_common(1)[0][0]
    return [{**w, 'hch': h} for h, w in rows if h == hebrew_chapter]


# ---------------------------------------------------------------- grabaciones de Internet Archive


def archive_files(item: str) -> list[str]:
    path = CACHE / f'{item}.json'
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(f'https://archive.org/metadata/{item}/files', path)
    data = json.loads(path.read_text())
    return [f['name'] for f in data.get('result', data.get('files', [])) if f['name'].endswith('.mp3')]


def greek_file(book: str, chapter: int, files: list[str]) -> str:
    """'04John03.mp3'; los libros de un capítulo llevan '00' ('26Jude00.mp3')."""
    number = NT_IDS.index(book) + 1
    for name in files:
        m = re.fullmatch(r'(\d\d)(.+?)(\d\d)\.mp3', name)
        if m and int(m.group(1)) == number and int(m.group(3)) in (chapter, 0 if chapter == 1 else -1):
            return name
    raise SystemExit(f'No encuentro la lectura griega de {book} {chapter}')


def hebrew_file(book: str, chapter: int, files: list[str]) -> str:
    """'01-Genesis 01.mp3', '26-Psalms 023.mp3', '08-Samuel a01.mp3' (1 Samuel) y '08-Samuel b01.mp3' (2 Samuel)."""
    slug = SLUG[book]
    part = {'1': 'a', '2': 'b'}.get(slug[0], '')
    base = re.sub(r'[^a-z]', '', slug.split('-', 1)[-1])
    wanted = [(base[:4], part)]
    if book == 'ezr':
        wanted = [('ezra', 'a'), ('ezra', '')]
    elif book == 'neh':
        wanted = [('nehe', ''), ('ezra', 'b')]
    elif book == 'sng':
        # El título del archivo varía (Song of Songs, Shir HaShirim, Canticles): basta el número 30 del Tanaj
        wanted = [('song', ''), ('shir', ''), ('cant', ''), ('30', '')]
    parsed = []
    for name in files:
        m = re.fullmatch(r'(\d\d)-(.+?) ([ab]?)(\d+)\.mp3', name)
        if m:
            title = m.group(1) + re.sub(r'[^a-z]', '', m.group(2).lower())
            parsed.append((title, m.group(3), int(m.group(4)), name))
    for prefix, letter in wanted:
        for title, l, ch, name in parsed:
            if (title.startswith(prefix) or title[2:].startswith(prefix)) and l == letter and ch == chapter:
                return name
    raise SystemExit(f'No encuentro la lectura hebrea de {book} {chapter}')


def download(item: str, name: str) -> Path:
    path = CACHE / item / name
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        # archive.org a veces responde 500 o corta la descarga: se reintenta con espera creciente.
        for attempt in range(5):
            try:
                urllib.request.urlretrieve(archive_url(item, name), path.with_suffix('.part'))
                path.with_suffix('.part').rename(path)
                break
            except OSError as e:
                if attempt == 4:
                    raise
                print(f'  reintento de la descarga ({e})', flush=True)
                time.sleep(5 * 2**attempt)
    return path


def archive_url(item: str, name: str) -> str:
    return f'https://archive.org/download/{item}/{urllib.parse.quote(name)}'


# ---------------------------------------------------------------- alineación


class Aligner:
    def __init__(self):
        import torch
        import torchaudio

        self.torch, self.F = torch, torchaudio.functional
        bundle = torchaudio.pipelines.MMS_FA
        self.rate = bundle.sample_rate
        self.model = bundle.get_model(with_star=True).eval()
        # Con las capas lineales en int8 el modelo va el doble de rápido en CPU (los minutos de Actions cuentan).
        self.model = torch.ao.quantization.quantize_dynamic(self.model, {torch.nn.Linear}, dtype=torch.qint8)
        self.dict = bundle.get_dict(star='*')
        print('Modelo MMS listo', flush=True)
        torch.set_num_threads(max(1, torch.get_num_threads()))

    def load(self, path: Path):
        raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', str(path), '-ac', '1', '-ar', str(self.rate), '-f', 'f32le', '-'],
                             check=True, capture_output=True).stdout
        return self.torch.frombuffer(bytearray(raw), dtype=self.torch.float32)

    def emissions(self, wave):
        """El modelo en trozos de 15 s (con 2 s de contexto a cada lado) para no agotar la memoria en capítulos largos."""
        torch = self.torch
        hop, chunk, ctx = 320, 15 * self.rate, 2 * self.rate
        out = []
        for start in range(0, len(wave), chunk):
            a, b = max(0, start - ctx), min(len(wave), start + chunk + ctx)
            with torch.inference_mode():
                em, _ = self.model(wave[a:b].unsqueeze(0))
            first = (start - a) // hop
            frames = (min(start + chunk, len(wave)) - start) // hop
            out.append(em[0, first:first + frames])
        return torch.log_softmax(torch.cat(out), dim=-1), hop / self.rate

    def align(self, path: Path, words: list[dict]):
        """[inicio, fin, confianza] de cada palabra, en segundos."""
        torch = self.torch
        began = time.time()
        wave = self.load(path)
        emission, step = self.emissions(wave)
        print(f'  {len(wave) / self.rate:.0f} s de audio, modelo en {time.time() - began:.0f} s', flush=True)
        tokens, owner = [self.dict['*']], [-1]
        verse = None
        for i, w in enumerate(words):
            if verse is not None and w['verse'] != verse:
                tokens.append(self.dict['*'])
                owner.append(-1)
            verse = w['verse']
            for c in w['roman'] or 'a':
                tokens.append(self.dict[c])
                owner.append(i)
        tokens.append(self.dict['*'])
        owner.append(-1)
        labels, scores = self.F.forced_align(emission.unsqueeze(0), torch.tensor([tokens], dtype=torch.int32), blank=0)
        spans = self.F.merge_tokens(labels[0], scores[0].exp())
        assert len(spans) == len(tokens), (len(spans), len(tokens))
        result = [None] * len(words)
        for span, i in zip(spans, owner):
            if i < 0:
                continue
            if result[i] is None:
                result[i] = [span.start, span.end, [span.score]]
            else:
                result[i][1] = span.end
                result[i][2].append(span.score)
        return [[round(s * step, 2), round(e * step, 2), round(sum(c) / len(c), 2)] for s, e, c in result], len(wave) / self.rate


# ---------------------------------------------------------------- capítulo


def chapter(aligner: Aligner | None, chapter_id: str, text_only=False):
    book, ch = chapter_id.rsplit('-', 1)
    ch = int(ch)
    nt = book in NT_IDS
    words = greek_words(book, ch) if nt else hebrew_words(book, ch)
    if not words:
        raise SystemExit(f'{chapter_id}: no hay palabras')
    if text_only:
        for w in words:
            print(w['verse'], w['where'], w['text'], w['roman'])
        return
    source = GRIEGO if nt else HEBREO
    files = archive_files(source['item'])
    name = greek_file(book, ch, files) if nt else hebrew_file(book, words[0]['hch'], files)
    print(f'{chapter_id}: {name}, {len(words)} palabras', flush=True)
    began = time.time()
    path = download(source['item'], name)
    print(f'  descargado en {time.time() - began:.0f} s ({path.stat().st_size // 1024} KB)', flush=True)
    times, duration = aligner.align(path, words)
    palabras: dict[str, list] = defaultdict(list)
    for w, t in zip(words, times):
        if not w['where']:
            continue
        v, idx = w['where']
        row = palabras[str(v)]
        row.extend([None] * (idx + 1 - len(row)))
        row[idx] = t[:2]
    starts: dict[int, float] = {}
    for w, t in zip(words, times):
        starts.setdefault(w['verse'], t[0])
    low = [f"{w['verse']}:{w['text']}" for w, t in zip(words, times) if t[2] < 0.15]
    confidence = sum(t[2] for t in times) / max(1, len(times))
    print(f'  confianza media {confidence:.2f}; dudosas: {len(low)} {low[:12]}')
    OUT.mkdir(parents=True, exist_ok=True)
    data = {
        'idioma': 'griego' if nt else 'hebreo',
        'src': archive_url(source['item'], name),
        'duracion': round(duration, 2),
        'lector': source['lector'],
        'credito': source['credito'],
        'confianza': round(confidence, 2),
        'timestamps': sorted([v, round(t, 2)] for v, t in starts.items()),
        'palabras': dict(sorted(palabras.items(), key=lambda kv: int(kv[0]))),
    }
    (OUT / f'{chapter_id}.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')


def chapters_of(book: str) -> list[int]:
    """Capítulos de un libro según la RV1909 (los mismos del interlineal)."""
    data = json.loads(fetch('rv1909.json').read_text(encoding='utf-8'))
    return [c['chapter'] for c in data['books'][[b[0] for b in BOOKS].index(book)]['chapters']]


def expand(arg: str) -> list[str]:
    """'jhn-3' es un capítulo; 'jhn' es el libro entero; 'nt' y 'at', todo el Nuevo o el Antiguo Testamento."""
    if re.fullmatch(r'\w+-\d+', arg):
        return [arg]
    books = NT_IDS if arg == 'nt' else [b[0] for b in BOOKS[:39]] if arg == 'at' else [arg]
    return [f'{b}-{c}' for b in books for c in chapters_of(b)]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    text_only = '--texto' in sys.argv
    redo = '--rehacer' in sys.argv
    if not args:
        args = [l.strip() for l in (HERE / 'capitulos.txt').read_text().splitlines() if l.strip() and not l.startswith('#')]
    aligner = None if text_only else Aligner()
    failed = []
    for chapter_id in [c for a in args for c in expand(a)]:
        # Lo ya alineado no se repite (salvo con --rehacer): así el libro entero se puede alinear en varias tandas.
        if not text_only and not redo and (OUT / f'{chapter_id}.json').exists():
            continue
        try:
            chapter(aligner, chapter_id, text_only)
        except (SystemExit, Exception) as e:  # un capítulo que falla no detiene los demás
            print(f'{chapter_id}: {e}')
            failed.append(chapter_id)
    if failed:
        print(f'Sin alinear: {" ".join(failed)}')


if __name__ == '__main__':
    main()
