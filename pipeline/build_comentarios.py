"""Extrae los comentarios libres (en inglés) por secciones, listos para traducir.

Uso: python3 pipeline/build_comentarios.py [carpeta_salida] [fuente ...]   (por defecto: public/comentarios, todas)

La app nunca muestra el inglés: la función /api/comentario traduce cada parte al español con IA la primera vez que
alguien la abre, la revisa y la guarda. La IA de Estudiar lee el original de las secciones del pasaje. La salida va a
su propia carpeta, fuera de public/data, para no engordar las demás funciones, que incluyen dist/data.

Fuentes (src/lib/comentarioFuentes.ts tiene sus créditos):
- Módulos SWORD de CrossWire, de dominio público: Matthew Henry, Jamieson-Fausset-Brown, Adam Clarke, Albert Barnes
  (NT), Juan Calvino, Keil y Delitzsch (AT), Spurgeon (El tesoro de David, Salmos), John Wesley y Scofield (1917).
- Tyndale Open Study Notes (Tyndale House Publishers, 2022), CC BY-SA 4.0: notas versículo a versículo e
  introducciones de cada libro.

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
import xml.etree.ElementTree as ET
import zipfile
import zlib
from html.parser import HTMLParser
from pathlib import Path

from books import BOOKS

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / ".cache"
KJV = "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/KJV.json"
CROSSWIRE = "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/"
# Copia exacta de algunos zip (mismo sha256) para cuando crosswire.org no responde.
MIRROR = "https://github.com/mattsanchez/selah/releases/download/data-v1/"
# url: CrossWire (o la fuente original); mirror y sha256 cuando hay copia fija. Sin sha256 se acepta lo que sirva
# CrossWire, que a veces publica versiones nuevas del mismo módulo.
MODULES = {
    "tosn": {"url": MIRROR + "tyndale-0a1fc04a840b.zip",
             "sha256": "7b4d5ae088449d5a6925170c4b89b978acee2f78f73dc6b8a278fa948a7e8498"},
    "mhc": {"url": CROSSWIRE + "MHC.zip", "mirror": MIRROR + "matthew-henry-ac9376146621.zip",
            "sha256": "6bcb936873ca144e317805e5c1677940fd86e2403f7c14517752e44f25c8882b"},
    "jfb": {"url": CROSSWIRE + "JFB.zip", "mirror": MIRROR + "jamieson-fausset-brown-949b6d41cd1b.zip",
            "sha256": "239be229ac0e3b83e33c9148d2e996080ba042513c540aea4c8f4915605e78b2"},
    "clarke": {"url": CROSSWIRE + "Clarke.zip", "mirror": MIRROR + "adam-clarke-a9c17be3f5e5.zip",
               "sha256": "56bb33d3bf0f50c1609f4dd10ac81e7450bb0e8aae93bf340074ccb5e207a44f"},
    "barnes": {"url": CROSSWIRE + "Barnes.zip"},
    "calvin": {"url": CROSSWIRE + "CalvinCommentaries.zip"},
    "kd": {"url": CROSSWIRE + "KD.zip"},
    "tdavid": {"url": CROSSWIRE + "TDavid.zip"},
    "wesley": {"url": CROSSWIRE + "Wesley.zip"},
    "scofield": {"url": CROSSWIRE + "Scofield.zip"},
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
        for url in filter(None, (mod["url"], mod.get("mirror"))):
            try:
                print(f"Descargando {url}…")
                data = urllib.request.urlopen(url, timeout=180).read()
            except OSError as err:
                print(f"  no se pudo: {err}")
                continue
            digest = hashlib.sha256(data).hexdigest()
            if mod.get("sha256") and digest != mod["sha256"]:
                print("  el archivo no coincide con el esperado")
                continue
            if not mod.get("sha256"):
                print(f"  sha256 {digest}")
            path.write_bytes(data)
            break
        else:
            raise SystemExit(f"No se pudo descargar el módulo {name}")
    return zipfile.ZipFile(path)


def module_conf(zf):
    """Los campos del .conf del módulo SWORD (ModDrv, DataPath, SourceType…)."""
    conf = next(n for n in zf.namelist() if n.startswith("mods.d/") and n.endswith(".conf"))
    out = {}
    for line in zf.read(conf).decode("utf-8", "replace").splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            out.setdefault(k.strip(), v.strip())
    return out


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


def read_zcom(zf, base, testament, books, entry_size):
    """Lee un módulo zCom (entradas de 10 bytes) o zCom4 (12 bytes).
    Devuelve {(libro, capítulo, versículo): (clave de bloque, texto)}.
    El versículo 0 es la introducción del capítulo. Varios versículos pueden apuntar al mismo texto (enlaces)."""
    names = set(zf.namelist())
    kind = next((k for k in "bcv" if f"{base}{testament}.{k}zv" in names), None)
    if not kind:
        return {}
    bzs = zf.read(f"{base}{testament}.{kind}zs")
    bzv = zf.read(f"{base}{testament}.{kind}zv")
    bzz = zf.read(f"{base}{testament}.{kind}zz")
    if not bzs:
        return {}
    fmt = "<III" if entry_size == 12 else "<IIH"
    blocks = [struct.unpack_from("<III", bzs, i) for i in range(0, len(bzs), 12)]
    entries = [struct.unpack_from(fmt, bzv, i) for i in range(0, len(bzv), entry_size)]
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
    return clean_paras(strip_tags(t)), titles


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


def drop_preface(paras, verse):
    """Calvino trae a veces, antes de la nota «**1.**», el prefacio del traductor y la dedicatoria del libro: páginas
    que no comentan el pasaje. Un argumento corto del capítulo sí se queda."""
    start = next((i for i, p in enumerate(paras) if p.startswith(f"**{verse}.**")), 0)
    if sum(len(p.split()) for p in paras[:start]) > 1200:
        return paras[start:]
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


def thml_to_markdown(t):
    """ThML (HTML de los módulos de Barnes y Wesley) -> párrafos en markdown sencillo."""
    t = re.sub(r"<scripRef[^>]*>(.*?)</scripRef>", r"\1", t, flags=re.S)
    t = re.sub(r"<(b|strong)>(.*?)</\1>", lambda m: f"**{m.group(2).strip()}** ", t, flags=re.S)
    t = re.sub(r"<(i|em)>(.*?)</\1>", lambda m: f"*{m.group(2).strip()}* ", t, flags=re.S)
    t = re.sub(r"<br\s*/?>\s*(<br\s*/?>)?|</?p[^>]*>|</?div[^>]*>", "\n\n", t)
    t = strip_tags(t)
    return clean_paras(t), []


def clean_paras(t):
    paras = []
    for p in re.split(r"\n\s*\n", t):
        p = re.sub(r"\s+", " ", p).strip().replace("--", "—")
        p = re.sub(r"\*\* ([,.;:])", r"**\1", p)
        p = re.sub(r"\* ([,.;:])", r"*\1", p)
        if p:
            paras.append(p)
    return paras


def write_chapter(out, name, book, ch, sections):
    for s in sections:
        if "paras" in s:
            s["partes"] = split_parts(s.pop("paras"))
    path = out / name / book / f"{ch}.json.gz"
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(sections, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    path.write_bytes(gzip.compress(data, mtime=0))
    return len(sections), sum(len(p.split()) for s in sections for p in s["partes"])


def build(name, out, counts, kjv):
    zf = fetch_module(name)
    conf = module_conf(zf)
    base = conf["DataPath"].lstrip("./").rstrip("/") + "/"
    entry_size = 12 if conf.get("ModDrv", "").lower() == "zcom4" else 10
    convert = thml_to_markdown if conf.get("SourceType", "").upper() == "THML" else to_markdown
    entries = {}
    for testament, books in (("ot", BOOKS[:39]), ("nt", BOOKS[39:])):
        start = 0 if testament == "ot" else 39
        entries.update(read_zcom(zf, base, testament,
                                 [(b[0], counts[start + i]) for i, b in enumerate(books)], entry_size))
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
                paras, titles = convert(osis)
                if name == "mhc" and v:
                    paras = drop_scripture(paras, " ".join(kjv[i][ch - 1]))
                if name == "calvin" and v:
                    paras = drop_preface(paras, v)
                if not paras:
                    continue
                sections.append({"desde": v, "hasta": v, "titulo": titles[-1] if titles else "", "paras": paras})
            if sections:
                n, w = write_chapter(out, name, b[0], ch, sections)
                total += n
                words += w
    print(f"{name}: {total} secciones, {words:,} palabras")


# Tyndale Open Study Notes: los códigos de libro que no coinciden con los de OpenBible.info
TOSN_BOOKS = {"Pr": "pro", "Jon": "jon", "Hagg": "hag", "1Thes": "1th", "2Thes": "2th",
              "1Jn": "1jn", "2Jn": "2jn", "3Jn": "3jn"}
# Clases que se muestran en cursiva o negrita
TOSN_ITALIC = {"sn-excerpt", "ital", "greek", "hebrew", "aramaic", "latin", "sn-hebrew-chars", "divine-name-ital"}
TOSN_BOLD = {"sn-ref", "bold", "intro-h2", "ital-bold"}


def tosn_book(code):
    return OSIS_TO_ID.get(code) or TOSN_BOOKS.get(code)


def tosn_ref(ref):
    """'Gen.1.22-25' o 'Gen.1.1-2.3' -> 'gen.1.22-gen.1.25'; None si no se puede enlazar."""
    m = re.fullmatch(r"(\w+)\.(\d+)\.(\d+)(?:-(?:(\d+)\.)?(\d+))?", ref)
    book = m and tosn_book(m.group(1))
    if not book:
        return None
    ch, v = int(m.group(2)), int(m.group(3))
    if not m.group(5):
        return f"{book}.{ch}.{v}"
    ch2, v2 = int(m.group(4) or ch), int(m.group(5))
    if (ch2, v2) <= (ch, v):
        return f"{book}.{ch}.{v}"
    return f"{book}.{ch}.{v}-{book}.{ch2}.{v2}"


class TosnHtml(HTMLParser):
    """Cuerpo HTML de una nota de Tyndale -> párrafos en markdown sencillo, con las referencias como ⟦…⟧."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.paras, self.text, self.stack, self.link = [], "", [], None
        self.italic = self.bold = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = set((a.get("class") or "").split())
        if tag == "p":
            self.flush()
            self.text = "- " if any(c.startswith(("sn-list", "intro-list", "theme-list")) for c in cls) else ""
            self.stack.append("")
            if cls & {"intro-h1", "intro-title", "intro-sidebar-h1", "theme-h2"}:
                self.text += "**"
                self.stack[-1] = "**"
            return
        mark = ""
        if tag == "a" and (a.get("href") or "").startswith("?bref="):
            # El versículo que encabeza la nota («3:16») se deja en negrita, sin enlace.
            self.link = [None if self.bold else tosn_ref(a["href"][6:]), ""]
        elif cls & TOSN_BOLD and not self.bold:
            mark = "**"
            self.bold += 1
        elif cls & TOSN_ITALIC and not self.italic:
            mark = "*"
            self.italic += 1
        self.text += mark
        self.stack.append(mark)

    def handle_endtag(self, tag):
        if tag == "a" and self.link is not None:
            ref, text = self.link
            self.link = None
            self.text += f"⟦{ref}⟧" if ref else text
        mark = self.stack.pop() if self.stack else ""
        if mark == "**":
            self.bold = max(0, self.bold - 1)
        elif mark == "*":
            self.italic = max(0, self.italic - 1)
        if tag == "p":
            self.text = self.text.rstrip() + mark
            self.flush()
        else:
            self.text = self.text.rstrip() + mark + " " if mark and self.text.endswith(" ") else self.text + mark

    def handle_data(self, data):
        if self.link is not None:
            self.link[1] += data
        else:
            self.text += data

    def flush(self):
        # Cada «•» separa dos notas sobre el mismo versículo: van en párrafos distintos.
        for part in re.split(r"\s+•\s+", self.text):
            part = re.sub(r"\s+", " ", part).strip().replace("****", "")
            if part.strip("*- "):
                self.paras.append(part)
        self.text = ""


