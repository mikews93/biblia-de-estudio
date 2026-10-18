"""Descarga las fuentes libres y genera los archivos JSON que lee la app.

Uso: python3 pipeline/build_data.py [carpeta_salida]   (por defecto: public/data)

Fuentes (se descargan, no se guardan en el repositorio):
- Reina-Valera 1909 (dominio público), vía scrollmapper/bible_databases
- Referencias cruzadas de OpenBible.info (CC BY), vía scrollmapper/bible_databases
- TAGNT de STEPBible / Tyndale House (CC BY 4.0): griego del NT con morfología y glosas
- Español Sencillo y Palabra de Dios para ti, ya descargadas en pipeline/versions/ (ver fetch_versions.py)
- Medidas antiguas (pipeline/medidas.py) e imágenes libres de Wikimedia Commons (pipeline/imagenes.py)
"""

import gzip
import json
import re
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

from books import BOOKS
from imagenes import chapter_objects, resolve as resolve_images
from medidas import chapter_measures

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / ".cache"
STEP = "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/"
SOURCES = {
    "rv1909.json": "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/SpaRV.json",
    "xref.txt": "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/sources/extras/cross_references.txt",
    "tagnt1.txt": STEP + "TAGNT%20Mat-Jhn%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt",
    "tagnt2.txt": STEP + "TAGNT%20Act-Rev%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt",
}
MAX_XREFS = 12

# Las glosas españolas de TAGNT usan términos propios de la Traducción del Nuevo Mundo (Testigos de Jehová).
# Se sustituyen por los de la tradición cristiana histórica, que son también los de la RV1909.
CRUCIFICAR = {"ado": "ado", "ados": "ados", "ando": "ando", "ar": "ar", "a": "a", "aron": "aron",
              "arán": "arán", "aré": "aré", "en": "quen"}
GLOSS_FIXES = [
    (re.compile(r"fij(\w+) e[nm] maderos? de ejecución"),
     lambda m: "crucific" + CRUCIFICAR.get(m.group(1), m.group(1)) if m.group(1) != "en" else "crucifiquen"),
    (re.compile(r"maderos de ejecución"), "cruces"),
    (re.compile(r"madero de ejecución"), "cruz"),
    (re.compile(r" (?:por|en|como) bondad inmerecida"), ""),
    (re.compile(r"bondad inmerecida"), "gracia"),
]
STRONG_GLOSS = {"G3952": ("presencia", "venida")}  # παρουσία: la RV1909 traduce «venida»


def fix_gloss(gloss, strong):
    capital = gloss[:1].isupper()
    gloss = gloss[:1].lower() + gloss[1:]
    for pattern, repl in GLOSS_FIXES:
        gloss = pattern.sub(repl, gloss)
    if strong in STRONG_GLOSS:
        gloss = gloss.replace(*STRONG_GLOSS[strong])
    return gloss[:1].upper() + gloss[1:] if capital else gloss

XREF_TO_ID = {b[3]: b[0] for b in BOOKS}
STEP_TO_ID = {b[4]: b[0] for b in BOOKS if b[4]}
# "Mat.1.1#01=NKO" o "1Jn.2.14[2.13]#03=NKO"; los corchetes dan la versificación de la KJV, que sigue la RV1909
TAGNT_REF = re.compile(r"^(\w+)\.(\d+)\.(\d+)(?:\[(\d+)\.(\d+)\])?\S*#\d+=(\S+)$")


def fetch(name):
    path = CACHE / name
    if not path.exists():
        CACHE.mkdir(exist_ok=True)
        print(f"Descargando {name}…")
        urllib.request.urlretrieve(SOURCES[name], path)
    return path


def write(out, rel, data):
    path = out / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def build_text(out):
    src = json.loads(fetch("rv1909.json").read_text(encoding="utf-8"))
    assert len(src["books"]) == len(BOOKS)
    chapters = {}
    for meta, book in zip(BOOKS, src["books"]):
        bid = meta[0]
        chapters[bid] = len(book["chapters"])
        for ch in book["chapters"]:
            verses = [[v["verse"], v["text"].strip()] for v in ch["verses"]]
            write(out, f"text/rv1909/{bid}/{ch['chapter']}.json", verses)
    return chapters


def convert_ref(ref):
    """'Prov.8.22-Prov.8.30' -> 'pro.8.22-pro.8.30'"""
    parts = []
    for p in ref.split("-"):
        book, ch, v = p.split(".")
        parts.append(f"{XREF_TO_ID[book]}.{ch}.{v}")
    return "-".join(parts)


