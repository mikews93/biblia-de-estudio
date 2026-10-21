"""Fichas de personas y lugares: una por cada persona o lugar de la Biblia, con su familia, su ubicación, dónde aparece
y sus versículos clave.

Fuente: STEPBible TIPNR (Translators Individualised Proper Names with all References, Tyndale House, CC BY 4.0),
commit fijado. TIPNR distingue a cada persona o lugar en cada versículo (los tres Zacarías, las dos Belén), da la
familia y un artículo breve en inglés. Ese artículo no se muestra en inglés: /api/comentario lo traduce la primera vez
que alguien abre la ficha y lo guarda para todos (ver api/comentario.ts).

Se juntan con lo que ya tiene la app:
- Los lugares, con OpenBible.info Bible Geocoding Data (coordenadas, alternativas y foto libre), por el nombre de
  OpenBible que da TIPNR.
- Las personas, con las genealogías de Theographic (pipeline/genealogias.py), por los versículos en común, para abrir
  su árbol familiar.
- Los nombres en español, de la RV1909: el nombre propio de los versículos que más se parece al inglés (o el de las
  genealogías), igual que en los mapas.

Salida:
- fichas/f/<id>.json: la ficha completa
- fichas/indice.json: [id, nombre, tipo, breve, menciones, otros nombres] para buscar
- fichas/cap/<libro>/<cap>.json: [id, nombre, tipo, versículos, formas] de las personas y lugares del capítulo
- fichas/genealogia.json: {id de Theographic: id de la ficha}
- fichas/openbible.json: {id de OpenBible: id de la ficha}
"""

import difflib
import json
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

import genealogias
from books import BOOKS
from build_data import (CACHE, PLACE_NAMES, PROPER, ROOT, STEP_TO_ID, XREF_TO_ID, fetch as fetch_data,
                        phonetic, photo_for, place_photos, write)

TIPNR_COMMIT = "ed476a8ee6e3f7b3a46fc48af6c7dabc02387b1d"
TIPNR_FILE = "tipnr.txt"
TIPNR_URL = (f"https://raw.githubusercontent.com/STEPBible/STEPBible-Data/{TIPNR_COMMIT}/Proper%20Nouns/"
             "TIPNR%20-%20Translators%20Individualised%20Proper%20Names%20with%20all%20References%20-%20STEPBible.org%20CC%20BY.txt")

ORDER = {b[0]: i for i, b in enumerate(BOOKS)}
OT = {b[0] for b in BOOKS[:39]}
MAX_KEY_VERSES = 6
MAX_PLACES = 10
MAX_PEOPLE = 12

# Libros como los escriben los artículos de TIPNR: «Exo.4.14», «Joshua 19:15», «Josh 19:15», «Psalm 23:1»
BOOK_NAMES = {}
for b in BOOKS:
    for name in (b[3], b[4], b[5].replace("-", " "), b[0]):
        BOOK_NAMES[re.sub(r"[\s.]", "", name.lower())] = b[0]
BOOK_NAMES.update({"psalms": "psa", "songofsongs": "sng", "song": "sng", "ezekiel": "ezk", "ezek": "ezk",
                   "judges": "jdg", "mark": "mrk", "matt": "mat", "philemon": "phm", "phil": "php", "jude": "jud",
                   "1kings": "1ki", "2kings": "2ki", "1chronicles": "1ch", "2chronicles": "2ch", "songofsolomon": "sng"})

