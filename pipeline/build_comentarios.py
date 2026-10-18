"""Extrae los comentarios de dominio público (en inglés) por secciones, listos para traducir.

Uso: python3 pipeline/build_comentarios.py [carpeta_salida]   (por defecto: comentarios/)

La app nunca muestra el inglés: la función /api/comentario traduce cada parte al español con IA la primera vez que
alguien la abre, la revisa y la guarda. Por eso la salida no va a public/data sino a su propia carpeta, que solo
incluye esa función.

Fuentes: módulos SWORD de CrossWire, preparados a partir de Christian Classics Ethereal Library. Dominio público.
- MHC: Matthew Henry, Commentary on the Whole Bible (1706-1721)
- JFB: Jamieson, Fausset y Brown, Commentary Critical and Explanatory on the Whole Bible (1871)

Salida: <fuente>/<libro>/<capítulo>.json.gz con una lista de secciones
  {"desde": 1, "hasta": 21, "titulo": "…", "partes": ["…", "…"]}
desde = 0 es la introducción del capítulo. El texto es markdown sencillo: párrafos separados por una línea en blanco,
**negritas**, *cursivas* y referencias como ⟦jhn.3.16⟧ o ⟦jhn.3.1-jhn.3.21⟧, que la app convierte en enlaces.
"""

import gzip
import hashlib
import html
import json
import re
import struct
import sys
import urllib.request
import zipfile
import zlib
from pathlib import Path

from books import BOOKS

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / ".cache"
KJV = "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/KJV.json"
# Copia exacta de los zip de CrossWire (mismo sha256) para cuando crosswire.org no responde.
MIRROR = "https://github.com/mattsanchez/selah/releases/download/data-v1/"
MODULES = {
    "mhc": {
        "url": "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/MHC.zip",
        "mirror": MIRROR + "matthew-henry-ac9376146621.zip",
        "sha256": "6bcb936873ca144e317805e5c1677940fd86e2403f7c14517752e44f25c8882b",
        "path": "modules/comments/zcom4/mhc/",
    },
    "jfb": {
        "url": "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/JFB.zip",
        "mirror": MIRROR + "jamieson-fausset-brown-949b6d41cd1b.zip",
        "sha256": "239be229ac0e3b83e33c9148d2e996080ba042513c540aea4c8f4915605e78b2",
        "path": "modules/comments/zcom/jfb/",
    },
}
# Palabras por parte: lo que se traduce de una vez cuando alguien pide «seguir leyendo».
PART_WORDS = 700

OSIS_TO_ID = {b[3]: b[0] for b in BOOKS}
# Abreviaturas sueltas que aparecen en las referencias de Matthew Henry
OSIS_TO_ID.update({"Ge": "gen", "De": "deu", "Pr": "pro", "Lu": "luk", "Ac": "act", "Eze": "ezk", "Php": "php",
                   "1Jo": "1jn", "1Ti": "1ti", "Ezr": "ezr", "Ho": "hos", "La": "lam", "Le": "lev"})


def fetch_module(name):
    mod = MODULES[name]
    path = CACHE / f"{name}.zip"
    if not path.exists():
        CACHE.mkdir(exist_ok=True)
        for url in (mod["url"], mod["mirror"]):
            try:
                print(f"Descargando {url}…")
                data = urllib.request.urlopen(url, timeout=120).read()
            except OSError as err:
                print(f"  no se pudo: {err}")
                continue
            if hashlib.sha256(data).hexdigest() != mod["sha256"]:
                print("  el archivo no coincide con el esperado")
                continue
            path.write_bytes(data)
            break
        else:
            raise SystemExit(f"No se pudo descargar el módulo {name}")
    return zipfile.ZipFile(path)


