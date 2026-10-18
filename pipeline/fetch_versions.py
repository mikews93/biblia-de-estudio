"""Descarga versiones modernas libres y las guarda comprimidas en pipeline/versions/ (se suben al repositorio
para que la compilación no dependa de miles de descargas).

Uso: python3 pipeline/fetch_versions.py

Fuente: wldeh/bible-api (textos de eBible.org con la numeración de cada versión).
- bes: La Biblia en Español Sencillo, AudioBiblia.org / Irma Flores. Dominio público.
- pdt: Palabra de Dios para ti, © 2020 Asociación Bíblica Latinoamericana. CC BY 4.0.
"""

import gzip
import json
import re
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from books import BOOKS

ROOT = Path(__file__).resolve().parent
API = "https://raw.githubusercontent.com/wldeh/bible-api/main/bibles/{src}/books/{book}/chapters/{ch}.json"
VERSIONS = {"bes": "es-bes", "pdt": "es-pddpt"}
# La PDT trae las notas al pie dentro del versículo («Verbo,1.1 También traduce Palabra.»). El corpus de
# BibleNLP tiene el mismo texto sin notas: se usa para esos versículos.
EBIBLE = "https://raw.githubusercontent.com/BibleNLP/ebible/main/"
NOTES_FROM_CORPUS = {"pdt": "corpus/spa-spapddpt.txt"}
ALT_NAMES = {"nam": ["nahum"]}  # nombres de carpeta que en alguna versión no siguen la regla general


def chapters():
    src = json.loads((ROOT / ".cache" / "rv1909.json").read_text(encoding="utf-8"))
    return {b[0]: len(book["chapters"]) for b, book in zip(BOOKS, src["books"])}


def fetch_chapter(src, book, ch):
    names = [book[1].lower().replace(" ", ""), *ALT_NAMES.get(book[0], [])]
    for attempt in range(3 * len(names)):
        url = API.format(src=src, book=urllib.parse.quote(names[attempt % len(names)]), ch=ch)
        try:
            with urllib.request.urlopen(url, timeout=30) as res:
                data = json.load(res)["data"]
            break
        except Exception as e:  # noqa: BLE001
            err = e
    else:
        print(f"  falta {src} {book[0]} {ch}: {err}")
        return book[0], ch, []
    verses, seen = [], set()
    for v in data:
        # Algunas versiones unen versículos ("9-20"): se guarda el primero y la etiqueta completa
        label = v["verse"].strip()
        n = int(re.match(r"\d+", label).group())
        text = " ".join(v["text"].split())
        if n in seen or not text:
            continue
        seen.add(n)
        verses.append([n, text] if label == str(n) else [n, text, label])
    return book[0], ch, sorted(verses)


def corpus(rel):
    lines = lambda path: urllib.request.urlopen(EBIBLE + path, timeout=120).read().decode("utf-8").split("\n")
    return dict(zip(lines("metadata/vref.txt"), lines(rel)))


def remove_notes(bible, plain):
    """Sustituye los versículos con nota («…1.1 Nota.») por el texto del corpus si empiezan igual."""
    codes = list(dict.fromkeys(r.split(" ")[0] for r in plain if r))[:66]
    fixed = 0
    for (bid, *_), code in zip(BOOKS, codes):
        for ch, verses in bible.get(bid, {}).items():
            for v in verses:
                if not re.search(rf"(?<![\d:]){ch}\.{v[0]}(?!\d)", v[1]):
                    continue
                clean = plain.get(f"{code} {ch}:{v[0]}", "")
                if clean and clean[:10] == v[1][:10]:
                    v[1] = " ".join(clean.split())
                    fixed += 1
    return fixed


def main():
    counts = chapters()
    out = ROOT / "versions"
    out.mkdir(exist_ok=True)
    for vid, src in VERSIONS.items():
        jobs = [(src, b, ch) for b in BOOKS for ch in range(1, counts[b[0]] + 1)]
        with ThreadPoolExecutor(24) as ex:
            results = list(ex.map(lambda j: fetch_chapter(*j), jobs))
        bible = {}
        for bid, ch, verses in results:
            if verses:
                bible.setdefault(bid, {})[str(ch)] = verses
        if vid in NOTES_FROM_CORPUS:
            print(f"{vid}: {remove_notes(bible, corpus(NOTES_FROM_CORPUS[vid]))} versículos sin notas al pie")
        path = out / f"{vid}.json.gz"
        with gzip.open(path, "wt", encoding="utf-8") as f:
            json.dump(bible, f, ensure_ascii=False, separators=(",", ":"))
        total = sum(len(v) for b in bible.values() for v in b.values())
        print(f"{vid}: {total} versículos en {sum(len(b) for b in bible.values())} capítulos → {path}")


if __name__ == "__main__":
    main()