ERAS = [
    ("before the Flood", "Antes del diluvio"),
    ("the Patriarchs", "Los patriarcas"),
    ("Egypt and Wilderness", "Egipto y el desierto"),
    ("Conquest", "La conquista de Canaán"),
    ("before Israel's Monarchy", "Antes de los reyes"),
    ("United Monarchy", "El reino unido"),
    ("Divided Monarchy", "El reino dividido"),
    ("Exile and Return", "El exilio y el regreso"),
    ("the New Testament", "El Nuevo Testamento"),
]
# Para la descripción breve de quien no tiene familia conocida: «Profeta, en tiempos del reino dividido»
ERA_WHEN = {
    "Antes del diluvio": "antes del diluvio", "Los patriarcas": "en tiempos de los patriarcas",
    "Egipto y el desierto": "en Egipto y el desierto", "La conquista de Canaán": "en tiempos de la conquista",
    "Antes de los reyes": "antes de los reyes", "El reino unido": "en tiempos del reino unido",
    "El reino dividido": "en tiempos del reino dividido", "El exilio y el regreso": "en tiempos del exilio y el regreso",
    "El Nuevo Testamento": "en tiempos del Nuevo Testamento",
}

# [masculino, femenino]
ROLES = {
    "Levite": ["Levita", "Levita"], "King": ["Rey", "Reina"], "Queen": ["Reina", "Reina"],
    "Warrior": ["Guerrero", "Guerrera"], "Edomite": ["Edomita", "Edomita"], "Priest": ["Sacerdote", "Sacerdotisa"],
    "Prophet": ["Profeta", "Profetisa"], "Prophetess": ["Profetisa", "Profetisa"], "Singer": ["Cantor", "Cantora"],
    "High Priest": ["Sumo sacerdote", "Sumo sacerdote"], "Judge": ["Juez", "Jueza"], "Apostle": ["Apóstol", "Apóstol"],
    "Pharaoh": ["Faraón", "Faraón"], "Arabian": ["Árabe", "Árabe"], "Emperor": ["Emperador", "Emperatriz"],
    "Giant": ["Gigante", "Gigante"], "Tetrarch": ["Tetrarca", "Tetrarca"], "Ammonite": ["Amonita", "Amonita"],
    "Moabite": ["Moabita", "Moabita"], "Ruler": ["Gobernante", "Gobernante"], "Governor": ["Gobernador", "Gobernadora"],
    "Persian": ["Persa", "Persa"], "Syrian": ["Sirio", "Siria"], "Midianite": ["Madianita", "Madianita"],
    "Egyptian": ["Egipcio", "Egipcia"], "Prince": ["Príncipe", "Princesa"], "Canaanite": ["Cananeo", "Cananea"],
    "Ethnarch": ["Etnarca", "Etnarca"], "Ishmaelite": ["Ismaelita", "Ismaelita"],
}
# Tribus y pueblos, con la ortografía de la RV1909
TRIBES = {
    "Judah": "Judá", "Levi": "Leví", "Benjamin": "Benjamín", "Asher": "Aser", "Simeon": "Simeón",
    "Manasseh": "Manasés", "Gad": "Gad", "Reuben": "Rubén", "Ephraim": "Ephraim", "Issachar": "Issachâr",
    "Naphtali": "Nephtalí", "Zebulun": "Zabulón", "Dan": "Dan",
}
NATIONS = {
    "Edom": "Edom", "Israel": "Israel", "Canaan": "Canaán", "Egypt": "Egipto", "Sinai": "Sinaí", "Arabia": "Arabia",
    "Ammon": "Ammón", "Syria": "Siria", "Moab": "Moab", "Mesopotamia": "Mesopotamia", "Persia": "Persia",
    "Assyria": "Asiria", "Italy": "Italia", "Philistia": "Filistea", "Judea": "Judea", "Asia": "Asia",
    "Cyprus": "Chipre", "Greece": "Grecia", "Babylon": "Babilonia", "Media": "Media", "Rome": "Roma",
}
# Nombres que el parecido elige mal (el plural del pueblo en vez del país)
NAME_FIXES = {"h0758i": "Siria"}
# Descripción breve propia
BRIEF_FIXES = {"g2424g": "El Cristo, nacido de María"}
# Versículos clave elegidos a mano cuando el artículo no cita ninguno
KEY_FIXES = {"g2424g": ["isa.7.14", "mat.1.21", "jhn.1.14", "jhn.3.16", "1co.15.3-1co.15.4", "act.1.11"]}

