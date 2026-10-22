"""Divide por secciones las obras de teología e historia de la Iglesia de dominio público que lee la IA del estudio.

Uso:
  python3 pipeline/build_teologia.py            genera pipeline/teologia/ desde las fuentes (pipeline/.cache/teologia/)
  python3 pipeline/build_teologia.py --publicar copia pipeline/teologia/ a public/teologia/ (lo que hace el despliegue)

Las fuentes son copias de CCEL, Internet Archive, Project Gutenberg y biblicalstudies.org.uk (lista en
pipeline/teologia_fuentes.txt) que .github/workflows/teologia-fuentes.yml deja en la versión «teologia-fuentes-v1»
del repositorio. Todas son de dominio público: autores muertos hace más de 70 años y ediciones anteriores a 1929.
El resultado va en el repositorio (pipeline/teologia/), así el despliegue no depende de esos sitios ni de pdftotext.

Salida:
  indice.json.gz   {"obras": [...], "secciones": [[obra, título, url, {palabra: peso}], ...]}
  textos/<k>.json.gz  {"<n.º de sección>": ["párrafo", ...]} con las secciones 40·k a 40·k+39
La app nunca muestra el inglés: api/_teologia.ts busca en el índice y la IA explica en español lo que lee.
"""

import difflib
import gzip
import html
import json
import math
import re
import shutil
import subprocess
import sys
import urllib.request
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CACHE = ROOT / ".cache" / "teologia"
OUT = ROOT / "teologia"
RELEASE = "https://github.com/mikews93/biblia-de-estudio/releases/download/teologia-fuentes-v1/"

# Palabras por sección: lo que la IA lee como mucho de una vez. Las secciones más largas se parten.
SECTION_WORDS = 900
MIN_WORDS = 60
# Palabras del índice por sección
TERMS = 40
# Secciones por archivo de texto: la IA lee pocas secciones y así no se descarga una obra entera
SHARD = 40

# Las mismas reglas que terms() en api/_teologia.ts
STOP = set(
    "the of and to in a is that it be as for by with this which or are not from his he but on was they all we an at so "
    "have their them its there what our these were has who been one may if no can will also those any such than more "
    "into only would must upon do should then when how why does did".split()
)


def terms(text):
    words = re.findall(r"[a-z]{3,}", html.unescape(text).lower())
    out = []
    for w in words:
        if w in STOP:
            continue
        if len(w) > 4 and w.endswith("ies"):
            w = w[:-3] + "y"
        elif len(w) > 4 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]
        out.append(w)
    return out


ENGLISH = set("the of and to in is that it be as for by with this which or are not from his he but on was they all we "
              "an at have their them shall unto god christ him".split())


def english(text):
    """Los credos de Schaff van en latín, griego o alemán junto al inglés: solo queda el inglés."""
    words = re.findall(r"[a-zA-Z]+", text.lower())
    return len(words) >= 4 and sum(w in ENGLISH for w in words) / len(words) > 0.18


def clean(text):
    text = re.sub(r"\s+", " ", text).strip()
    return text.replace(" ,", ",").replace(" .", ".").replace(" ;", ";")


def nice_title(t):
    t = clean(html.unescape(t)).rstrip(" .")
    t = re.sub(r"^CHAPTER (\d+)\.? ?- ?", r"Chapter \1. ", t)
    letters = [c for c in t if c.isalpha()]
    if letters and sum(c.isupper() for c in letters) / len(letters) > 0.8:
        t = t.lower()
        t = re.sub(r"\b(chapter|book) ([ivxlc]+|\d+)\b", lambda m: f"{m[1].capitalize()} {m[2].upper()}", t)
        t = t[0].upper() + t[1:]
        t = re.sub(r"([.:] )([a-z])", lambda m: m[1] + m[2].upper(), t)
        t = re.sub(r"\b(god|christ|jesus|lord|holy spirit|spirit|scripture|scriptures|church|adam)\b",
                   lambda m: m[0].title(), t)
    if len(t) > 120:
        t = t[:117].rsplit(" ", 1)[0] + "…"
    return t


# ------------------------------------------------------------------------------------------------- Las obras

