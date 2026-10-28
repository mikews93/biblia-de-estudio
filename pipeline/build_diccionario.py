"""Diccionarios bíblicos e índice por temas para «Pregúntale a la Biblia» y la IA del estudio.

Uso:
  python3 pipeline/build_diccionario.py             genera pipeline/diccionario/ desde las fuentes (pipeline/.cache/diccionario/)
  python3 pipeline/build_diccionario.py --publicar  copia pipeline/diccionario/ a public/diccionario/ (lo que hace el despliegue)

Fuentes, de dominio público, en copias con commit fijado:
- Easton's Bible Dictionary (M. G. Easton, 1897) y Smith's Bible Dictionary (William Smith, 1863), de CCEL, en el
  conjunto de datos de NEUU (github.com/neuu-org/bible-dictionary-dataset, datos con licencia CC BY 4.0).
- Nave's Topical Bible (Orville J. Nave, 1896), en BibleData de Brady Stephenson (github.com/BradyStephenson/bible-data,
  CC BY 4.0).
Smith cita a veces los libros apócrifos (1 Macabeos, Sirácida…): esas citas se dejan fuera, como en el resto de la app.

El resultado va en el repositorio (pipeline/diccionario/), así el despliegue no depende de esos sitios. La app nunca
muestra el inglés: api/_diccionario.ts lo busca, la IA lo explica en español y la tarjeta del buscador guarda su
explicación en español para todos (api/comentario.ts).

Salida:
  indice.json.gz      {"d": [entradas de los diccionarios], "n": [temas de Nave]}, en mayúsculas y sin apóstrofos
                      («LORDS SUPPER»: así se juntan las de Easton y Smith)
  d/<letra>.json.gz   {"GRACE": [Easton o null, Smith o null, [citas]]}
  n/<letra>.json.gz   {"PRAYER": [[nivel, "Daily, in the morning", [citas]], ...]}
Las citas van como en la app: «luk.22.39», «exo.6.16-exo.6.20» o, si es un capítulo entero, «num.17».
"""

import gzip
import csv
import io
import json
import re
import shutil
import sys
import urllib.error
import urllib.request
from pathlib import Path

from books import BOOKS

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / ".cache" / "diccionario"
OUT = ROOT / "diccionario"

NEUU = "https://raw.githubusercontent.com/neuu-org/bible-dictionary-dataset/b8e82aa7ca847f4d97fb432cd965e398a111333c/data/02_sources/"
NAVE = "https://raw.githubusercontent.com/BradyStephenson/bible-data/720a8da6d220ff676e424c468069c7d67be2ca49/NavesTopicalDictionary.csv"
LETRAS = "abcdefghijklmnopqrstuvwxyz"

# Libros como los escriben los diccionarios («Song of Solomon», «Psalms») y Nave («EXO», «1CH»)
BOOK_NAMES = {}
for b in BOOKS:
    for name in (b[0], b[3], b[4], b[5].replace("-", " ")):
        BOOK_NAMES[re.sub(r"[\s.]", "", name.lower())] = b[0]
BOOK_NAMES.update({"psalms": "psa", "songofsolomon": "sng", "songofsongs": "sng", "ezekiel": "ezk", "judges": "jdg",
                   "mark": "mrk", "philemon": "phm", "philippians": "php", "jude": "jud", "1kings": "1ki",
                   "2kings": "2ki", "1chronicles": "1ch", "2chronicles": "2ch", "revelation": "rev", "1jhn": "1jn"})


def fetch(name, url):
    path = CACHE / name
    if path.exists():
        return path
    CACHE.mkdir(parents=True, exist_ok=True)
    print(f"Descargando {name}…")
    path.write_bytes(urllib.request.urlopen(url, timeout=300).read())
    return path


def book_id(name):
    return BOOK_NAMES.get(re.sub(r"[\s.]", "", name.lower()))


def ref(book, c1, v1=None, c2=None, v2=None):
    """La cita como en la app: «luk.22.39», «exo.6.16-exo.6.20», «num.17»."""
    if not v1:
        return f"{book}.{c1}"
    if not v2 or (c2 or c1) == c1 and v2 == v1:
        return f"{book}.{c1}.{v1}"
    return f"{book}.{c1}.{v1}-{book}.{c2 or c1}.{v2}"


# ------------------------------------------------------------------------------------------------- Easton y Smith

def dictionary_ref(text):
    """«Luke 22:39», «Judges 8:33-9:6», «Psalms 32:0-0;» (capítulo entero), «1Macc 2:1» (se deja fuera)."""
    m = re.match(r"^(.+?) (\d+)(?::(\d+))?(?:[-–](?:(\d+):)?(\d+))?;?$", text.strip())
    if not m:
        return None
    book = book_id(m.group(1))
    if not book:
        return None
    c1, v1, c2, v2 = m.group(2), m.group(3), m.group(4), m.group(5)
    if v1 in (None, "0"):
        return ref(book, int(c1))
    return ref(book, int(c1), int(v1), int(c2) if c2 else None, int(v2) if v2 and v2 != "0" else None)


def clean(text):
    text = re.sub(r"[ \t]+", " ", text).strip()
    return text.replace(" ,", ",").replace(" .", ".")


