"""Citas de los padres de la Iglesia por versículo, solo las de dominio público, para el comentario «Padres».

Uso:
  python3 pipeline/build_padres.py [salida]   (por defecto pipeline/.cache/teologia/padres-citas.json.gz)

Lo corre .github/workflows/padres.yml, que sube el resultado a la versión «teologia-fuentes-v1» del repositorio. Luego
pipeline/build_comentarios.py lo lee (fuente «padres») y lo divide por capítulos como los demás comentarios.

Fuente: Commentaries-Database de HistoricalChristianFaith (padres.tar.gz en la misma versión), citas de los padres
ordenadas por pasaje. Su compilación es de dominio público, pero trae también fragmentos de traducciones modernas con
derechos (uso legítimo). Aquí solo queda una cita si su texto está, casi palabra por palabra, en los volúmenes de los
Padres antenicenos y nicenos y postnicenos de Philip Schaff (ANF y NPNF, 1885-1900, dominio público). Además:
- solo padres hasta el año 750 (hasta Juan Damasceno); nada medieval ni de la Iglesia romana posterior;
- nada de quien un concilio condenó (la base lo marca), ni de la Catena Aurea de Tomás de Aquino;
- solo los 66 libros del canon protestante.
"""

import gzip
import io
import json
import re
import sys
import tarfile
import tomllib
import zlib
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from books import BOOKS  # noqa: E402
from build_teologia import CACHE, fetch  # noqa: E402

HASTA_AÑO = 750
# Palabras por trozo para comparar con Schaff, y qué parte de los trozos de una cita tienen que estar
SHINGLE = 8
MINIMO = 0.6
VOLUMENES = [f"anf{i:02d}.xml" for i in range(1, 11)] + [f"npnf1{i:02d}.xml" for i in range(1, 15)] + \
            [f"npnf2{i:02d}.xml" for i in range(1, 15)]

# Los 66 libros con su nombre en la base (book_names.json), en el mismo orden que BOOKS
NOMBRES = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel",
           "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job",
           "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel",
           "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai",
           "Zechariah", "Malachi", "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians",
           "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians",
           "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter",
           "1 John", "2 John", "3 John", "Jude", "Revelation"]
LIBRO = {n: b[0] for n, b in zip(NOMBRES, BOOKS)}