# area: sistematicas | canon | credos. Cada «parte» es un archivo de la caché.
OBRAS = [
    {"id": "hodge", "autor": "Charles Hodge", "titulo": "Systematic Theology", "corto": "Hodge, Teología sistemática",
     "año": 1872, "tradicion": "presbiteriana (Princeton)", "area": "sistematicas",
     "url": "https://ccel.org/ccel/hodge/theology1",
     "partes": [{"thml": "hodge1.xml", "ccel": "hodge/theology1", "vol": "I"},
                {"thml": "hodge2.xml", "ccel": "hodge/theology2", "vol": "II"},
                {"thml": "hodge3.xml", "ccel": "hodge/theology3", "vol": "III"}]},
    {"id": "strong", "autor": "Augustus H. Strong", "titulo": "Systematic Theology", "corto": "Strong, Teología sistemática",
     "año": 1907, "tradicion": "bautista", "area": "sistematicas",
     "url": "https://www.gutenberg.org/ebooks/44035",
     "partes": [{"gutenberg": "strong1.html", "ebook": 44035, "vol": "I"},
                {"gutenberg": "strong2.html", "ebook": 44555, "vol": "II"},
                {"gutenberg": "strong3.html", "ebook": 45283, "vol": "III"}]},
    {"id": "shedd", "autor": "William G. T. Shedd", "titulo": "Dogmatic Theology", "corto": "Shedd, Teología dogmática",
     "año": 1888, "tradicion": "presbiteriana", "area": "sistematicas",
     "url": "https://archive.org/details/dogmatictheology01sheduoft",
     "partes": [{"ocr": "shedd1.txt", "archive": "dogmatictheology01sheduoft", "vol": "I", "desde": "THE TRUE METHOD"},
                {"ocr": "shedd2.txt", "archive": "dogmatictheology02sheduoft", "vol": "II", "desde": "ANTHROPOLOGY", "segundo": True}]},
    {"id": "miley", "autor": "John Miley", "titulo": "Systematic Theology", "corto": "Miley, Teología sistemática",
     "año": 1892, "tradicion": "metodista (arminiana)", "area": "sistematicas",
     "url": "https://archive.org/details/systematictheolo01mile",
     "partes": [{"ocr": "miley1.txt", "archive": "systematictheolo01mile", "vol": "I", "desde": "INTRODUCTION", "segundo": True,
                 "faltan": {"Chapter I. Preliminary questions": "Proofs of theism",
                            "Chapter IV. Divine predicables not distinctively attributes": "God in Trinity",
                            "Chapter IX. God in creation": "God in providence",
                            "Chapter III. Question of primitive holiness": "The primitive probation",
                            "Chapter XI. Genetic law of native depravity": "Doctrine of native demerit",
                            "Chapter IX. Realistic mode of adamic sin": "Representative mode of Adamic guilt"}},
                {"ocr": "miley2.txt", "archive": "systematictheolo02mile", "vol": "II", "desde": "CHRISTOLOGY", "segundo": True,
                 "faltan": {"Chapter XI. Universality of the atonement": "Benefits of the atonement"}}]},
    {"id": "calvino", "autor": "Juan Calvino", "titulo": "Institutes of the Christian Religion (trad. Beveridge, 1845)",
     "corto": "Calvino, Institución", "año": 1559, "tradicion": "reformada", "area": "sistematicas",
     "url": "https://ccel.org/ccel/calvin/institutes",
     "partes": [{"thml": "calvino.xml", "ccel": "calvin/institutes", "roots": ["iii", "iv", "v", "vi"]}]},
    {"id": "credos", "autor": "Philip Schaff (ed.)", "titulo": "The Creeds of Christendom", "corto": "Credos y confesiones (Schaff)",
     "año": 1877, "tradicion": "credos de la Iglesia y de la Reforma", "area": "credos",
     "url": "https://ccel.org/ccel/schaff/creeds3",
     "partes": [{"thml": "credos2.xml", "ccel": "schaff/creeds2", "roots": ["iv.i"]},
                {"thml": "credos3.xml", "ccel": "schaff/creeds3",
                 "roots": ["iii.ii", "iv.vi", "iv.viii", "iv.xi", "iv.xvi", "iv.xvii", "iv.xviii", "v.ii", "v.vi", "v.ix"]}]},
    {"id": "eusebio", "autor": "Eusebio de Cesarea", "titulo": "Church History (trad. McGiffert, 1890)",
     "corto": "Eusebio, Historia eclesiástica", "año": 325, "tradicion": "historia de la Iglesia antigua", "area": "canon",
     "url": "https://ccel.org/ccel/schaff/npnf201",
     "partes": [{"thml": "eusebio.xml", "ccel": "schaff/npnf201", "roots": ["iii"], "skip": ["iii.i", "iii.ii"]}]},
    {"id": "atanasio", "autor": "Atanasio de Alejandría", "titulo": "Festal Letter XXXIX (año 367)",
     "corto": "Atanasio, Carta festal 39", "año": 367, "tradicion": "Padres de la Iglesia", "area": "canon",
     "url": "https://ccel.org/ccel/schaff/npnf204.xxv.iii.iii.xxv.html",
     "partes": [{"thml": "atanasio.xml", "ccel": "schaff/npnf204", "roots": ["xxv.iii.iii.xxv"],
                 "titulo": "Festal Letter XXXIX (367): the books accepted by the Church as canonical"}]},
    {"id": "muratori", "autor": "Anónimo (siglo II)", "titulo": "Muratorian Fragment (Canon Muratorianus)",
     "corto": "Fragmento de Muratori", "año": 170, "tradicion": "Padres de la Iglesia", "area": "canon",
     "url": "https://ccel.org/ccel/schaff/anf05.v.iii.iii.html",
     "partes": [{"thml": "anf05.xml", "ccel": "schaff/anf05", "roots": ["v.iii.iii"],
                 "titulo": "Canon Muratorianus: the Muratorian fragment on the canon of the New Testament"}]},
    {"id": "westcott", "autor": "B. F. Westcott", "titulo": "A General Survey of the History of the Canon of the New Testament",
     "corto": "Westcott, Historia del canon del NT", "año": 1875, "tradicion": "anglicana", "area": "canon",
     "url": "https://biblicalstudies.org.uk/book_canon-of-the-nt_westcott.html",
     "partes": [{"pdf": "westcott.pdf"}]},
]