def dictionaries():
    entradas = {}
    for i, src in enumerate(("easton", "smith")):
        for letra in LETRAS:
            try:
                data = json.loads(fetch(f"{src}-{letra}.json", f"{NEUU}{src}/{letra}.json").read_text())
            except urllib.error.HTTPError as err:
                if err.code != 404:
                    raise
                continue  # Easton no tiene entradas con X
            for key, e in data.items():
                texto = "\n\n".join(clean(d["text"]) for d in e["definitions"] if d["text"].strip())
                if not texto:
                    continue
                row = entradas.setdefault(key.upper().replace("’", "").replace("'", ""), [None, None, []])
                row[i] = texto
                for r in e.get("scripture_refs", []):
                    c = dictionary_ref(r["reference"])
                    if c and c not in row[2]:
                        row[2].append(c)
    return entradas


# ------------------------------------------------------------------------------------------------- Nave

REF_START = re.compile(r"\b([1-3]?[A-Z]{2,3}) \d")


def nave_refs(text):
    """«EXO 6:16-20; JOS 21:4,10; 1CH 6:2,3; 23:13; NUM 17» → citas de la app."""
    out = []
    book = None
    for seg in text.split(";"):
        seg = seg.strip().rstrip(".")
        m = re.match(r"^([1-3]?[A-Z]{2,4}) (.+)$", seg)
        if m:
            b = book_id(m.group(1))
            if not b:
                book = None
                continue
            book, seg = b, m.group(2)
        if not book:
            continue
        m = re.match(r"^(\d+)(?::(.+))?$", seg)
        if not m:
            continue
        chapter = int(m.group(1))
        if not m.group(2):
            out.append(ref(book, chapter))
            continue
        for part in m.group(2).split(","):
            part = part.strip()
            r = re.match(r"^(\d+)(?:-(?:(\d+):)?(\d+))?$", part)
            if not r:
                continue
            c2 = int(r.group(2)) if r.group(2) else None
            out.append(ref(book, chapter, int(r.group(1)), c2, int(r.group(3)) if r.group(3) else None))
            if c2:
                chapter = c2
    return merge(out)


def merge(refs):
    """«1ch.6.2», «1ch.6.3» → «1ch.6.2-1ch.6.3»: los versículos seguidos del mismo capítulo van juntos."""
    out = []
    for r in refs:
        prev = out[-1] if out else ""
        a, b = prev.split("-")[0].split("."), prev.split("-")[-1].split(".")
        n = r.split("-")
        s, e = n[0].split("."), n[-1].split(".")
        if (len(b) == 3 and len(s) == 3 and a[:2] == b[:2] == s[:2] == e[:2] and int(s[2]) == int(b[2]) + 1):
            out[-1] = ref(s[0], int(s[1]), int(a[2]), int(e[1]), int(e[2]))
        else:
            out.append(r)
    return out


def nave():
    raw = fetch("nave.csv", NAVE).read_text(encoding="utf-8-sig")
    temas = {}
    for row in csv.DictReader(io.StringIO(raw)):
        lineas = []
        for line in row["entry"].splitlines():
            if not line.strip():
                continue
            nivel = (len(line) - len(line.lstrip(" "))) // 5
            texto = line.strip().lstrip("-").strip()
            m = REF_START.search(texto)
            # «See CARE», «See also PRAYER»: van tal cual, sin citas
            if m and not re.match(r"^See\b", texto):
                label, refs = texto[: m.start()].strip().rstrip(","), nave_refs(texto[m.start():])
            else:
                label, refs = texto, []
            if label or refs:
                lineas.append([nivel, label, refs])
        if lineas:
            temas[row["subject"].strip().upper().replace("’", "").replace("'", "")] = lineas
    return temas


# ------------------------------------------------------------------------------------------------- Salida

def build():
    entradas = dictionaries()
    temas = nave()

    def write(name, data):
        path = OUT / name
        path.parent.mkdir(parents=True, exist_ok=True)
        raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode()
        # mtime fijo: el mismo contenido da el mismo archivo y git no ve cambios
        path.write_bytes(gzip.compress(raw, 9, mtime=0))

    def letra(key):
        c = key[0].lower()
        return c if c in LETRAS else "otros"

    if OUT.exists():
        shutil.rmtree(OUT)
    write("indice.json.gz", {"d": sorted(entradas), "n": sorted(temas)})
    for nombre, todo in (("d", entradas), ("n", temas)):
        shards = {}
        for k, v in todo.items():
            shards.setdefault(letra(k), {})[k] = v
        for l, data in shards.items():
            write(f"{nombre}/{l}.json.gz", data)
    total = sum(f.stat().st_size for f in OUT.rglob("*.gz"))
    easton = sum(1 for e in entradas.values() if e[0])
    smith = sum(1 for e in entradas.values() if e[1])
    print(f"{len(entradas)} entradas ({easton} de Easton, {smith} de Smith) y {len(temas)} temas de Nave "
          f"en {OUT} ({total / 1e6:.1f} MB)")


def publicar():
    dest = ROOT.parent / "public" / "diccionario"
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(OUT, dest)
    print(f"Diccionario copiado a {dest}")


if __name__ == "__main__":
    if "--publicar" in sys.argv:
        publicar()
    else:
        build()