# Decisiones de TIPNR que la app no muestra: la tribu de María (TIPNR la pone en Leví por Elisabet, Lucas 1:36)
HIDE_TRIBE = {"G3137G"}

PLACE_TYPES = {
    "settlement": "Ciudad o pueblo", "region": "Región", "mountain": "Monte", "mountain range": "Cordillera",
    "mountain ridge": "Sierra", "hill": "Colina", "river": "Río", "valley": "Valle", "campsite": "Campamento del éxodo",
    "island": "Isla", "spring": "Fuente", "body of water": "Mar o lago", "natural area": "Paraje", "wadi": "Arroyo",
    "tree": "Árbol", "pool": "Estanque", "road": "Camino", "well": "Pozo", "field": "Campo", "garden": "Huerto",
    "ford": "Vado", "cliff": "Peña", "rock": "Peña", "stone heap": "Majano", "fortification": "Fortaleza",
    "mine": "Mina", "promontory": "Promontorio", "canal": "Canal", "mountain pass": "Paso de montaña",
    "forest": "Bosque", "people group": "Pueblo", "gate": "Puerta", "structure": "Edificio", "altar": "Altar",
    "district in settlement": "Barrio", "room": "Sala", "hall": "Sala", "special": "Lugar",
}

COMMON = genealogias.COMMON | {"Rey", "Señor", "Ciudad", "Monte", "Tierra", "Hijo", "Hijos", "Mar", "Santo"}


def fetch_tipnr():
    path = CACHE / TIPNR_FILE
    if not path.exists():
        CACHE.mkdir(exist_ok=True)
        print("Descargando TIPNR…")
        urllib.request.urlretrieve(TIPNR_URL, path)
    return path


def parse_refs(s):
    """'Exo.4.14; Exo.7.10a; LXX Gen.1.1' -> [('exo', 4, 14), ('exo', 7, 10)] (sin las del LXX)."""
    out = []
    for part in s.split(";"):
        m = re.fullmatch(r"\s*(\w+)\.(\d+)\.(\d+)[a-z]?\s*", part)
        if m and m.group(1) in STEP_TO_ID:
            out.append((STEP_TO_ID[m.group(1)], int(m.group(2)), int(m.group(3))))
    return out


def unique_key(s):
    """'Jesse@Rut.4.17-Rom(?)' -> 'Jesse@Rut.4.17-Rom'; 'Abram|Abraham@Gen.11.26-1Pe' -> 'Abraham@Gen.11.26-1Pe'."""
    s = re.sub(r"\((\?|a|d|f)\)", "", s.strip()).strip()
    return s.split("|")[-1]


def parse_tipnr(path):
    raw = path.read_text(encoding="utf-8-sig").replace("\r", "")
    records = []
    for chunk in re.split(r"^\$=+ ?", raw, flags=re.M)[1:]:
        lines = chunk.split("\n")
        kind = lines[0].strip()
        if kind not in ("PERSON(s)", "PLACE", "PLACE+PERSON") or "uStrong\t" in chunk[:400]:
            continue
        head = lines[1].split("\t")
        m = re.match(r"(.+)=(\w+)$", head[0].strip())
        if not m or m.group(2) in ("H0000", "G0000"):
            continue
        rec = {"kind": "place" if kind.startswith("PLACE") else "person", "key": m.group(1), "ustrong": m.group(2),
               "head": head, "forms": [], "text": {}}
        for line in lines[2:]:
            if line.startswith("– ") and not line.startswith("– Total"):
                c = line.split("\t")
                if len(c) > 4:
                    english = [e.strip() for n in c[3].split(";") for e in n.split("=")[0].split(",") if e.strip()]
                    rec["forms"].append({"sig": c[0][2:].strip(), "name": c[1].strip(), "orig": c[2].split("=", 1)[-1].strip(),
                                         "english": english, "refs": parse_refs(c[4])})
            m2 = re.match(r"@(Briefest|Brief|Short|Article)=\s*(.*)", line)
            if m2:
                rec["text"][m2.group(1)] = m2.group(2).split("\t")[0].strip()
        records.append(rec)
    return records