def fetch(name):
    path = CACHE / name
    if path.exists():
        return path
    CACHE.mkdir(parents=True, exist_ok=True)
    print(f"Descargando {name}…")
    data = urllib.request.urlopen(RELEASE + name, timeout=300).read()
    path.write_bytes(data)
    return path


# ------------------------------------------------------------------------------------------------- ThML (CCEL)

BLOCKS = {"p", "blockquote", "table", "ul", "ol", "li", "h4"}


def text_of(el):
    """El texto de un elemento sin sus notas al pie."""
    parts = []

    def walk(e):
        if e.tag in ("note", "pb") or (isinstance(e.tag, str) and e.tag.startswith("{")):
            if e.tail:
                parts.append(e.tail)
            return
        if e.text:
            parts.append(e.text)
        for c in e:
            walk(c)
        if e.tail and e is not el:
            parts.append(e.tail)

    walk(el)
    return clean("".join(parts))


def thml_sections(parte):
    from lxml import etree  # solo para generar: el despliegue solo copia

    parser = etree.XMLParser(recover=True, huge_tree=True, resolve_entities=False)
    tree = etree.parse(str(fetch(parte["thml"])), parser)
    body = tree.find(".//ThML.body")
    divs = {d.get("id"): d for d in body.iter() if isinstance(d.tag, str) and re.fullmatch(r"div\d", d.tag)}
    roots = [divs[r] for r in parte["roots"]] if parte.get("roots") else [d for d in body if isinstance(d.tag, str)]
    skip = set(parte.get("skip", []))
    work = parte["ccel"].split("/")[1]
    skip_titles = re.compile(r"^(title|title page|indexes?|index of|prefatory|preface|fac-?simile|.*table of contents)", re.I)

    def emit(div, path):
        did = div.get("id")
        if did in skip or skip_titles.match(div.get("title", "")):
            return
        title = parte.get("titulo") if div in roots and parte.get("titulo") else \
            nice_title(div.get("shorttitle") if len(div.get("title", "")) > 160 and div.get("shorttitle") else div.get("title", ""))
        here = path + [title] if title else path
        paras = []
        for child in div:
            if not isinstance(child.tag, str) or re.fullmatch(r"div\d", child.tag):
                continue
            if child.tag in BLOCKS or child.tag == "div":
                t = text_of(child)
                if t and english(t) and not re.fullmatch(r"(chapter|§)?\s*[\divxlc]+\.?", t, re.I):
                    paras.append(t)
        if paras:
            yield here, f"https://ccel.org/ccel/{parte['ccel']}/{work}.{did}.html", paras
        for child in div:
            if isinstance(child.tag, str) and re.fullmatch(r"div\d", child.tag):
                yield from emit(child, here)

    prefix = [f"Vol. {parte['vol']}"] if parte.get("vol") else []
    for r in roots:
        yield from emit(r, prefix)


