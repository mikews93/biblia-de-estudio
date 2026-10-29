"""Imágenes de objetos y mapas históricos que se mencionan en cada capítulo.

Cada entrada dice en qué capítulos aparece (un patrón que se busca en la RV1909, o capítulos fijos)
y de qué artículo de Wikipedia en inglés se toma la imagen principal. La imagen, su autor y su
licencia se piden a la API de Wikimedia al generar los datos, y solo se usan las de licencia libre
(dominio público, CC0, CC BY, CC BY-SA). La app la muestra desde upload.wikimedia.org y cita autor,
licencia y enlace a la página del archivo en Wikimedia Commons.
"""

import json
import re
import urllib.parse
import urllib.request
from html import unescape

API = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "BibliaDeEstudio/1.0 (https://zarzabiblia.com; datos para una app bíblica gratuita)"
FREE = re.compile(r"^(public domain|pd\b|cc0|cc[ -]by\b|cc[ -]by-sa\b|cc[ -]zero)", re.I)
# Wikimedia solo sirve miniaturas en unos anchos fijos (https://w.wiki/GHai): cualquier otro responde con un
# error 429 y la imagen no carga en la app (pasaba con las de 800 px, como la de Samaria en Juan 4).
THUMB_STEPS = (250, 330, 500, 960, 1280, 1920)
THUMB = 960


def standard_thumb(url):
    """La misma miniatura de upload.wikimedia.org en el ancho estándar más cercano por arriba."""
    m = re.search(r"/thumb/.+/(\d+)px-[^/]+$", url or "")
    if not m:
        return url
    width = int(m.group(1))
    step = next((s for s in THUMB_STEPS if s >= width), THUMB_STEPS[-1])
    return url[:m.start(1)] + str(step) + url[m.end(1):]