def norm_ref(s):
    """Una referencia de los artículos de TIPNR como la usa la app: 'Num.21.25-30' -> 'num.21.25-num.21.30'."""
    s = s.split(";")[0].split(",")[0].strip()
    m = re.fullmatch(r"(\d?\s*[A-Za-z]+)[\s.]+(\d+)[.:](\d+)(?:-(\d+)(?:[.:](\d+))?)?", s)
    if not m:
        return None
    book = BOOK_NAMES.get(re.sub(r"[\s.]", "", m.group(1).lower()))
    if not book:
        return None
    ch, v = int(m.group(2)), int(m.group(3))
    if m.group(4):
        ch2, v2 = (int(m.group(4)), int(m.group(5))) if m.group(5) else (ch, int(m.group(4)))
        if (ch2, v2) > (ch, v):
            return f"{book}.{ch}.{v}-{book}.{ch2}.{v2}"
    return f"{book}.{ch}.{v}"


PLAIN_REF = re.compile(r"\b((?:[123] ?)?[A-Z][a-z]+(?: of [A-Z][a-z]+)? \d+:\d+(?:-\d+)?|[123]?[A-Z][a-z]{1,2}\.\d+\.\d+(?:-\d+)?)")


def article(rec):
    """El artículo en inglés con las referencias como ⟦jhn.3.16⟧ y los párrafos separados por líneas en blanco."""
    t = rec["text"]
    src = t.get("Article") or t.get("Short") or t.get("Brief") or ""
    refs = []

    def mark(target, label):
        r = norm_ref(target) or norm_ref(label)
        if not r:
            return label
        refs.append(r)
        return f"⟦{r}⟧"

    src = re.sub(r'<ref="([^"]*)">(.*?)</ref>', lambda m: mark(m.group(1), m.group(2)), src)
    # Muchas citas van sin marca: «(Genesis 35:19; 48:7)», «1 Samuel 17:4-7»
    src = PLAIN_REF.sub(lambda m: mark(m.group(1), m.group(1)), src)
    src = re.sub(r"\(\s*(⟦[^⟧]+⟧)\s*\)", r"(\1)", src)
    src = re.sub(r"<br\s*/?>", "\n\n", src, flags=re.I)
    src = re.sub(r"<[^>]+>", "", src)
    paragraphs = [re.sub(r"\s+", " ", p).strip() for p in src.split("\n\n")]
    return "\n\n".join(p for p in paragraphs if p), refs


def match_spanish(english, refs, text, place=False, low=False):
    """El nombre propio de la RV1909 que más se parece a los nombres ingleses en los versículos dados."""
    targets = set()
    for e in english:
        e = re.sub(r"\s*\(.*\)", "", e).strip()
        if not e:
            continue
        targets.add(phonetic(re.sub(r"[ij]?ah$", "ías", e) if not place and re.search(r"[eiuj]ah$", e) else e))
    targets.discard("")
    if not targets:
        return None
    # El umbral bajo solo para el nombre principal de una persona: nombres raros que la RV1909 escribe muy distinto.
    # Las demás formas (Abram, Efrata) tienen que parecerse más, porque sus pocos versículos nombran a otros.
    for threshold in (0.7,) if place else (0.66, 0.5) if low else (0.75,):
        score = defaultdict(float)
        for ref in refs[:40]:
            best = {}
            for word in PROPER.findall(text.get(ref, "")):
                if word in COMMON:
                    continue
                p = phonetic(word)
                r = max(difflib.SequenceMatcher(None, p, t).ratio() for t in targets)
                if r >= threshold and (low and threshold > 0.6 or any(p[:1] == t[:1] for t in targets)):
                    best[word] = max(best.get(word, 0), r)
            for word, r in best.items():
                score[word] += r
        if score:
            return max(score, key=score.get)
    return None


def era_of(desc):
    for en, es in ERAS:
        if en in desc:
            return es
    return None