# ------------------------------------------------------------------------------------------------- Gutenberg (Strong)

def gutenberg_sections(parte):
    from lxml import etree

    raw = fetch(parte["gutenberg"]).read_text(encoding="utf-8", errors="replace")
    doc = etree.HTML(raw)
    body = doc.find(".//body")
    url = f"https://www.gutenberg.org/ebooks/{parte['ebook']}"
    heads = {"h1": 1, "h2": 2, "h3": 3, "h4": 4}
    path, paras = [], []
    started = False
    out = []

    def flush():
        if paras and path:
            out.append((["Vol. " + parte["vol"]] + [p for _, p in path], url, list(paras)))
        paras.clear()

    for el in body.iter():
        if not isinstance(el.tag, str):
            continue
        if el.get("id", "").startswith("pg-footer") or "END OF THE PROJECT GUTENBERG" in (el.text or ""):
            break
        if el.tag in heads:
            t = nice_title(text_of(el))
            if "PROJECT GUTENBERG" in t.upper() and started:
                break
            if not t or "PROJECT GUTENBERG" in t.upper() or t.lower() in ("contents", "preface"):
                flush()
                started = False
                continue
            started = True
            flush()
            lvl = heads[el.tag]
            path[:] = [(l, p) for l, p in path if l < lvl] + [(lvl, t)]
        elif started and el.tag in ("p", "blockquote") and el.getparent().tag not in ("blockquote",):
            if "footnote" in " ".join(filter(None, [el.get("class"), el.getparent().get("class")])):
                continue
            t = text_of(el)
            if t and len(t.split()) > 3:
                paras.append(t)
    flush()
    return out


# ------------------------------------------------------------------------------------------------- Texto escaneado (OCR)

ROMAN = r"[IVXLCYlnm1]+"
CHAPTER = re.compile(rf"^\s*CHAP[A-Z]{{2,3}}\s+{ROMAN}[.,]?\s*$")
HEADER = re.compile(r"^\s*(\d{1,4}\s+[A-Z][A-Z'., ]{3,}\.?|[A-Z][A-Z'., ]{3,}\.?\s+\d{1,4})\s*$")


def vocabulary(raw):
    """Las palabras en minúsculas de la obra, por longitud y de más a menos frecuentes, para corregir títulos."""
    by_len = {}
    for w, _ in Counter(re.findall(r"\b[a-z]{4,}\b", raw)).most_common():
        by_len.setdefault(len(w), []).append(w)
    return by_len


def fix_word(word, vocab):
    """Corrige una palabra de un título mal leído por el OCR («KEVELATION», «TIIE») con el vocabulario de la obra."""
    w = word.lower()
    cands = vocab.get(len(w), ())
    if len(w) < 4 or w in cands:
        return w
    best, score = w, 3 if len(w) > 6 else 2
    for cand in cands:
        d = sum(a != b for a, b in zip(w, cand))
        if d < score:
            best, score = cand, d
    return best


# Lo que el vocabulario no arregla en los títulos escaneados
WORD_FIXES = {"op": "of", "foe": "for", "oe": "or", "greet": "greek", "cebist": "christ", "chkist": "christ",
              "geistetic": "genetic", "beoenebation": "regeneration", "ftjtube": "future", "element": "clement",
              "yewjsh": "jewish", "ustin": "justin", "plcists": "apologists"}