# Solo estos autores, con su nombre en español. Quedan fuera los libros de la Biblia que la base trae como «autor»
# (citas de la Escritura), los apócrifos y leyendas (Protoevangelio de Santiago, Tránsito de María, Hechos de Pedro y
# Pablo), las obras falsamente atribuidas (Pseudo-Clemente, Constituciones apostólicas, decretales de obispos de Roma
# de los siglos II y III), las liturgias y Orígenes, cuyas ideas condenó el concilio de Constantinopla del 553.
PADRES_ES = {
    "Alexander of Alexandria": "Alejandro de Alejandría", "Alexander of Jerusalem": "Alejandro de Jerusalén",
    "Ambrose of Milan": "Ambrosio de Milán", "Aphrahat the Persian Sage": "Afraates el Sabio Persa",
    "Archelaus of Carrhae": "Arquelao de Carrás", "Arnobius of Sicca": "Arnobio de Sicca",
    "Athanasius of Alexandria": "Atanasio de Alejandría", "Athenagoras of Athens": "Atenágoras de Atenas",
    "Augustine of Hippo": "Agustín de Hipona", "Basil of Caesarea": "Basilio de Cesarea",
    "Caius Presbyter of Rome": "Cayo, presbítero de Roma", "Clement of Alexandria": "Clemente de Alejandría",
    "Clement of Rome": "Clemente de Roma", "Commodian": "Comodiano", "Council of Carthage of 419": "Concilio de Cartago (419)",
    "Cyprian": "Cipriano de Cartago", "Cyril of Alexandria": "Cirilo de Alejandría", "Cyril of Jerusalem": "Cirilo de Jerusalén",
    "Didache": "Didajé", "Dionysius of Alexandria": "Dionisio de Alejandría", "Ephrem the Syrian": "Efrén el Sirio",
    "Epistle of Barnabas": "Epístola de Bernabé", "Eusebius of Caesarea": "Eusebio de Cesarea",
    "Gregory of Nazianzus": "Gregorio Nacianceno", "Gregory of Neocaesarea": "Gregorio Taumaturgo",
    "Gregory of Nyssa": "Gregorio de Nisa", "Gregory the Dialogist": "Gregorio Magno", "Hegemonius": "Hegemonio",
    "Hegesippus": "Hegesipo", "Hilary of Poitiers": "Hilario de Poitiers", "Hippolytus of Rome": "Hipólito de Roma",
    "Ignatius of Antioch": "Ignacio de Antioquía", "Irenaeus": "Ireneo de Lyon", "Jacob of Edessa": "Jacobo de Edesa",
    "Jerome": "Jerónimo", "John Cassian": "Juan Casiano", "John Chrysostom": "Juan Crisóstomo",
    "John Damascene": "Juan Damasceno", "Julius Africanus": "Julio Africano", "Justin Martyr": "Justino Mártir",
    "Leo the Great": "León Magno", "Lucius Caecilius Firmianus Lactantius": "Lactancio", "Malchion": "Malquión",
    "Marcus Minucius Felix": "Minucio Félix", "Martyrdom Of Polycarp": "Martirio de Policarpo",
    "Methodius of Olympus": "Metodio de Olimpo", "Nilus of Sinai": "Nilo del Sinaí", "Papias of Hierapolis": "Papías de Hierápolis",
    "Peter of Alexandria": "Pedro de Alejandría", "Phileas of Thmuis": "Fileas de Thmuis",
    "Polycarp of Smyrna": "Policarpo de Esmirna", "Polycrates Of Ephesus": "Polícrates de Éfeso",
    "Second Council of Constantinople": "Segundo Concilio de Constantinopla (553)", "Shepherd of Hermas": "El Pastor de Hermas",
    "Socrates Scholasticus": "Sócrates Escolástico", "Sulpicius Severus": "Sulpicio Severo", "Tertullian": "Tertuliano",
    "The Passion of Saints Perpetua and Felicity": "La pasión de Perpetua y Felicidad",
    "Theodoret of Cyrus": "Teodoreto de Ciro", "Theognostus Of Alexandria": "Teognosto de Alejandría",
    "Theonas of Alexandria": "Teonás de Alejandría", "Theophilus of Alexandria": "Teófilo de Alejandría",
    "Theophilus of Antioch": "Teófilo de Antioquía", "Tyrannius Rufinus": "Rufino de Aquilea",
    "Victorinus of Pettau": "Victorino de Petovio", "Vincent of Lérins": "Vicente de Lérins",
}


def words(text):
    return re.findall(r"[a-z]+", text.lower().replace("’", "'").replace("'", ""))


def shingles(ws):
    return [zlib.crc32(" ".join(ws[i:i + SHINGLE]).encode()) for i in range(len(ws) - SHINGLE + 1)]


# Volúmenes que la versión ya tenía con otro nombre
ALIAS = {"npnf201.xml": "eusebio.xml", "npnf204.xml": "atanasio.xml"}


def schaff_text(name):
    """El texto de un volumen de Schaff sin etiquetas (las notas al pie también cuentan: a veces citan)."""
    raw = fetch(ALIAS.get(name, name)).read_text(encoding="utf-8", errors="replace")
    raw = re.sub(r"<[^>]+>", " ", raw)
    return re.sub(r"&[a-z]+;|&#\d+;", " ", raw)