def build_xrefs(out):
    by_verse = defaultdict(list)
    with fetch("xref.txt").open(encoding="utf-8") as f:
        next(f)
        for line in f:
            src, dst, votes = line.rstrip("\n").split("\t")
            votes = int(votes)
            if votes <= 0:
                continue
            by_verse[convert_ref(src)].append((votes, convert_ref(dst)))
    by_chapter = defaultdict(dict)
    for key, refs in by_verse.items():
        bid, ch, v = key.split(".")
        refs.sort(reverse=True)
        by_chapter[(bid, ch)][v] = [[r, n] for n, r in refs[:MAX_XREFS]]
    for (bid, ch), verses in by_chapter.items():
        write(out, f"xrefs/{bid}/{ch}.json", verses)


def build_interlinear(out):
    by_chapter = defaultdict(lambda: defaultdict(list))
    paragraph_ends = defaultdict(set)
    for name in ("tagnt1.txt", "tagnt2.txt"):
        with fetch(name).open(encoding="utf-8-sig") as f:
            for line in f:
                cols = line.rstrip("\n").split("\t")
                m = TAGNT_REF.match(cols[0])
                if not m:
                    continue
                book, ch, v, kch, kv, kind = m.groups()
                # Solo palabras del texto tradicional (K/k): la RV1909 se tradujo del Textus Receptus
                if "K" not in kind.upper():
                    continue
                if kch:
                    ch, v = kch, kv
                greek, _, translit = cols[1].partition(" (")
                # ¶ marca el final de un párrafo en el griego: lo usamos para dividir el texto en párrafos
                if "¶" in greek:
                    paragraph_ends[(STEP_TO_ID[book], ch)].add(int(v))
                    greek = greek.replace("¶", "")
                strong, _, morph = cols[3].partition("=")
                lemma, _, lemma_gloss = cols[4].partition("=")
                by_chapter[(STEP_TO_ID[book], ch)][v].append([
                    greek.strip(),
                    translit.rstrip(")").strip(),
                    fix_gloss(cols[8].strip(), strong.strip()),
                    cols[2].strip(),
                    lemma.strip(),
                    lemma_gloss.strip(),
                    strong.strip(),
                    morph.strip(),
                ])
    for (bid, ch), verses in by_chapter.items():
        write(out, f"interlinear/{bid}/{ch}.json", verses)
    for (bid, ch), ends in paragraph_ends.items():
        write(out, f"paragraphs/{bid}/{ch}.json", sorted(ends))


VERSIONS = [
    {"id": "rv1909", "name": "Reina-Valera 1909", "abbr": "RV1909", "credit": "Reina-Valera 1909 · dominio público"},
    {"id": "bes", "name": "La Biblia en Español Sencillo", "abbr": "BES",
     "credit": "La Biblia en Español Sencillo · AudioBiblia.org, Irma Flores · dominio público"},
    {"id": "pdt", "name": "Palabra de Dios para ti", "abbr": "PDT",
     "credit": "Palabra de Dios para ti · © 2020 Asociación Bíblica Latinoamericana · CC BY 4.0"},
]


def build_versions(out):
    """Versiones modernas guardadas por pipeline/fetch_versions.py."""
    for v in VERSIONS[1:]:
        with gzip.open(ROOT / "versions" / f"{v['id']}.json.gz", "rt", encoding="utf-8") as f:
            bible = json.load(f)
        for bid, chapters in bible.items():
            for ch, verses in chapters.items():
                write(out, f"text/{v['id']}/{bid}/{ch}.json", verses)
    write(out, "versions.json", VERSIONS)


def build_context(out):
    """Para el estudio de cada capítulo: medidas antiguas con su equivalencia y objetos o mapas con imagen."""
    images = resolve_images(CACHE / "imagenes.json")
    src = json.loads(fetch("rv1909.json").read_text(encoding="utf-8"))
    count = 0
    for meta, book in zip(BOOKS, src["books"]):
        bid = meta[0]
        for ch in book["chapters"]:
            verses = [(v["verse"], v["text"]) for v in ch["verses"]]
            measures = chapter_measures(bid, ch["chapter"], verses)
            pictures = [
                {"id": o["id"], "kind": o.get("kind", "objeto"), "title": o["title"], "caption": o["caption"],
                 "verses": hits, **images[o["id"]]}
                for o, hits in chapter_objects(bid, ch["chapter"], verses) if o["id"] in images
            ]
            if measures or pictures:
                write(out, f"contexto/{bid}/{ch['chapter']}.json", {"medidas": measures, "imagenes": pictures})
                count += 1
    print(f"Capítulos con medidas o imágenes: {count}")


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "public" / "data"
    chapters = build_text(out)
    build_xrefs(out)
    build_interlinear(out)
    build_versions(out)
    build_context(out)
    books = [
        {"id": b[0], "name": b[1], "abbr": b[2], "chapters": chapters[b[0]],
         "testament": "NT" if b[4] else "AT", "interlinear": bool(b[4]), "ewSlug": b[5]}
        for b in BOOKS
    ]
    write(out, "books.json", books)
    print(f"Listo: {out}")


if __name__ == "__main__":
    main()