# kind: "objeto" o "mapa". pattern: se busca en el texto (respetando mayúsculas); books/chapters lo limitan.
# wiki: artículos candidatos, se usa el primero que tenga una imagen libre.
OBJECTS = [
    {"id": "arca", "title": "El arca del pacto",
     "caption": "Moisés y Josué ante el arca en el tabernáculo, acuarela de James Tissot (hacia 1900). "
                "El arca era un cofre de madera cubierto de oro con dos querubines encima (Éxodo 25).",
     "pattern": r"\bel arca\b|\barca del (?:pacto|testimonio)\b|\barca de (?:Dios|Jehová)\b",
     "skip_books": {"gen", "mat", "luk", "1pe"}, "wiki": ["Ark of the Covenant"]},
    {"id": "tabernaculo", "title": "El tabernáculo (maqueta)",
     "caption": "Reconstrucción del santuario portátil que Israel llevó por el desierto.",
     "pattern": r"\btabernáculo\b", "books": {"exo", "lev", "num", "heb"}, "wiki": ["Tabernacle"]},
    {"id": "candelero", "title": "El candelero de oro",
     "caption": "Representación del candelero de siete brazos que describe Éxodo 25:31-40.",
     "pattern": r"\bcandelero\b", "books": {"exo", "lev", "num", "zec", "heb", "1ch", "2ch"},
     "wiki": ["Temple menorah", "Menorah (Temple)"]},
    {"id": "mar-bronce", "title": "El mar de bronce",
     "caption": "Ilustración del gran depósito de agua del templo de Salomón (1 Reyes 7:23).",
     "pattern": r"\bmar de fundición\b", "wiki": ["Molten Sea"]},
    {"id": "templo-salomon", "title": "El templo de Salomón (reconstrucción)",
     "caption": "Cómo pudo ser el primer templo de Jerusalén según la descripción bíblica.",
     "chapters": {"1ki": [6, 7, 8], "2ch": [3, 4, 5]}, "wiki": ["Solomon's Temple"]},
    {"id": "bocina", "title": "Bocina (shofar)",
     "caption": "Trompeta hecha de cuerno de carnero, la que la RV1909 llama «bocina».",
     "pattern": r"\bbocinas?\b", "wiki": ["Shofar"]},
    {"id": "zigurat-ur", "title": "El zigurat de Ur",
     "caption": "Templo escalonado de Ur de los caldeos, la ciudad de donde salió Abraham.",
     "pattern": r"\bUr de los Caldeos\b", "wiki": ["Ziggurat of Ur"]},
    {"id": "amuletos", "title": "Los rollitos de plata de Ketef Hinnom",
     "caption": "Amuletos del siglo VII a. C. con la bendición de Números 6:24-26: el texto bíblico más antiguo que se conoce.",
     "chapters": {"num": [6]}, "wiki": ["Ketef Hinnom scrolls"]},
    {"id": "mesa", "title": "La estela de Mesa",
     "caption": "Piedra en la que Mesa, rey de Moab, cuenta su rebelión contra Israel (2 Reyes 3).",
     "pattern": r"\bMesa rey de Moab\b", "wiki": ["Mesha Stele"]},
    {"id": "obelisco", "title": "El obelisco negro de Salmanasar III",
     "caption": "Relieve asirio en el que Jehú, rey de Israel, se inclina ante el rey de Asiria.",
     "chapters": {"2ki": [9, 10]}, "wiki": ["Black Obelisk of Shalmaneser III"]},
    {"id": "laquis", "title": "Los relieves de Laquis",
     "caption": "De los relieves del palacio de Senaquerib en Nínive que narran el asedio de Laquis (2 Reyes 18:14).",
     "pattern": r"\bLach[iî]s\b", "books": {"2ki", "2ch", "isa"}, "wiki": ["Lachish reliefs"]},
    {"id": "siloe", "title": "La inscripción de Siloé",
     "caption": "Inscripción del túnel con el que Ezequías llevó el agua dentro de la ciudad (2 Reyes 20:20).",
     "chapters": {"2ki": [20], "2ch": [32]}, "wiki": ["Siloam inscription"]},
    {"id": "ishtar", "title": "La puerta de Ishtar de Babilonia",
     "caption": "Puerta de ladrillo vidriado construida por Nabucodonosor, hoy en el Museo de Pérgamo de Berlín.",
     "pattern": r"\bNabucodonosor\b", "books": {"2ki", "2ch", "dan", "jer"}, "wiki": ["Ishtar Gate"]},
    {"id": "ciro", "title": "El cilindro de Ciro",
     "caption": "Ciro de Persia anuncia que devuelve a los pueblos deportados a sus tierras y templos, como en Esdras 1.",
     "pattern": r"\bCiro\b", "books": {"2ch", "ezr", "isa"}, "wiki": ["Cyrus Cylinder"]},
    {"id": "templo-herodes", "title": "El templo de Jerusalén en tiempos de Jesús",
     "caption": "Maqueta de Jerusalén del siglo I en el Museo de Israel, con el templo que amplió Herodes.",
     "pattern": r"\btemplo\b", "books": {"mat", "mrk", "luk", "jhn", "act"}, "wiki": ["Holyland Model of Jerusalem"]},
    {"id": "arco-tito", "title": "El Arco de Tito",
     "caption": "Arco romano que celebra la toma de Jerusalén y la destrucción del templo en el año 70.",
     "chapters": {"mat": [24], "mrk": [13], "luk": [19, 21]}, "wiki": ["Arch of Titus"]},
    {"id": "barca", "title": "La barca de Galilea",
     "caption": "Barca de pesca del siglo I hallada en el mar de Galilea, como las de los discípulos.",
     "pattern": r"\b(?:barco|barca|navecilla)\b", "books": {"mat", "mrk", "luk", "jhn"}, "wiki": ["Sea of Galilee Boat"]},
    {"id": "denario", "title": "Denario de Tiberio",
     "caption": "La moneda con la imagen del César de Mateo 22:20, el jornal de un día.",
     "pattern": r"\bdenarios?\b", "wiki": ["Tribute penny"]},
    {"id": "blanca", "title": "Blanca (leptón)",
     "caption": "Moneda de bronce de Judea, la más pequeña de su tiempo, como las dos de la viuda.",
     "pattern": r"\bdos blancas\b", "books": {"mrk", "luk"}, "wiki": ["Widow's mite"]},
    {"id": "pilato", "title": "La piedra de Pilato",
     "caption": "Inscripción de Cesarea con el nombre de Poncio Pilato, prefecto de Judea.",
     "pattern": r"\bPilato\b", "books": {"mat", "mrk", "luk", "jhn"}, "wiki": ["Pilate stone"]},
    {"id": "caifas", "title": "El osario de Caifás",
     "caption": "Caja de huesos con el nombre «José hijo de Caifás», probablemente el sumo sacerdote.",
     "pattern": r"\bCaifás\b", "wiki": ["Caiaphas ossuary"]},
    {"id": "galion", "title": "La inscripción de Galión",
     "caption": "Carta del emperador Claudio hallada en Delfos que nombra a Galión, procónsul de Acaya (Hechos 18:12).",
     "pattern": r"\bGall?i[oó]n\b", "wiki": ["Delphi Inscription", "Gallio Inscription"]},

    # Mapas históricos
    {"id": "mapa-tribus", "kind": "mapa", "title": "Mapa del reparto de la tierra entre las tribus",
     "caption": "Territorio de cada una de las doce tribus de Israel.",
     "chapters": {"jos": list(range(13, 22)), "num": [34], "ezk": [48]}, "wiki": ["Twelve Tribes of Israel"]},
    {"id": "mapa-reinos", "kind": "mapa", "title": "Mapa de los reinos de Israel y Judá",
     "caption": "El reino del norte (Israel) y el del sur (Judá) después de la división tras Salomón.",
     "chapters": {"1ki": [12], "2ch": [10, 11]}, "wiki": ["Kingdom of Israel (Samaria)"]},
    {"id": "mapa-persia", "kind": "mapa", "title": "Mapa del Imperio persa",
     "caption": "El imperio de Ciro y sus sucesores, «desde la India hasta la Etiopía» (Ester 1:1).",
     "chapters": {"est": [1], "ezr": [1], "dan": [6]}, "wiki": ["Achaemenid Empire"]},
    {"id": "mapa-herodes", "kind": "mapa", "title": "Mapa del reino de Herodes",
     "caption": "Judea, Samaria, Galilea y las regiones vecinas en el tiempo del nacimiento de Jesús.",
     "chapters": {"mat": [2], "luk": [1, 3]}, "wiki": ["Herodian Kingdom of Judea", "Herodian kingdom"]},
    {"id": "mapa-iglesias", "kind": "mapa", "title": "Mapa de las siete iglesias de Asia",
     "caption": "Éfeso, Esmirna, Pérgamo, Tiatira, Sardis, Filadelfia y Laodicea (Apocalipsis 1-3).",
     "chapters": {"rev": [1, 2, 3]}, "wiki": ["Seven churches of Asia"]},
]