def leer_base():
    padres, citas = {}, []
    with tarfile.open(fetch("padres.tar.gz")) as tar:
        miembros = [m for m in tar.getmembers() if m.isfile() and m.name.endswith(".toml")]
        for m in miembros:
            partes = m.name.split("/")
            if len(partes) == 3 and partes[2] == "metadata.toml":
                padres[partes[1]] = tomllib.loads(tar.extractfile(m).read().decode("utf-8"))
        for m in miembros:
            partes = m.name.split("/")
            if len(partes) != 3 or partes[2] == "metadata.toml":
                continue
            padre, archivo = partes[1], partes[2][:-5]
            r = re.fullmatch(r"(.+) (\d+)_(\d+)(?:-(?:(\d+)_)?(\d+))?", archivo)
            if not r or r[1] not in LIBRO:
                continue
            c1, v1 = int(r[2]), int(r[3])
            c2 = int(r[4]) if r[4] else c1
            v2 = int(r[5]) if r[5] else v1
            try:
                data = tomllib.loads(tar.extractfile(m).read().decode("utf-8"))
            except tomllib.TOMLDecodeError:
                continue
            for c in data.get("commentary", []):
                quote = (c.get("quote") or "").strip()
                if quote:
                    citas.append({"padre": padre, "libro": LIBRO[r[1]], "c1": c1, "v1": v1, "c2": c2, "v2": v2,
                                  "texto": quote, "obra": (c.get("source_title") or "").strip(),
                                  "nota": (c.get("append_to_author_name") or "").strip(),
                                  "año": c.get("time")})
    return padres, citas


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else CACHE / "padres-citas.json.gz"
    padres, citas = leer_base()
    print(f"{len(citas):,} citas de {len(padres)} autores en la base")

    def año(c):
        a = c["año"] if isinstance(c["año"], int) else padres.get(c["padre"], {}).get("default_year")
        try:
            return int(a)
        except (TypeError, ValueError):
            return None

    quedan, motivos = [], defaultdict(int)
    for c in citas:
        meta = padres.get(c["padre"], {})
        a = año(c)
        if c["padre"] not in PADRES_ES:
            motivos["fuera de la lista de padres"] += 1
        elif a is None or a > HASTA_AÑO:
            motivos["posterior al 750 o sin fecha"] += 1
        elif meta.get("condemned_by_council"):
            motivos["condenado por un concilio"] += 1
        elif re.search(r"catena|aquinas", c["obra"] + " " + c["nota"], re.I):
            motivos["Catena Aurea"] += 1
        else:
            c["año"] = a
            quedan.append(c)
    print(f"{len(quedan):,} citas de padres hasta el {HASTA_AÑO}", dict(motivos))

    # Comprobar contra Schaff: se guardan los trozos de cada cita y se marcan los que aparecen en los volúmenes.
    trozos = []
    buscados = set()
    for c in quedan:
        hs = shingles(words(c["texto"]))
        trozos.append(hs)
        buscados.update(hs)
    vistos = set()
    for v in VOLUMENES:
        ws = words(schaff_text(v))
        vistos.update(h for h in shingles(ws) if h in buscados)
        print(f"  {v}: {len(ws):,} palabras; {len(vistos):,} trozos encontrados hasta ahora")

    final, sin = [], 0
    for c, hs in zip(quedan, trozos):
        if hs and sum(h in vistos for h in hs) / len(hs) >= MINIMO:
            final.append([c["libro"], c["c1"], c["v1"], c["c2"], c["v2"], c["padre"], c["obra"], c["año"], c["texto"]])
        else:
            sin += 1
    final.sort(key=lambda x: ([b[0] for b in BOOKS].index(x[0]), x[1], x[2], x[7]))
    autores = sorted({x[5] for x in final})
    meta = {p: {"es": PADRES_ES[p], "año": padres[p].get("default_year"), "wiki": padres[p].get("wiki", "")} for p in autores}
    print(f"{len(final):,} citas comprobadas en Schaff; {sin:,} fuera (traducciones modernas u otras fuentes)")
    print(f"{len(autores)} autores:", ", ".join(autores))
    out.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps({"padres": meta, "citas": final}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    out.write_bytes(gzip.compress(data, mtime=0))
    print(f"{out}: {out.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