def verse_counts():
    path = CACHE / "kjv.json"
    if not path.exists():
        CACHE.mkdir(exist_ok=True)
        urllib.request.urlretrieve(KJV, path)
    books = json.loads(path.read_text(encoding="utf-8"))["books"]
    assert len(books) == len(BOOKS)
    counts = [[len(c["verses"]) for c in b["chapters"]] for b in books]
    text = [[[v["text"] for v in c["verses"]] for c in b["chapters"]] for b in books]
    return counts, text


def read_zcom4(zf, base, testament, books):
    """Lee un módulo zCom4. Devuelve {(libro, capítulo, versículo): (clave de bloque, texto)}.
    El versículo 0 es la introducción del capítulo. Varios versículos pueden apuntar al mismo texto (enlaces)."""
    bzs = zf.read(f"{base}{testament}.bzs")
    bzv = zf.read(f"{base}{testament}.bzv")
    bzz = zf.read(f"{base}{testament}.bzz")
    blocks = [struct.unpack_from("<III", bzs, i) for i in range(0, len(bzs), 12)]
    entries = [struct.unpack_from("<III", bzv, i) for i in range(0, len(bzv), 12)]
    cache = {}

    def block(n):
        if n not in cache:
            cache.clear()
            offset, size, _ = blocks[n]
            cache[n] = zlib.decompress(bzz[offset:offset + size])
        return cache[n]

    out = {}
    idx = 2  # 0: cabecera del módulo, 1: cabecera del testamento
    for bid, chapters in books:
        idx += 1  # introducción del libro
        for ch, nverses in enumerate(chapters, 1):
            for v in range(nverses + 1):
                bl, off, size = entries[idx]
                idx += 1
                if size:
                    out[(bid, ch, v)] = ((bl, off), block(bl)[off:off + size].decode("utf-8", "replace"))
    assert idx == len(entries), (testament, idx, len(entries))
    return out


def osis_ref(ref):
    """'John.3.1-John.3.21' -> 'jhn.3.1-jhn.3.21'; None si no se puede enlazar (apócrifos, capítulos enteros…)."""
    parts = []
    for p in ref.strip().split("-")[:2]:
        m = re.fullmatch(r"\s*(\w+)\.(\d+)\.(\d+)\s*", p)
        if not m or m.group(1) not in OSIS_TO_ID:
            return None
        parts.append(f"{OSIS_TO_ID[m.group(1)]}.{m.group(2)}.{m.group(3)}")
    return "-".join(parts)


def to_markdown(osis):
    """OSIS de SWORD -> lista de párrafos en markdown sencillo, y el título de la sección si lo hay."""
    t = osis
    titles = []

    def title(m):
        kind, text = m.group(1), strip_tags(m.group(2))
        # Sin la fecha de Ussher que trae Matthew Henry: «The Creation. (b. c. 4004.)»
        text = re.sub(r"\(\s*[ab]\. ?c\..*?\)", "", text)
        if kind != "x-s2" and text and not re.fullmatch(r"(CHAPTER|PSALM) \w+", text):
            titles.append(re.sub(r"⟦[^⟧]*⟧\.?\s*", "", text).strip(" .") or text)
        return "\n\n"

    t = re.sub(r'<reference osisRef="([^"]*)"[^>]*>(.*?)</reference>',
               lambda m: f"⟦{r}⟧" if (r := osis_ref(m.group(1))) else m.group(2), t, flags=re.S)
    t = re.sub(r'<title[^>]*type="([^"]*)"[^>]*>(.*?)</title>', title, t, flags=re.S)
    t = re.sub(r"<title[^>]*>.*?</title>", "\n\n", t, flags=re.S)
    t = re.sub(r'<hi type="bold">(.*?)</hi>', lambda m: f"**{m.group(1).strip()}** ", t, flags=re.S)
    t = re.sub(r'<hi type="italic">(.*?)</hi>', lambda m: f"*{m.group(1).strip()}* ", t, flags=re.S)
    t = re.sub(r'<hi type="super">\d+</hi>', "", t)
    t = re.sub(r'<div [^>]*type="x-p"[^>]*/>|<lg[^>]*>|</lg>|<l [^>]*eID[^>]*/>', "\n\n", t)
    t = strip_tags(t)
    paras = []
    for p in re.split(r"\n\s*\n", t):
        p = re.sub(r"\s+", " ", p).strip().replace("--", "—")
        p = re.sub(r"\*\* ([,.;:])", r"**\1", p)
        p = re.sub(r"\* ([,.;:])", r"*\1", p)
        if p:
            paras.append(p)
    return paras, titles