for o in OBJECTS:
    o["regex"] = re.compile(o["pattern"]) if "pattern" in o else None


def chapter_objects(book, chapter, verses):
    """Objetos y mapas de un capítulo con los versículos donde se mencionan (vacío si son del capítulo entero)."""
    found = []
    for o in OBJECTS:
        if book in o.get("skip_books", ()) or ("books" in o and book not in o["books"]):
            continue
        if "chapters" in o:
            if chapter in o["chapters"].get(book, ()):
                hits = [n for n, t in verses if o["regex"].search(t)] if o["regex"] else []
                found.append((o, hits))
        elif o["regex"]:
            hits = [n for n, t in verses if o["regex"].search(t)]
            if hits:
                found.append((o, hits))
    return found


def _get(params):
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json", "formatversion": 2})
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def _text(html):
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", "", html or ""))).strip()


def resolve(cache_path):
    """La imagen libre de cada entrada: {id: {img, w, h, page, author, license}}. Se guarda en caché."""
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    titles = sorted({t for o in OBJECTS for t in o["wiki"]} - set(cache))
    for i in range(0, len(titles), 40):
        chunk = titles[i:i + 40]
        try:
            pages = _get({"action": "query", "titles": "|".join(chunk), "prop": "pageimages",
                          "piprop": "name", "pilicense": "free", "redirects": 1})["query"]
        except Exception as err:  # sin red: se generan los datos sin imágenes de objetos
            print(f"Aviso: no se pudo consultar Wikipedia ({err}); se omiten las imágenes de objetos")
            return {}
        alias = {r["from"]: r["to"] for r in pages.get("redirects", []) + pages.get("normalized", [])}
        files = {p["title"]: p.get("pageimage") for p in pages["pages"]}
        for t in chunk:
            name = alias.get(t, t)
            name = alias.get(name, name)
            cache[t] = {"file": files.get(name)}
    files = sorted({v["file"] for v in cache.values() if v.get("file") and "img" not in v and "rejected" not in v})
    for i in range(0, len(files), 40):
        chunk = files[i:i + 40]
        try:
            pages = _get({"action": "query", "titles": "|".join("File:" + f for f in chunk), "prop": "imageinfo",
                          "iiprop": "url|size|extmetadata", "iiurlwidth": THUMB})["query"]
        except Exception as err:
            print(f"Aviso: no se pudo consultar Wikimedia ({err}); se omiten las imágenes de objetos")
            return {}
        info = {}
        for p in pages["pages"]:
            ii = (p.get("imageinfo") or [{}])[0]
            meta = ii.get("extmetadata", {})
            lic = meta.get("LicenseShortName", {}).get("value", "")
            free = FREE.match(lic) and meta.get("NonFree", {}).get("value") != "true"
            info[p["title"].removeprefix("File:").replace(" ", "_")] = {
                "img": ii.get("thumburl"), "w": ii.get("thumbwidth"), "h": ii.get("thumbheight"),
                "page": ii.get("descriptionurl"), "author": _text(meta.get("Artist", {}).get("value"))[:120] or None,
                "license": lic,
            } if free and ii.get("thumburl") else {"rejected": lic or "sin datos"}
        for v in cache.values():
            f = (v.get("file") or "").replace(" ", "_")
            if f in info:
                v.update(info[f])
    cache_path.parent.mkdir(exist_ok=True)
    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")

    result = {}
    for o in OBJECTS:
        hit = next((cache[t] for t in o["wiki"] if cache.get(t, {}).get("img")), None)
        if hit:
            result[o["id"]] = {k: hit[k] for k in ("img", "w", "h", "page", "author", "license")}
            result[o["id"]]["img"] = standard_thumb(hit["img"])
        else:
            why = "; ".join(f"{t}: {cache.get(t, {}).get('rejected') or cache.get(t, {}).get('file') or 'sin imagen'}"
                            for t in o["wiki"])
            print(f"Aviso: sin imagen libre para «{o['title']}» ({why})")
    print(f"Imágenes de objetos y mapas: {len(result)} de {len(OBJECTS)}")
    for o in OBJECTS:
        if o["id"] in result:
            print(f"  {o['id']}: {result[o['id']]['page']} ({result[o['id']]['license']})")
    return result
