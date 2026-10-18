"""Descarga versiones modernas libres y las guarda comprimidas en pipeline/versions/ (se suben al repositorio
para que la compilación no dependa de miles de descargas).

Uso: python3 pipeline/fetch_versions.py [bes pdt blm rvg rv1865]  (sin argumentos, todas)

Fuente: wldeh/bible-api (textos de eBible.org con la numeración de cada versión).
- bes: La Biblia en Español Sencillo, AudioBiblia.org / Irma Flores. Dominio público.
- pdt: Palabra de Dios para ti, © 2020 Asociación Bíblica Latinoamericana. CC BY 4.0.

Fuente: archivos USFM de eBible.org (ebible.org no se puede abrir desde todos los entornos; la acción de GitHub
«Versiones de la Biblia» corre este script y sube el resultado).
- blm: Santa Biblia libre para el mundo. Dominio público.
- rvg: Reina Valera Gómez, © 2004, 2010 Dr. Humberto Gómez Caballero. eBible.org la publica como redistribuible.

Fuente: scrollmapper/bible_databases (módulos de CrossWire, ya con la numeración de la RV).
- rv1865: Reina-Valera 1865 con arreglos ortográficos. Dominio público.

No se incluye la Versión Biblia Libre (de Jonathan Gallagher, adventista): la app evita esas fuentes.
"""

import gzip
import io
import json
import re
import sys
import urllib.parse
import urllib.request
import zipfile
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
USFM = "https://ebible.org/Scriptures/{id}_usfm.zip"
USFM_VERSIONS = {"blm": "spablm", "rvg": "sparvg"}
SCROLLMAPPER = "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/{name}.json"
SCROLLMAPPER_VERSIONS = {"rv1865": "SpaRV1865"}
# Códigos USFM de los 66 libros, en el orden de BOOKS
USFM_CODES = (
    "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN "
    "HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI "
    "2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV"
).split()
# Líneas que no son texto bíblico: títulos, encabezados de sección, introducciones, referencias…
SKIP_LINE = re.compile(r"^\\(id|ide|h|toc\d|mt\d?|imt\d?|is\d?|ip|ipr|io\d?|iot|ie|rem|sts|usfm|s\d?|ms\d?|mr|sr|r|sp|cl|cd)\b")


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


def usfm_text(raw):
    """Texto de un fragmento USFM sin notas, referencias ni marcas."""
    raw = re.sub(r"\\(f|fe|x|ef|ex)\s.*?\\\1\*", " ", raw, flags=re.S)
    raw = re.sub(r"\\\+?w\s+([^|\\]*)(\|[^\\]*)?\\\+?w\*", r"\1", raw)
    raw = re.sub(r"\\\+?[a-z]+\d*\*?", " ", raw)
    text = " ".join(raw.replace("¶", " ").split())
    text = re.sub(r"\s+([,.;:!?»”’)])", r"\1", text)
    return re.sub(r"([¡¿«“‘(])\s+", r"\1", text)


def parse_usfm(source):
    """{capítulo: [[versículo, texto, etiqueta?], …]} de un libro USFM. El título de un salmo (\\d) va al principio
    del versículo 1, como en la RV1909."""
    chapters, verses, title, ch = {}, None, "", 0
    for line in source.splitlines():
        line = line.strip()
        if not line or SKIP_LINE.match(line):
            continue
        if m := re.match(r"\\c\s+(\d+)", line):
            ch, title = int(m.group(1)), ""
            verses = chapters.setdefault(ch, [])
            continue
        if verses is None:
            continue
        if line.startswith("\\d "):
            title = usfm_text(line[3:])
            continue
        # Una línea puede traer varios versículos y también la continuación del anterior
        parts = re.split(r"\\v\s+(\d+[a-z]?(?:-\d+[a-z]?)?)\s*", line)
        if verses and parts[0].strip():
            verses[-1][1] += " " + usfm_text(parts[0])
        for label, chunk in zip(parts[1::2], parts[2::2]):
            n = int(re.match(r"\d+", label).group())
            text = usfm_text(chunk)
            if n == 1 and title:
                text = f"{title} {text}"
            verses.append([n, text] if label == str(n) else [n, text, label])
    for vs in chapters.values():
        for v in vs:
            v[1] = " ".join(v[1].split())
    return chapters


