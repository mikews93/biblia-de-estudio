"""Genealogías: personas de la Biblia con sus padres, cónyuges, hermanos e hijos, y en qué capítulos aparecen.

Fuente: Theographic Bible Metadata (Robert Rouse, CC BY-SA 4.0), commit fijado. Solo se usan las relaciones
familiares y los versículos de cada persona; no se usan sus fechas (siguen la cronología de Ussher/Jones) ni el
diccionario de Easton. Los nombres en español salen de la RV1909: el nombre propio de los versículos de la persona
que más se parece al inglés, con una tabla para los que cambian mucho (Jesse → Isaí).

Salida:
- genealogia/personas.json: {id: [nombre, sexo, padres, madres, cónyuges, hijos, hermanos, primera cita, menciones]}
- genealogia/<libro>/<cap>.json: [[id, [versículos]]] de las personas con familia conocida que nombra el capítulo
"""

import difflib
import json
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

from books import BOOKS
from build_data import CACHE, PROPER, ROOT, XREF_TO_ID, phonetic, write

THEO = "https://raw.githubusercontent.com/robertrouse/theographic-bible-metadata/52e049efb3b95e4f1da52d11a3303fbd2d648922/json/"
SOURCES = {"theo-people.json": THEO + "people.json", "theo-chapters.json": THEO + "chapters.json"}

# Nombres que la RV1909 escribe de forma muy distinta al inglés (o que el parecido no encuentra bien)
NAMES = {
    "Jesse": "Isaí", "Solomon": "Salomón", "Rehoboam": "Roboam", "Hezekiah": "Ezechîas", "Josiah": "Josías",
    "Uzziah": "Uzzías", "Azariah": "Azarías", "Jehoshaphat": "Josaphat", "Joash": "Joas", "Jehoash": "Joas",
    "Amaziah": "Amasías", "Ahaziah": "Ochôzías", "Jehoram": "Joram", "Zedekiah": "Sedecías", "Jeconiah": "Jechônías",
    "Jehoiachin": "Joachîn", "Jehoiakim": "Joacim", "Manasseh": "Manasés", "Ephraim": "Ephraim", "Noah": "Noé",
    "Eve": "Eva", "Seth": "Seth", "Enoch": "Enoc", "Methuselah": "Mathusalam", "Lamech": "Lamech", "Shem": "Sem",
    "Ham": "Châm", "Japheth": "Japhet", "Abram": "Abram", "Sarai": "Sarai", "Rebekah": "Rebeca", "Leah": "Lea",
    "Judah": "Judá", "Levi": "Leví", "Simeon": "Simeón", "Reuben": "Rubén", "Naphtali": "Nephtalí",
    "Benjamin": "Benjamín", "Zebulun": "Zabulón", "Issachar": "Issachâr", "Asher": "Aser", "Moses": "Moisés",
    "Aaron": "Aarón", "Miriam": "María", "Joshua": "Josué", "Samuel": "Samuel", "Saul": "Saúl",
    "Jonathan": "Jonathán", "Bathsheba": "Bath-sheba", "Absalom": "Absalom", "Elijah": "Elías",
    "Elisha": "Eliseo", "Isaiah": "Isaías", "Jeremiah": "Jeremías", "Ezekiel": "Ezequiel", "Hosea": "Oseas",
    "Zerubbabel": "Zorobabel", "Shealtiel": "Salathiel", "Jesus": "Jesús", "Mary": "María", "Joseph": "José",
    "John": "Juan", "James": "Jacobo", "Peter": "Pedro", "Simon": "Simón", "Andrew": "Andrés",
    "Elizabeth": "Elisabet", "Zechariah": "Zacarías", "Zacharias": "Zacarías", "Herod": "Herodes",
    "Abraham": "Abraham", "Isaac": "Isaac", "Jacob": "Jacob", "Esau": "Esaú", "Ishmael": "Ismael",
    "Hagar": "Agar", "Lot": "Lot", "Terah": "Thare", "Nahor": "Nachôr", "Laban": "Labán", "Rachel": "Rachêl",
    "Dinah": "Dina", "Tamar": "Thamar", "Perez": "Phares", "Boaz": "Booz", "Obed": "Obed", "Ruth": "Ruth",
    "Naomi": "Noemi", "David": "David", "Nathan": "Nathán", "Adam": "Adam", "Cain": "Caín", "Abel": "Abel",
    "Joab": "Joab", "Hannah": "Anna", "Eli": "Elí", "Gideon": "Gedeón", "Samson": "Samsón", "Caleb": "Caleb",
    "Timothy": "Timoteo", "Lois": "Loida", "Eunice": "Eunice", "Martha": "Marta", "Lazarus": "Lázaro",
    "Nebuchadnezzar": "Nabucodonosor", "Mordecai": "Mardochêo", "Zeruiah": "Sarvia", "Achsah": "Axa",
    "Zipporah": "Séphora", "Herod Antipas": "Herodes", "Hivite": "Heveo", "Girgasite": "Gergeseo",
    "Zizah": "Ziza", "Israel": "Jacob (Israel)", "Aiah": "Aja", "Ahijah": "Ahías",
}
# Personas sin nombre propio, que Theographic describe en inglés
DESCRIBED = {
    "Daughter of Lot - Younger": "Hija menor de Lot", "Daughter of Lot - Older": "Hija mayor de Lot",
    "Daughter of Pharaoh": "Hija de Faraón", "the giant in Gath": "Gigante de Gath",
    "man of great stature": "Hombre de grande estatura", "Canaanitish woman": "Mujer cananea",
    "Concubine the Aramitess": "Concubina siria", "Mother of Zebedees children": "Madre de los hijos de Zebedeo",
    "Mother of Aholah and Aholibah": "Madre de Aholah y Aholibah", "Wife of Simon": "Esposa de Simón Pedro",
    "Mother of the Wife of Simon": "Suegra de Simón Pedro", "Daughter of Herodias": "Hija de Herodías",
}
RELATION = {"Daughter of": "Hija de", "Son of": "Hijo de", "Wife of": "Esposa de", "Mother of": "Madre de",
            "Sister of": "Hermana de", "Sons of": "Hijos de", "Father of": "Padre de"}