def fix_title(text, vocab):
    parts = re.findall(r"[A-Za-z]+|[^A-Za-z]+", re.sub(r"\b([A-Z]) (?=[A-Z]{2})", r"\1", text))
    fixed = (WORD_FIXES.get(fix_word(w, vocab), fix_word(w, vocab)) if w.isalpha() else w for w in parts)
    return nice_title("".join(fixed).upper()).rstrip(",\"' ")


def similar(a, b):
    na, nb = (re.sub(r"[^a-z]", "", x.lower()) for x in (a, b))
    return difflib.SequenceMatcher(None, na, nb).ratio() > 0.8


def ocr_sections(parte):
    raw = fetch(parte["ocr"]).read_text(encoding="utf-8", errors="replace")
    lines = raw.split("\n")
    vocab = vocabulary(raw)
    # El texto empieza en la primera aparición de «desde» después del índice (en algunos tomos, la segunda).
    marks = [i for i, l in enumerate(lines) if re.sub(r"\s+", " ", l.strip()).startswith(parte["desde"])]
    start = marks[1] if parte.get("segundo") and len(marks) > 1 else marks[0]
    url = f"https://archive.org/details/{parte['archive']}"
    page = None
    chapter = None
    out = []
    buf = []

    def title_from(i):
        t = []
        j = i + 1
        while j < len(lines) and len(t) < 2:
            s = lines[j].strip()
            j += 1
            if not s:
                if t:
                    break
                continue
            if s.upper() == s and re.search(r"[A-Z]{3}", s):
                t.append(s)
            else:
                break
        return fix_title(" ".join(t), vocab), j

    def flush():
        text = clean(" ".join(buf))
        buf.clear()
        if not chapter or len(text.split()) < MIN_WORDS:
            return
        paras = paragraphs(text)
        out.append(([f"Vol. {parte['vol']}", chapter],
                    f"{url}/page/{chapter_page}" if chapter_page else url, paras))

    chapter_page = None
    i = start
    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if CHAPTER.match(line):
            flush()
            num = re.sub(r"[^IVXLCYlnm1]", "", s.split(None, 1)[1])
            # Los capítulos no pasan de 40: una «L» es una «I» mal leída
            num = num.replace("Y", "V").replace("n", "II").replace("m", "III").replace("l", "I").replace("1", "I").replace("L", "I")
            title, i = title_from(i)
            # Títulos que el OCR no dejó leer, por el capítulo anterior
            title = title or parte.get("faltan", {}).get(chapter, "")
            chapter = f"Chapter {num}. {title}" if title else f"Chapter {num}"
            chapter_page = page + 1 if page else None
            continue
        m = HEADER.match(line)
        if m:
            n = re.search(r"\d+", s)
            page = int(n[0])
            i += 1
            continue
        if s:
            # Notas al margen y al pie: líneas muy cortas o que empiezan con signos de llamada
            if len(s) < 25 and not s.endswith((".", ",", ";")):
                i += 1
                continue
            if re.match(r"^[\^'\"*°§t]\s", s) or re.match(r"^\d\s+[A-Z]", s):
                i += 1
                continue
            if buf and buf[-1].endswith("-"):
                buf[-1] = buf[-1][:-1] + s
            else:
                buf.append(s)
        i += 1
    flush()
    # Partes largas: secciones de SECTION_WORDS
    return out


# ------------------------------------------------------------------------------------------------- PDF (Westcott)

def paragraphs(text):
    """Texto escaneado sin párrafos fiables: trozos de unas 220 palabras cortados en un punto."""
    sentences = re.split(r"(?<=[.?!])\s+(?=[A-Z])", text)
    paras, cur = [], []
    for s in sentences:
        cur.append(s)
        if len(" ".join(cur).split()) > 220:
            paras.append(" ".join(cur))
            cur = []
    if cur:
        paras.append(" ".join(cur))
    return paras


CHAPTERS = re.compile(r"^(The age of|The early|The canon of the ack|The testimony|The disputed|The sixteenth|Introduction|"
                      r"Appendix|On the)", re.I)