def strip_tags(s):
    return html.unescape(re.sub(r"<[^>]+>", " ", s)).replace(" ", " ").strip()


def split_parts(paras):
    parts, current, words = [], [], 0
    for p in paras:
        n = len(p.split())
        if current and words + n > PART_WORDS:
            parts.append("\n\n".join(current))
            current, words = [], 0
        current.append(p)
        words += n
    if current:
        parts.append("\n\n".join(current))
    return parts


def words_of(s):
    return re.findall(r"[a-z']+", s.lower())


def drop_scripture(paras, kjv):
    """Matthew Henry abre cada sección con el pasaje en la KJV; la app ya muestra el texto bíblico."""
    known = set(words_of(kjv))
    while len(paras) > 1:
        w = words_of(paras[0])
        if not w or sum(x in known for x in w) / len(w) < 0.9:
            break
        paras = paras[1:]
    return paras


def split_intro(osis):
    """En el primer versículo, Matthew Henry trae a veces el prefacio del libro y la introducción del capítulo.
    Devuelve (introducción del capítulo, resto); el prefacio del libro se descarta."""
    start = re.search(r'<div sID="[^"]*" type="introduction"/>', osis)
    end = re.search(r'<div eID="[^"]*" type="introduction"/>', osis)
    if not end:
        return "", osis
    intro = osis[start.end():end.start()] if start and start.start() < end.start() else ""
    return intro, osis[end.end():]


def build(name, out, counts, kjv):
    mod = MODULES[name]
    zf = fetch_module(name)
    entries = {}
    for testament, books in (("ot", BOOKS[:39]), ("nt", BOOKS[39:])):
        start = 0 if testament == "ot" else 39
        entries.update(read_zcom4(zf, mod["path"], testament,
                                  [(b[0], counts[start + i]) for i, b in enumerate(books)]))
    total = words = 0
    for i, b in enumerate(BOOKS):
        for ch, nverses in enumerate(counts[i], 1):
            sections, prev = [], None
            for v in range(nverses + 1):
                entry = entries.get((b[0], ch, v))
                if not entry:
                    continue
                key, osis = entry
                if key == prev:
                    sections[-1]["hasta"] = v
                    continue
                prev = key
                if name == "mhc" and v:
                    intro, osis = split_intro(osis)
                    intro = to_markdown(intro)[0] if intro else []
                    if intro and not sections:
                        sections.append({"desde": 0, "hasta": 0, "titulo": "", "paras": intro})
                paras, titles = to_markdown(osis)
                if name == "mhc" and v:
                    paras = drop_scripture(paras, " ".join(kjv[i][ch - 1]))
                if not paras:
                    continue
                sections.append({"desde": v, "hasta": v, "titulo": titles[-1] if titles else "", "paras": paras})
            for s in sections:
                s["partes"] = split_parts(s.pop("paras"))
                words += sum(len(p.split()) for p in s["partes"])
            if sections:
                path = out / name / b[0] / f"{ch}.json.gz"
                path.parent.mkdir(parents=True, exist_ok=True)
                data = json.dumps(sections, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
                path.write_bytes(gzip.compress(data, mtime=0))
                total += len(sections)
    print(f"{name}: {total} secciones, {words:,} palabras")


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "comentarios"
    counts, kjv = verse_counts()
    for name in MODULES:
        build(name, out, counts, kjv)


if __name__ == "__main__":
    main()