def role_of(desc, female):
    m = re.match(r"(.*?) (?:living|or town)", desc)
    role = ROLES.get(m.group(1) if m else desc)
    return role[1 if female else 0] if role else None


def tribe_of(field, ustrong):
    field = field.strip().replace("(?)", "")
    if ustrong in HIDE_TRIBE or not field or field == ">":
        return None
    m = re.match(r"Tribe of (\w+)", field)
    if m and m.group(1) in TRIBES:
        return f"Tribu de {TRIBES[m.group(1)]}"
    return f"Pueblo de {NATIONS[field]}" if field in NATIONS else None


def family_keys(field):
    """'Amram@Exo.6.18-1Ch + Jochebed@Exo.6.20-Num' -> ['Amram@Exo.6.18-1Ch', 'Jochebed@Exo.6.20-Num']"""
    return [unique_key(k) for k in re.split(r"\s*[,+]\s*", field) if "@" in k and not k.strip().startswith(">")]


def theographic_people():
    """Personas de Theographic (las de las genealogías) con sus versículos."""
    people = json.loads(genealogias.fetch("theo-people.json").read_text(encoding="utf-8"))
    chapters = json.loads(genealogias.fetch("theo-chapters.json").read_text(encoding="utf-8"))
    verse_ref = {}
    for ch in chapters:
        book, num = ch["fields"]["osisRef"].split(".")
        for i, vid in enumerate(ch["fields"]["verses"], 1):
            verse_ref[vid] = (XREF_TO_ID[book], int(num), i)
    out = {}
    for p in people:
        f = p["fields"]
        out[int(f["personID"])] = (f["name"], {verse_ref[v] for v in f.get("verses", []) if v in verse_ref})
    return out


def link_theographic(rec, refs, theo, by_verse, names):
    """La persona de las genealogías que es la misma: mismo nombre y la mayoría de los versículos en común."""
    english = {phonetic(n) for f in rec["forms"] for n in f["english"] + [f["name"].split("@")[0].split("|")[0]]}
    counts = Counter(pid for r in refs for pid in by_verse.get(r, ()) if pid in names)
    best = None
    for pid, n in counts.most_common(6):
        name, verses = theo[pid]
        overlap = n / max(1, min(len(verses), len(refs)))
        if overlap >= 0.5 and phonetic(name) in english and (not best or overlap > best[1]):
            best = (pid, overlap)
    return best[0] if best else None