def from_usfm(ebible_id):
    # eBible.org rechaza el agente por defecto de Python
    request = urllib.request.Request(USFM.format(id=ebible_id), headers={"User-Agent": "Mozilla/5.0 (biblia-de-estudio)"})
    with urllib.request.urlopen(request, timeout=300) as res:
        archive = zipfile.ZipFile(io.BytesIO(res.read()))
    ids = dict(zip(USFM_CODES, (b[0] for b in BOOKS)))
    bible = {}
    for name in archive.namelist():
        if not name.lower().endswith((".usfm", ".sfm")):
            continue
        source = archive.read(name).decode("utf-8-sig")
        code = re.match(r"\\id\s+(\S+)", source)
        if code and code.group(1) in ids:
            bible[ids[code.group(1)]] = {str(ch): [v for v in vs if v[1]] for ch, vs in parse_usfm(source).items()}
    return bible


def from_scrollmapper(name):
    with urllib.request.urlopen(SCROLLMAPPER.format(name=name), timeout=120) as res:
        src = json.load(res)
    bible = {}
    for meta, book in zip(BOOKS, src["books"]):
        for ch in book["chapters"]:
            verses = [[v["verse"], " ".join(v["text"].split())] for v in ch["verses"] if v["text"].strip()]
            if verses:
                bible.setdefault(meta[0], {})[str(ch["chapter"])] = verses
    return bible


def compare(vid, bible):
    """Avisa de los capítulos cuyo número de versículos no coincide con la RV1909."""
    src = json.loads((ROOT / ".cache" / "rv1909.json").read_text(encoding="utf-8"))
    diffs = []
    for meta, book in zip(BOOKS, src["books"]):
        for ch in book["chapters"]:
            ours = {v[0] for v in bible.get(meta[0], {}).get(str(ch["chapter"]), [])}
            theirs = {v["verse"] for v in ch["verses"]}
            if ours != theirs:
                diffs.append(f"{meta[0]} {ch['chapter']} (faltan {sorted(theirs - ours)[:5]}, sobran {sorted(ours - theirs)[:5]})")
    print(f"{vid}: {len(diffs)} capítulos con otra numeración que la RV1909" + "".join(f"\n  {d}" for d in diffs[:20]))
    if diffs:
        print(f"::notice::{vid}: {len(diffs)} capítulos con otra numeración: " + "; ".join(diffs[:12]))


def save(vid, bible):
    path = ROOT / "versions" / f"{vid}.json.gz"
    with gzip.open(path, "wt", encoding="utf-8") as f:
        json.dump(bible, f, ensure_ascii=False, separators=(",", ":"))
    total = sum(len(v) for b in bible.values() for v in b.values())
    print(f"{vid}: {total} versículos en {sum(len(b) for b in bible.values())} capítulos → {path}")


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


def main(only):
    counts = chapters()
    (ROOT / "versions").mkdir(exist_ok=True)
    for vid, ebible_id in USFM_VERSIONS.items():
        if not only or vid in only:
            try:
                bible = from_usfm(ebible_id)
            except Exception as e:  # noqa: BLE001
                # «::error::» queda como anotación visible en la acción de GitHub
                print(f"::error::{vid}: no se pudo descargar {USFM.format(id=ebible_id)}: {e!r}")
                raise
            compare(vid, bible)
            save(vid, bible)
    for vid, name in SCROLLMAPPER_VERSIONS.items():
        if not only or vid in only:
            bible = from_scrollmapper(name)
            compare(vid, bible)
            save(vid, bible)
    for vid, src in VERSIONS.items():
        if only and vid not in only:
            continue
        jobs = [(src, b, ch) for b in BOOKS for ch in range(1, counts[b[0]] + 1)]
        with ThreadPoolExecutor(24) as ex:
            results = list(ex.map(lambda j: fetch_chapter(*j), jobs))
        bible = {}
        for bid, ch, verses in results:
            if verses:
                bible.setdefault(bid, {})[str(ch)] = verses
        if vid in NOTES_FROM_CORPUS:
            print(f"{vid}: {remove_notes(bible, corpus(NOTES_FROM_CORPUS[vid]))} versículos sin notas al pie")
        save(vid, bible)


if __name__ == "__main__":
    main(sys.argv[1:])
