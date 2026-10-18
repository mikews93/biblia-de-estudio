"""Descarga las fuentes libres y genera los archivos JSON que lee la app.

Uso: python3 pipeline/build_data.py [carpeta_salida]   (por defecto: public/data)

Fuentes (se descargan, no se guardan en el repositorio):
- Reina-Valera 1909 (dominio público), vía scrollmapper/bible_databases
- Referencias cruzadas de OpenBible.info (CC BY), vía scrollmapper/bible_databases
- TAGNT de STEPBible / Tyndale House (CC BY 4.0): griego del NT con morfología y glosas
- Español Sencillo y Palabra de Dios para ti, ya descargadas en pipeline/versions/ (ver fetch_versions.py)
- Lugares bíblicos de OpenBible.info Bible Geocoding Data (CC BY 4.0), con el mapa de fondo de pipeline/geo/basemap.json
- Medidas antiguas (pipeline/medidas.py) e imágenes libres de Wikimedia Commons (pipeline/imagenes.py)
"""

import difflib
import gzip
import json
import re
import shutil
import unicodedata
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
    "ancient.jsonl": "https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/"
                     "7eb18a5ee62f27b9b93bd6689ea272d76dd23b8f/data/ancient.jsonl",
    "image.jsonl": "https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/"
                   "7eb18a5ee62f27b9b93bd6689ea272d76dd23b8f/data/image.jsonl",
}
MAX_XREFS = 12
MAX_PLACE_PHOTOS = 8

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
    chapters, words = {}, {}
    text = {}
    for meta, book in zip(BOOKS, src["books"]):
        bid = meta[0]
        chapters[bid] = len(book["chapters"])
        words[bid] = []
        for ch in book["chapters"]:
            verses = [[v["verse"], v["text"].strip()] for v in ch["verses"]]
            write(out, f"text/rv1909/{bid}/{ch['chapter']}.json", verses)
            words[bid].append(sum(len(t.split()) for _, t in verses))
            for n, t in verses:
                text[(bid, ch["chapter"], n)] = t
    # Palabras por capítulo: los planes de lectura calculan con esto cuántos minutos lleva cada día
    write(out, "words.json", words)
    return chapters, text


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
    concordance = defaultdict(list)
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
                gloss = fix_gloss(cols[8].strip(), strong.strip())
                concordance[strong.strip()].append([f"{STEP_TO_ID[book]}.{ch}.{v}", greek.strip(), gloss])
                by_chapter[(STEP_TO_ID[book], ch)][v].append([
                    greek.strip(),
                    translit.rstrip(")").strip(),
                    gloss,
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
    # Concordancia por número de Strong: [referencia, forma griega, glosa]. La usa «¿Por qué esta palabra?».
    for strong, uses in concordance.items():
        if re.fullmatch(r"G\d+[A-Za-z]?", strong):
            write(out, f"concordance/{strong}.json", uses)


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


# Lugares que no se dibujan en el mapa: partes del templo, puertas de Jerusalén, salas…
SKIP_TYPES = {"special", "gate", "structure", "room", "hall", "altar", "district in settlement", "people group"}
# Puntos cardinales y descripciones que OpenBible cataloga como regiones
SKIP_PLACES = {"East", "North", "South 1", "South 2", "South 3", "West", "Angle", "Second Quarter"}
# Nombres en español para lugares que la RV1909 nombra con una descripción y no con un nombre propio
PLACE_NAMES = {
    "Great Sea": "Mar Grande (Mediterráneo)", "Salt Sea": "Mar Salado (mar Muerto)", "Red Sea 1": "Mar Bermejo (mar Rojo)",
    "Red Sea 2": "Mar Bermejo", "Red Sea 3": "Mar Bermejo", "Sea of Galilee": "Mar de Galilea",
    "Mount of Olives": "Monte de las Olivas", "Lebanon": "Líbano", "Negeb": "Neguev (el Mediodía)",
    "Shephelah": "La Sefela", "Wilderness of Sinai": "Desierto de Sinaí", "Valley of Hinnom": "Valle de Hinnom",
    "Valley of Rephaim": "Valle de Rephaim", "Valley of Achor": "Valle de Achôr", "Valley of Jezreel": "Valle de Jezreel",
    "Valley of Salt": "Valle de la Sal", "Valley of Elah": "Valle de Ela", "Beyond the River": "Al otro lado del río",
    "Ramoth-gilead": "Ramoth de Galaad", "Jordan": "Jordán", "Jordan Valley": "Llanura del Jordán",
    "Mount Sinai": "Monte Sinaí", "Mount Zion": "Monte de Sión", "Mount Carmel": "Monte Carmelo",
    "Mount Hermon": "Monte Hermón", "Euphrates": "Éufrates", "Tigris": "Tigris", "Nile": "Nilo",
    "Babylon 1": "Babilonia", "Babylonia": "Babilonia", "Bethlehem 1": "Belén (Beth-lehem)",
    "Carchemish": "Carchêmis", "Upper Pool": "Estanque de arriba", "City of David": "Ciudad de David",
    "Chaldea": "Caldea", "Philistia": "Filistea", "Arabah": "El Arabá (la llanura)", "Alexandria": "Alejandría",
}


def phonetic(s):
    """Forma aproximada de un nombre para comparar el inglés de OpenBible con la RV1909 (Ephesus ≈ Efeso)."""
    s = "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")
    for a, b in [("ph", "f"), ("th", "t"), ("ch", "c"), ("sh", "s"), ("qu", "c"), ("k", "c"), ("z", "s"),
                 ("y", "i"), ("j", "i"), ("h", "")]:
        s = s.replace(a, b)
    s = re.sub(r"(.)\1", r"\1", s)
    return re.sub(r"(us|um|ians|ian|ites|ite|ia|a|o|e)$", "", s)


PROPER = re.compile(r"[A-ZÁÉÍÓÚÑ][a-záéíóúñüâêîôû]+(?:-[a-záéíóúñüâêîôûA-ZÁÉÍÓÚÑ]+)*")


def spanish_name(place, refs, text):
    """El nombre propio de la RV1909 que más se parece al inglés en los versículos donde aparece el lugar."""
    if place["friendly_id"] in PLACE_NAMES:
        return PLACE_NAMES[place["friendly_id"]]
    english = [phonetic(n) for n in (place.get("translation_name_counts") or {place["friendly_id"]: 1})]
    score = defaultdict(float)
    for ref in refs[:40]:
        best = {}
        for word in PROPER.findall(text.get(ref, "")):
            r = max(difflib.SequenceMatcher(None, phonetic(word), e).ratio() for e in english)
            if r >= 0.7:
                best[word] = max(best.get(word, 0), r)
        for word, r in best.items():
            score[word] += r
    if score:
        return max(score, key=score.get)
    return re.sub(r" \d+$", "", place["friendly_id"])  # sin equivalente claro: el nombre de OpenBible


# Licencias libres de las fotos de Wikimedia Commons que cataloga OpenBible ("copyright" y "sentinel" no lo son)
FREE_PHOTO = re.compile(r"^(PD|CC-Zero|CC-PD|CC-BY)")


def place_photos():
    """Foto libre de cada lugar antiguo, la que OpenBible elige como miniatura: {id del lugar: foto}."""
    images = {}
    with fetch("image.jsonl").open(encoding="utf-8") as f:
        for line in f:
            img = json.loads(line)
            if FREE_PHOTO.match(img.get("license", "")) and img.get("thumbnail_url_pattern"):
                images[img["id"]] = img
    return images


def photo_for(place, images):
    thumb = (place.get("media") or {}).get("thumbnail") or {}
    img = images.get(thumb.get("image_id"))
    if not img:
        return None
    w, h = img["width"], img["height"]
    width = min(800, w)
    return {
        "img": img["thumbnail_url_pattern"].replace("####", str(width)) if w > 800 else img["file_url"],
        "w": width, "h": round(h * width / w), "page": img["url"],
        "author": re.sub(r"<[^>]+>", "", img.get("credit") or img.get("author") or "")[:120] or None,
        "license": img["license"].replace("CC-Zero", "CC0").replace("-", " ").replace("CC BY SA", "CC BY-SA"),
    }


def build_places(out, text):
    """Lugares de cada capítulo con su ubicación más probable y las alternativas que proponen los especialistas.

    Devuelve también, por capítulo, los lugares que tienen foto libre, para el estudio del capítulo."""
    by_chapter = defaultdict(dict)
    images = place_photos()
    photos = {}
    with fetch("ancient.jsonl").open(encoding="utf-8") as f:
        for line in f:
            place = json.loads(line)
            if set(place["types"]) & SKIP_TYPES or place["friendly_id"] in SKIP_PLACES:
                continue
            refs = []
            for v in place.get("verses", []):
                book, ch, n = v["osis"].split(".")
                refs.append((XREF_TO_ID[book], int(ch), int(n)))
            # Identificaciones ordenadas por la confianza actual de los especialistas (0-1000)
            options = []
            for ident in place["identifications"]:
                score = ident["score"]["time_total"]
                res = next((r for r in ident.get("resolutions", []) if r.get("lonlat")), None)
                if res and score >= 150 and len(options) < 3:
                    lon, lat = map(float, res["lonlat"].split(","))
                    options.append({"lon": round(lon, 4), "lat": round(lat, 4), "conf": score})
            if not refs or not options:
                continue
            name = spanish_name(place, refs, text)
            photo = photo_for(place, images)
            if photo:
                photos[place["id"]] = photo
            for bid, ch, n in refs:
                entry = by_chapter[(bid, ch)].setdefault(place["id"], {
                    "id": place["id"], "name": name, "en": place["friendly_id"], "type": place["types"][0],
                    **options[0], "alt": options[1:], "verses": [],
                })
                if n not in entry["verses"]:
                    entry["verses"].append(n)
    for (bid, ch), places in by_chapter.items():
        write(out, f"places/{bid}/{ch}.json", sorted(places.values(), key=lambda p: (min(p["verses"]), p["name"])))
    shutil.copy(ROOT / "geo" / "basemap.json", out / "basemap.json")
    with_photo = {}
    for key, places in by_chapter.items():
        found = sorted((p for p in places.values() if p["id"] in photos), key=lambda p: (min(p["verses"]), p["name"]))
        with_photo[key] = [{
            "id": p["id"], "kind": "lugar", "title": p["name"], "verses": p["verses"],
            "caption": f"Foto actual de la zona donde se ubica {p['name']}, según la identificación más probable "
                       "de OpenBible.info.",
            **photos[p["id"]],
        } for p in found[:MAX_PLACE_PHOTOS]]
    return with_photo


def build_context(out, place_pictures):
    """Para el estudio de cada capítulo: medidas antiguas con su equivalencia y objetos, lugares o mapas con imagen."""
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
            # Primero objetos, luego lugares y al final los mapas
            maps = [p for p in pictures if p["kind"] == "mapa"]
            pictures = [p for p in pictures if p["kind"] != "mapa"] + place_pictures.get((bid, ch["chapter"]), []) + maps
            if measures or pictures:
                write(out, f"contexto/{bid}/{ch['chapter']}.json", {"medidas": measures, "imagenes": pictures})
                count += 1
    print(f"Capítulos con medidas o imágenes: {count}")


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "public" / "data"
    chapters, text = build_text(out)
    build_xrefs(out)
    build_interlinear(out)
    build_versions(out)
    place_pictures = build_places(out, text)
    build_context(out, place_pictures)
    books = [
        {"id": b[0], "name": b[1], "abbr": b[2], "chapters": chapters[b[0]],
         "testament": "NT" if b[4] else "AT", "interlinear": bool(b[4]), "ewSlug": b[5]}
        for b in BOOKS
    ]
    write(out, "books.json", books)
    print(f"Listo: {out}")


if __name__ == "__main__":
    main()