NOT_TOPIC = re.compile(r"^(Chapter|Part|Index|During the first eight|.{0,3}$)", re.I)
# Títulos de Westcott que el OCR deja mal y el vocabulario no arregla
WESTCOTT_FIXES = [
    (r"centur v", "century"), (r"piocletian", "Diocletian"), (r"\bsible\b", "Bible"), (r"aura tory", "Muratori"),
    (r"ka non", "kanon"), (r"\bti[il]e\b|\btje\b", "the"), (r"lren\W*\w*", "Irenaeus"), (r"erojiie", "Jerome"),
    (r"yohn", "John"), (r"eutiialius", "Euthalius"), (r"mvratorian", "Muratorian"), (r"laodjcea", "Laodicea"),
    (r"la odicenes", "Laodiceans"), (r"ijasilides|basildes", "Basilides"), (r"isworus carpocrates", "Isidorus, Carpocrates"),
    (r"time lljj la tin|old latis", "old Latin"), (r"pesiiito|peshto", "Peshito"), (r"tertullia\.v", "Tertullian"),
    (r"methodivs", "Methodius"), (r"aleandria", "Alexandria"), (r"nic\.ea", "Nicaea"), (r"treat\.", "Trent"),
    (r"tyndale'shew testajiie\.nt", "Tyndale's New Testament"), (r"'he evangelista", "The evangelists"),
    (r"merito of sardis", "Melito of Sardis"), (r"the debated", "The debates"), (r"neo-caz,area", "Neo-Caesarea"),
    (r"acig\.vowledged|acknowle\.dge\.d ?books", "acknowledged books"), (r"\bce'ntary", "century"),
    (r"the 'donatists", "The Donatists"), (r"the\.' age", "The age"), (r"ii\.\. at the", "At the"),
    (r"\. part$", ""), (r"\bgreek\b", "Greek"), (r"\brome\b", "Rome"), (r"\bcanon\b", "Canon"),
    (r"\bnew testament\b", "New Testament"), (r"\bcorinth\b", "Corinth"), (r"\bantioch\b", "Antioch"),
]


def westcott_title(t):
    for a, b in WESTCOTT_FIXES:
        t = re.sub(a, b, t, flags=re.I)
    t = clean(t.replace(".", ". ")).rstrip(". ")
    return t[0].upper() + t[1:] if t else t
BOOK_TITLE = re.compile(r"HISTORY OF T.{1,3}E CANON|^OF THE NEW TESTAMENT")


def pdf_sections(parte):
    """Westcott: cada página lleva arriba el título del capítulo (páginas pares) o del tema (impares)."""
    path = fetch(parte["pdf"])
    text = subprocess.run(["pdftotext", str(path), "-"], capture_output=True, text=True, check=True).stdout
    vocab = vocabulary(text)
    url = OBRAS_BY_FILE[parte["pdf"]]["url"]
    out = []
    chapter = topic = None
    current, buf = None, []

    def flush():
        body = clean(" ".join(buf))
        buf.clear()
        if current and len(body.split()) >= MIN_WORDS:
            out.append((list(current), url, paragraphs(body)))

    started = seen_contents = False
    for pg in text.split("\f"):
        lines = [l.strip() for l in pg.split("\n")]
        head = [l for l in lines[:6] if l]
        caps = [l for l in head[:4] if len(l) > 8 and l.upper() == l and re.search(r"[A-Z]{4}", l)]
        title = next((c for c in caps if not BOOK_TITLE.search(c)), None)
        if title:
            t = westcott_title(fix_title(re.sub(r"^\W+|\d+$|[^A-Za-z. ,'-]", "", title).strip(" .,"), vocab))
            # Las páginas pares llevan el capítulo y las impares el tema, pero la paridad del PDF no es fiable
            if NOT_TOPIC.match(t) or chapter and similar(t, chapter) or topic and similar(t, topic):
                pass
            elif CHAPTERS.match(t):
                chapter, topic = t, None
            else:
                topic = t
        if not started:
            # El texto empieza después del índice
            if any("CONTENTS" in h for h in head[:3]):
                seen_contents = True
                continue
            if not seen_contents:
                continue
            started = True
            chapter, topic = "Introduction", None
        key = tuple(dict.fromkeys(x for x in (chapter, topic) if x))
        if key != current:
            flush()
            current = key
        for l in lines:
            if not l or l in head[:3] and (BOOK_TITLE.search(l) or l == title or re.fullmatch(r"[\d\[\]IVXl.]+", l)):
                continue
            # Notas al margen: líneas cortas sin puntuación final; referencias de capítulo
            if len(l) < 25 and not l.endswith((".", ",", ";", ":")) or re.match(r"^(Chap|\[PART)", l):
                continue
            if buf and buf[-1].endswith("-"):
                buf[-1] = buf[-1][:-1] + l
            else:
                buf.append(l)
    flush()
    return out