def slug_id(ustrong):
    return ustrong.lower()


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "public" / "data"
    text = genealogias.load_text()
    records = parse_tipnr(fetch_tipnr())
    by_key = {r["key"]: r for r in records}

    # Genealogías ya generadas por genealogias.py (nombres en español de Theographic)
    gen_people = json.loads((out / "genealogia" / "personas.json").read_text(encoding="utf-8"))
    theo = theographic_people()
    theo_by_verse = defaultdict(set)
    for pid, (_, verses) in theo.items():
        if str(pid) in gen_people:
            for r in verses:
                theo_by_verse[r].add(pid)

    # Lugares de OpenBible por su nombre
    ancient = {}
    with fetch_data("ancient.jsonl").open(encoding="utf-8") as f:
        for line in f:
            p = json.loads(line)
            ancient[p["friendly_id"]] = p
    images = place_photos()

    # Primera pasada: versículos, nombre en español y formas de cada ficha
    fichas = {}
    for rec in records:
        english_main = rec["key"].split("@")[0]
        if "_" in english_main or english_main.startswith("Unnamed"):
            continue  # personas sin nombre que TIPNR añade para unir familias («husband_of_Zeruiah»)
        forms = rec["forms"]
        if rec["kind"] == "person" and english_main in genealogias.EPONYMS:
            forms = [f for f in forms if not f["sig"].startswith(("Group", "Form"))]
            total = sum(len(f["refs"]) for f in forms)
            # «Israel», «Judá», «Moab»: TIPNR une al patriarca con el pueblo. Fuera de los relatos y listas de
            # familia, el nombre es el del pueblo (las mismas reglas que las genealogías).
            for f in forms:
                if english_main in f["english"]:
                    f["refs"] = [r for r in f["refs"] if genealogias.counts_in_chapter(english_main, total, r[0], r[1])]
        # Primero la forma principal del nombre (Named, sin «Otro|»), después el griego y las demás
        forms.sort(key=lambda f: (f["sig"] != "Named" or "|" in f["name"], f["sig"] != "Greek"))
        refs = sorted({r for f in forms for r in f["refs"]}, key=lambda r: (ORDER[r[0]], r[1], r[2]))
        if not refs:
            continue
        head = rec["head"]
        fic = {"id": slug_id(rec["ustrong"]), "rec": rec, "refs": refs, "forms": set()}
        place = rec["kind"] == "place"
        if not place:
            gender = head[8].strip() if len(head) > 8 else ""
            fic["tipo"] = {"Male": "m", "Female": "f", "Group": "g"}.get(gender, "m")
            theo_id = link_theographic(rec, refs, theo, theo_by_verse, {int(k) for k in gen_people})
            fic["gen"] = theo_id
            name = gen_people[str(theo_id)][0] if theo_id else genealogias.NAMES.get(english_main)
        else:
            fic["tipo"] = "l"
            ob, _, near = head[1].partition("=")
            ob = ob.strip().replace("_", " ")
            fic["ob"] = ancient.get(ob) or ancient.get(f"{ob} 1")
            if not fic["ob"]:
                # «Field of Blood= near Jerusalem (Jerusalem@Gen.14.18-Rev=H3389)»: se ubica cerca de otro lugar
                m = re.search(r"near .*?\(([^=)]+)=", near)
                fic["cerca"] = m and unique_key(m.group(1))
            name = PLACE_NAMES.get(ob)
        for i, form in enumerate(forms):
            main = i == 0 and form["sig"] == "Named"
            es = match_spanish(form["english"], form["refs"], text, place=place, low=main and not place)
            if es:
                fic["forms"].add(es)
                name = name or es
        fic["nombre"] = NAME_FIXES.get(fic["id"]) or name or re.sub(r" \d+$", "", english_main)
        fic["forms"].add(fic["nombre"].split(" (")[0])
        fichas[rec["key"]] = fic

    # Lugares sin coordenadas propias que TIPNR ubica cerca de otro
    for fic in fichas.values():
        if fic.get("cerca") in fichas and fichas[fic["cerca"]].get("ob"):
            fic["ob"], fic["aprox"] = fichas[fic["cerca"]]["ob"], fichas[fic["cerca"]]["nombre"]

    by_verse = defaultdict(list)
    for key, fic in fichas.items():
        for r in fic["refs"]:
            by_verse[r].append(key)

    def short(key):
        f = fichas.get(key)
        return f and {"id": f["id"], "nombre": f["nombre"], "tipo": f["tipo"]}

    def relation(fic):
        """«hijo de Isaí», «esposa de Booz»: para distinguir a personas con el mismo nombre."""
        h = fic["rec"]["head"]
        female = fic["tipo"] == "f"
        for field, (m, w) in ((2, ("hijo", "hija")), (4, ("esposo", "esposa")), (5, ("padre", "madre")),
                              (3, ("hermano", "hermana"))):
            for k in family_keys(h[field]) if len(h) > field else []:
                if k in fichas:
                    return f"{w if female else m} de {fichas[k]['nombre']}"
        return None

    # Segunda pasada: la ficha completa
    index, chapters, gen_map, ob_map = [], defaultdict(list), {}, {}
    for key, fic in fichas.items():
        rec, head = fic["rec"], fic["rec"]["head"]
        en, art_refs = article(rec)
        refs = fic["refs"]
        first = next((r for r in refs if any(f in text.get(r, "") for f in fic["forms"])), refs[0])
        # La primera mención y las citas del artículo, primero una de cada libro para que se vea toda la historia
        candidates = KEY_FIXES.get(fic["id"]) or list(dict.fromkeys(["{}.{}.{}".format(*first)] + art_refs))
        key_refs, books_seen = [], set()
        for pass_ in (0, 1):
            for r in candidates:
                start, book = r.split("-")[0], r[:3]
                if len(key_refs) < MAX_KEY_VERSES and r not in key_refs and (pass_ or book not in books_seen):
                    if start not in {k.split("-")[0] for k in key_refs}:
                        key_refs.append(r)
                        books_seen.add(book)
        key_refs.sort(key=lambda r: (ORDER[r[:3]], [int(x) for x in r.split("-")[0].split(".")[1:]]))
        claves = []
        for r in key_refs:
            b, c, v = r.split("-")[0].split(".")
            t = text.get((b, int(c), int(v)))
            if t:
                claves.append([r, t])
        citas = defaultdict(lambda: defaultdict(list))
        for b, c, v in refs:
            citas[b][c].append(v)
        ficha = {
            "id": fic["id"], "nombre": fic["nombre"], "tipo": fic["tipo"],
            "otros": sorted(f for f in fic["forms"] if f != fic["nombre"].split(" (")[0]),
            "original": original_forms(rec),
            "citas": [[b, [[c, vs] for c, vs in chs.items()]] for b, chs in citas.items()],
            "menciones": len(refs), "claves": claves,
            "en": en,
        }
        # Quiénes o qué aparecen en los mismos versículos
        near = Counter(k for r in refs for k in by_verse[r] if k != key)
        # Nombres en español de la persona y de quienes la rodean, para que la traducción del artículo los use
        related = [key] + [k for i in (2, 3, 4, 5) for k in family_keys(head[i] if len(head) > i else "")]
        related += [k for k, _ in near.most_common(30)]
        # (sin «Israel»: en el artículo casi siempre es el pueblo y no Jacob)
        ficha["glosario"] = {
            fichas[k]["rec"]["key"].split("@")[0]: fichas[k]["nombre"].split(" (")[0]
            for k in related if k in fichas and not k.startswith("Israel@")
        }
        if fic["tipo"] != "l":
            desc = head[1]
            female = fic["tipo"] == "f"
            ficha["epoca"] = era_of(desc)
            ficha["rol"] = role_of(desc, female)
            ficha["tribu"] = tribe_of(head[6] if len(head) > 6 else "", rec["ustrong"])
            fam = {}
            for name, field in (("padres", 2), ("hermanos", 3), ("conyuges", 4), ("hijos", 5)):
                fam[name] = [s for s in (short(k) for k in family_keys(head[field] if len(head) > field else "")) if s]
            ficha["familia"] = fam
            if fic.get("gen"):
                ficha["genealogia"] = fic["gen"]
                gen_map[fic["gen"]] = fic["id"]
            family = {s["id"] for v in fam.values() for s in v}
            lugares = []
            for k, n in near.most_common():
                f = fichas[k]
                if f["tipo"] == "l" and f.get("ob") and coords(f["ob"]):
                    lugares.append({"id": f["id"], "nombre": f["nombre"], "n": n, **coords(f["ob"])[0]})
                    if len(lugares) >= MAX_PLACES:
                        break
            ficha["lugares"] = lugares
            ficha["junto"] = [
                {**short(k), "n": n} for k, n in near.most_common(40)
                if fichas[k]["tipo"] != "l" and fichas[k]["id"] not in family
            ][:8]
            rel = relation(fic)
            parts = [p for p in (ficha["rol"], rel) if p]
            if not rel and ficha["epoca"]:
                parts.append(ERA_WHEN[ficha["epoca"]])
            breve = ", ".join(parts)
            breve = breve[:1].upper() + breve[1:]
        else:
            place = fic.get("ob")
            options = coords(place) if place else []
            aprox = fic.get("aprox")
            types = [t for t in (place or {}).get("types", []) if t in PLACE_TYPES and not aprox]
            ficha["clase"] = PLACE_TYPES[types[0]] if types else "Lugar"
            if options:
                ficha["mapa"] = {**options[0], "alt": [] if aprox else options[1:]}
                if aprox:
                    ficha["mapa"]["cercaDe"] = aprox
            if place and not aprox:
                ob_map[place["id"]] = fic["id"]
                photo = photo_for(place, images)
                if photo:
                    ficha["foto"] = photo
            ficha["fundador"] = [s for s in (short(k) for k in family_keys(head[2] if len(head) > 2 else "")) if s]
            ficha["habitantes"] = [s for s in (short(k) for k in family_keys(head[3] if len(head) > 3 else "")) if s][:12]
            ficha["personas"] = [{**short(k), "n": n} for k, n in near.most_common(60) if fichas[k]["tipo"] != "l"][:MAX_PEOPLE]
            ficha["cerca"] = [
                {"id": fichas[k]["id"], "nombre": fichas[k]["nombre"], "n": n, **coords(fichas[k]["ob"])[0]}
                for k, n in near.most_common(60)
                if fichas[k]["tipo"] == "l" and fichas[k].get("ob") and coords(fichas[k]["ob"])
            ][:MAX_PLACES]
            area = tribe_of(head[6] if len(head) > 6 else "", rec["ustrong"])
            breve = ficha["clase"] + (f" en {area.split(' de ', 1)[1]}" if area else f" cerca de {aprox}" if aprox else "")
            if not options:
                ficha["sinMapa"] = True
        ficha["breve"] = breve = BRIEF_FIXES.get(fic["id"], breve)
        write(out, f"fichas/f/{fic['id']}.json", ficha)
        index.append([fic["id"], fic["nombre"], fic["tipo"], breve, len(refs), ficha["otros"]])
        for (b, c), vs in group_chapters(refs).items():
            forms = sorted(f for f in fic["forms"] if any(f in text.get((b, c, v), "") for v in vs))
            chapters[(b, c)].append([fic["id"], fic["nombre"], fic["tipo"], vs, forms])

    index.sort(key=lambda r: (-r[4], r[1]))
    write(out, "fichas/indice.json", index)
    for (b, c), rows in chapters.items():
        rows.sort(key=lambda r: (r[3][0], -len(r[3])))
        write(out, f"fichas/cap/{b}/{c}.json", rows)
    write(out, "fichas/genealogia.json", {str(k): v for k, v in gen_map.items()})
    write(out, "fichas/openbible.json", ob_map)
    people = sum(1 for r in index if r[2] != "l")
    print(f"Fichas: {people} personas y {len(index) - people} lugares ({len(gen_map)} con árbol familiar, "
          f"{len(ob_map)} en el mapa)")


def original_forms(rec):
    """El nombre en hebreo o griego, sin repetir: [[forma, nombre inglés]]."""
    out, seen = [], set()
    for f in rec["forms"]:
        if f["orig"] and f["orig"] not in seen and not f["sig"].startswith(("(same", "Form")):
            seen.add(f["orig"])
            out.append([f["orig"], f["english"][0] if f["english"] else ""])
    return out[:4]


def group_chapters(refs):
    out = defaultdict(list)
    for b, c, v in refs:
        if v not in out[(b, c)]:
            out[(b, c)].append(v)
    return out


def coords(place):
    """Ubicación más probable y alternativas de un lugar de OpenBible (las mismas reglas que build_places)."""
    if place["id"] in _coords:
        return _coords[place["id"]]
    options = []
    for ident in place.get("identifications", []):
        score = ident["score"]["time_total"]
        res = next((r for r in ident.get("resolutions", []) if r.get("lonlat")), None)
        if res and score >= 150 and len(options) < 3:
            lon, lat = map(float, res["lonlat"].split(","))
            options.append({"lon": round(lon, 4), "lat": round(lat, 4), "conf": score})
    _coords[place["id"]] = options
    return options


_coords = {}

if __name__ == "__main__":
    main()