def tosn_body(item):
    parser = TosnHtml()
    body = item.find("body")
    parser.feed("".join(ET.tostring(c, encoding="unicode") for c in body) if body is not None else "")
    parser.close()
    parser.flush()
    return parser.paras


def build_tosn(out, counts):
    zf = fetch_module("tosn")

    def items(name):
        path = next(n for n in zf.namelist() if n.endswith("/" + name))
        return ET.fromstring(zf.read(path)).iter("item")

    index = {b[0]: i for i, b in enumerate(BOOKS)}
    chapters = {}
    # Introducciones: el resumen y la introducción larga de cada libro abren su capítulo 1.
    for name in ("BookIntroSummaries.xml", "BookIntros.xml"):
        for item in items(name):
            book = tosn_book(item.findtext("refs").split(".")[0])
            title = item.findtext("title") or ""
            sections = chapters.setdefault((book, 1), {})
            s = sections.setdefault(0, {"desde": 0, "hasta": 0, "titulo": f"Introducción: {title}", "paras": []})
            s["paras"] += tosn_body(item)
    for item in items("StudyNotes.xml"):
        ref = item.findtext("refs").strip()
        m = re.fullmatch(r"(\w+)\.(\d+)(?:\.(\d+|title))?(?:-.*)?", ref)
        book = m and tosn_book(m.group(1))
        if not book:
            print(f"  tosn: referencia sin libro {ref}")
            continue
        ch = int(m.group(2))
        if ch > len(counts[index[book]]):
            continue
        v = 0 if m.group(3) in (None, "title") else min(int(m.group(3)), counts[index[book]][ch - 1])
        paras = tosn_body(item)
        if not paras:
            continue
        # Las notas de un tramo (1:1–2:3) van con su primer versículo, antes que la nota de ese versículo.
        sections = chapters.setdefault((book, ch), {})
        s = sections.setdefault(v, {"desde": v, "hasta": v, "titulo": "", "paras": []})
        s["paras"] += paras
    total = words = 0
    for (book, ch), sections in chapters.items():
        n, w = write_chapter(out, "tosn", book, ch, [sections[v] for v in sorted(sections)])
        total += n
        words += w
    print(f"tosn: {total} secciones, {words:,} palabras")


def main():
    args = sys.argv[1:]
    out = Path(args[0]) if args else ROOT.parent / "public" / "comentarios"
    names = args[1:] or list(MODULES)
    counts, kjv = verse_counts()
    for name in names:
        if name == "tosn":
            build_tosn(out, counts)
        else:
            build(name, out, counts, kjv)


if __name__ == "__main__":
    main()