# Palabras con mayúscula que no son nombres de persona
COMMON = {"Y", "Yo", "El", "La", "Los", "Las", "Jehová", "Dios", "Señor", "Porque", "Entonces", "Mas"}

ORDER = {b[0]: i for i, b in enumerate(BOOKS)}
# Patriarcas cuyo nombre es también el de una tribu o un pueblo («Judá», «Moab»). Theographic los enlaza en cada
# mención del pueblo, así que fuera de los relatos y listas de familia no se cuentan en el capítulo.
EPONYMS = {"Israel", "Judah", "Reuben", "Simeon", "Levi", "Dan", "Naphtali", "Gad", "Asher", "Issachar", "Zebulun",
           "Benjamin", "Ephraim", "Manasseh", "Edom", "Moab", "Canaan", "Midian", "Amalek", "Ammon", "Gilead", "Heth",
           "Ishmael", "Esau", "Jacob", "Aram", "Asshur", "Elam", "Mizraim", "Cush", "Kedar", "Hivite", "Girgasite"}
FAMILY_CHAPTERS = {"gen": None, "exo": range(1, 7), "num": (1, 2, 26), "rut": None, "1ch": range(1, 10),
                   "mat": (1,), "luk": (3,)}

# Nombres que en Génesis suelen ser la tierra («la tierra de Canaán»): solo donde se habla de la persona
LANDS = {"Canaan": {"gen": (9, 10), "1ch": (1,)}, "Gilead": {"num": (26, 27, 32, 36), "1ch": range(2, 8)},
         "Heth": {"gen": (10,), "1ch": (1,)}, "Midian": {"gen": (25,), "1ch": (1,)}}


def counts_in_chapter(english, verses, bid, ch):
    """Si la mención de un epónimo en este capítulo es de la persona (Génesis, genealogías) y no del pueblo."""
    if english in LANDS:
        allowed = LANDS[english].get(bid, ())
    elif english in EPONYMS and verses >= 100:
        allowed = FAMILY_CHAPTERS.get(bid, ())
    else:
        return True
    return allowed is None or ch in allowed
GENDER = {"Male": "m", "Female": "f"}


def fetch(name):
    path = CACHE / name
    if not path.exists():
        CACHE.mkdir(exist_ok=True)
        print(f"Descargando {name}…")
        urllib.request.urlretrieve(SOURCES[name], path)
    return path


def load_text():
    src = json.loads((CACHE / "rv1909.json").read_text(encoding="utf-8"))
    text = {}
    for meta, book in zip(BOOKS, src["books"]):
        for ch in book["chapters"]:
            for v in ch["verses"]:
                text[(meta[0], ch["chapter"], v["verse"])] = v["text"]
    return text