OBRAS_BY_FILE = {p.get("pdf"): o for o in OBRAS for p in o["partes"] if p.get("pdf")}


# ------------------------------------------------------------------------------------------------- Índice

def split(sections):
    """Parte las secciones largas en trozos de SECTION_WORDS palabras, por párrafos."""
    for path, url, paras in sections:
        chunks, cur, n = [], [], 0
        for p in paras:
            w = len(p.split())
            if cur and n + w > SECTION_WORDS:
                chunks.append(cur)
                cur, n = [], 0
            cur.append(p)
            n += w
        if cur:
            chunks.append(cur)
        for k, c in enumerate(chunks):
            if sum(len(p.split()) for p in c) < MIN_WORDS:
                continue
            title = " › ".join(path) + (f" ({k + 1}/{len(chunks)})" if len(chunks) > 1 else "")
            yield title, url, c


def build():
    OUT.mkdir(exist_ok=True)
    obras, secciones, textos = [], [], []
    for o in OBRAS:
        sections = []
        for parte in o["partes"]:
            try:
                if "thml" in parte:
                    sections += list(thml_sections(parte))
                elif "gutenberg" in parte:
                    sections += gutenberg_sections(parte)
                elif "ocr" in parte:
                    sections += ocr_sections(parte)
                else:
                    sections += pdf_sections(parte)
            except OSError as err:
                print(f"  {o['id']}: no se pudo leer {parte}: {err}")
        chunks = list(split(sections))
        if not chunks:
            print(f"  {o['id']}: sin secciones, se omite")
            continue
        oi = len(obras)
        obras.append({k: o[k] for k in ("id", "autor", "titulo", "corto", "año", "tradicion", "area", "url")})
        texto = {}
        for title, url, paras in chunks:
            texto[str(len(secciones))] = paras
            secciones.append([oi, title, url, Counter(terms(title + " " + " ".join(paras)))])
        textos.append((o["id"], texto))
        print(f"  {o['id']}: {len(chunks)} secciones, {sum(len(p.split()) for _, _, ps in chunks for p in ps)} palabras")

    # tf-idf: en cada sección las palabras que más la distinguen, con peso de 0 a 1
    df = Counter()
    for s in secciones:
        df.update(s[3].keys())
    N = len(secciones)
    for s in secciones:
        tf = s[3]
        length = sum(tf.values()) or 1
        scores = {w: (1 + math.log(n)) * math.log(N / df[w]) / math.log(10 + length / 50) for w, n in tf.items() if df[w] < N * 0.5}
        top = sorted(scores.items(), key=lambda kv: -kv[1])[:TERMS]
        mx = top[0][1] if top else 1
        s[3] = {w: round(v / mx, 2) for w, v in top}

    def write(name, data):
        raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode()
        # mtime fijo: el mismo contenido da el mismo archivo y git no ve cambios
        (OUT / name).write_bytes(gzip.compress(raw, 9, mtime=0))

    shutil.rmtree(OUT)
    (OUT / "textos").mkdir(parents=True)
    write("indice.json.gz", {"obras": obras, "secciones": secciones})
    shards = {}
    for _, texto in textos:
        for n, paras in texto.items():
            shards.setdefault(int(n) // SHARD, {})[n] = paras
    for k, texto in shards.items():
        write(f"textos/{k}.json.gz", texto)
    total = sum(f.stat().st_size for f in OUT.rglob("*.gz"))
    print(f"{len(secciones)} secciones de {len(obras)} obras en {OUT} ({total / 1e6:.1f} MB)")


def publicar():
    dest = ROOT.parent / "public" / "teologia"
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(OUT, dest)
    print(f"Teología copiada a {dest}")


if __name__ == "__main__":
    if "--publicar" in sys.argv:
        publicar()
    else:
        build()