def spanish_name(english, refs, text):
    """El nombre propio de la RV1909 que más se parece al inglés en los versículos de la persona."""
    if english in NAMES:
        return NAMES[english]
    if english in DESCRIBED:
        return DESCRIBED[english]
    relation = re.match(r"(\w+ of) (.+)$", english[:1].upper() + english[1:])
    if relation and relation.group(1) in RELATION:
        return f"{RELATION[relation.group(1)]} {spanish_name(relation.group(2), refs, text)}"
    # Los nombres hebreos en -iah/-jah terminan en -ías en la RV1909 (Maaseiah → Maasías)
    target = phonetic(re.sub(r"[ij]?ah$", "ías", english) if re.search(r"[eiuj]ah$", english) else english)
    for threshold in (0.66, 0.5):  # el umbral bajo solo para nombres raros que la RV1909 escribe muy distinto
        score = defaultdict(float)
        for ref in refs[:40]:
            best = {}
            for word in PROPER.findall(text.get(ref, "")):
                r = difflib.SequenceMatcher(None, phonetic(word), target).ratio()
                if r >= threshold and word not in COMMON and (threshold > 0.6 or phonetic(word)[:1] == target[:1]):
                    best[word] = max(best.get(word, 0), r)
            for word, r in best.items():
                score[word] += r
        if score:
            return max(score, key=score.get)
    return english


def build_genealogies(out, text):
    people = json.loads(fetch("theo-people.json").read_text(encoding="utf-8"))
    chapters = json.loads(fetch("theo-chapters.json").read_text(encoding="utf-8"))
    # Theographic numera los versículos con la versificación de la KJV, que es la de la RV1909
    verse_ref = {}
    for ch in chapters:
        book, num = ch["fields"]["osisRef"].split(".")
        for i, vid in enumerate(ch["fields"]["verses"], 1):
            verse_ref[vid] = (XREF_TO_ID[book], int(num), i)

    ids = {p["id"]: p["fields"]["personID"] for p in people}
    family = ("father", "mother", "partners", "children", "siblings", "halfSiblingsSameFather",
              "halfSiblingsSameMother")
    out_people, by_chapter = {}, defaultdict(dict)
    for p in people:
        f = p["fields"]
        if f["name"] in ("God", "Holy Spirit") or not any(f.get(k) for k in family):
            continue
        refs = sorted((verse_ref[v] for v in f.get("verses", []) if v in verse_ref), key=lambda r: (ORDER[r[0]], r[1], r[2]))
        if not refs:
            continue
        link = lambda *keys: sorted({ids[r] for k in keys for r in f.get(k, []) if r in ids})
        name = spanish_name(f["name"], refs, text)
        # Primera cita: el primer versículo que nombra a la persona (Theographic también enlaza alusiones)
        bare = name.split(" (")[0]
        first = next((r for r in refs if bare in text.get(r, "")), refs[0])
        out_people[f["personID"]] = [
            name, GENDER.get(f.get("gender"), ""), link("father"), link("mother"), link("partners"),
            link("children"), link("siblings", "halfSiblingsSameFather", "halfSiblingsSameMother"),
            "{}.{}.{}".format(*first), len(refs),
        ]
        for bid, ch, n in refs:
            if counts_in_chapter(f["name"], len(refs), bid, ch):
                by_chapter[(bid, ch)].setdefault(f["personID"], []).append(n)

    # Relaciones simétricas: si A es hijo de B, B tiene a A entre sus hijos (Theographic no siempre trae ambas)
    for pid, row in out_people.items():
        for parent in row[2] + row[3]:
            if parent in out_people and pid not in out_people[parent][5]:
                out_people[parent][5].append(pid)
        for child in row[5]:
            if child in out_people:
                slot = 2 if row[1] != "f" else 3
                if pid not in out_people[child][slot]:
                    out_people[child][slot].append(pid)
        for other in row[4]:
            if other in out_people and pid not in out_people[other][4]:
                out_people[other][4].append(pid)
    for row in out_people.values():
        for i in (2, 3, 4, 5, 6):
            row[i] = sorted(r for r in row[i] if r in out_people)

    write(out, "genealogia/personas.json", {str(k): v for k, v in out_people.items()})
    for (bid, ch), found in by_chapter.items():
        rows = sorted(found.items(), key=lambda kv: (kv[1][0], kv[0]))
        write(out, f"genealogia/{bid}/{ch}.json", [[pid, sorted(set(vs))] for pid, vs in rows])
    names = Counter(r[0] for r in out_people.values())
    print(f"Genealogías: {len(out_people)} personas con familia en {len(by_chapter)} capítulos "
          f"(nombres más repetidos: {names.most_common(3)})")


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "public" / "data"
    build_genealogies(out, load_text())


if __name__ == "__main__":
    main()
