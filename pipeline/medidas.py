"""Medidas antiguas de la Biblia con su equivalencia moderna, y en qué versículos de la RV1909 aparecen.

Los valores son los aproximados que dan los diccionarios bíblicos y la tabla de Wikipedia
«Biblical and Talmudic units of measurement» (CC BY-SA). Variaban según la época y la región,
así que se dan redondeados y con «≈».

Cada medida tiene un patrón que se busca en el texto de la RV1909 respetando mayúsculas
(«epha» es la medida, «Epha» es un nombre propio), y opcionalmente los libros o capítulos
donde la palabra significa esa medida y no otra cosa («caña» de medir solo en Ezequiel 40-48).
"""

import re

from books import BOOKS

NT = {b[0] for b in BOOKS if b[4]}
OT = {b[0] for b in BOOKS} - NT

MEASURES = [
    # Longitud y distancia
    {"id": "codo", "kind": "Longitud", "name": "Codo", "value": "≈ 45 cm",
     "note": "Del codo a la punta de los dedos. El «codo de á codo y palmo» de Ezequiel es el codo largo, ≈ 52 cm.",
     "pattern": r"\bcodos?\b"},
    {"id": "palmo", "kind": "Longitud", "name": "Palmo", "value": "≈ 22 cm (o ≈ 7,5 cm)",
     "note": "La RV1909 llama «palmo» a dos medidas: la mano abierta del pulgar al meñique (medio codo, ≈ 22 cm) "
             "y el ancho de la mano (≈ 7,5 cm), que es el del grueso del mar de bronce y el codo largo de Ezequiel.",
     "pattern": r"\bpalmos?\b"},
    {"id": "dedo", "kind": "Longitud", "name": "Dedo", "value": "≈ 1,9 cm",
     "note": "El ancho de un dedo, la medida más pequeña. Cuatro dedos ≈ 7,5 cm.",
     "pattern": r"\bde cuatro dedos\b"},
    {"id": "cana", "kind": "Longitud", "name": "Caña de medir", "value": "≈ 3,1 m",
     "note": "Seis codos largos (Ezequiel 40:5). Era una vara para medir edificios, como una cinta métrica de hoy.",
     "pattern": r"\bcañas?\b", "chapters": {"ezk": (40, 48), "rev": (11, 21)}},
    {"id": "braza", "kind": "Longitud", "name": "Braza", "value": "≈ 1,85 m",
     "note": "La distancia entre las manos con los brazos extendidos; se usaba para medir la profundidad del mar. "
             "Veinte brazas ≈ 37 m.",
     "pattern": r"\bbrazas?\b", "books": {"act"}},
    {"id": "estadio", "kind": "Distancia", "name": "Estadio", "value": "≈ 185 m",
     "note": "Medida griega, como el largo de dos campos de fútbol. Sesenta estadios (Lucas 24:13) ≈ 11 km.",
     "pattern": r"\bestadios?\b", "exclude": {"1co": {9}}},
    {"id": "milla", "kind": "Distancia", "name": "Milla", "value": "≈ 1,5 km",
     "note": "La milla romana de mil pasos, unos 20 minutos a pie. En 2 Reyes 5:19 traduce una expresión hebrea "
             "de distancia imprecisa, «un trecho de tierra».",
     "pattern": r"\bmillas?\b"},
    {"id": "sabado", "kind": "Distancia", "name": "Camino de un sábado", "value": "≈ 1 km",
     "note": "Unos 2.000 codos: lo que la tradición judía permitía caminar en sábado.",
     "pattern": r"\bcamino de un sábado\b"},

    # Peso
    {"id": "siclo", "kind": "Peso", "name": "Siclo", "value": "≈ 11,4 g",
     "note": "La unidad básica para pesar plata y oro; en casi todo el Antiguo Testamento aún no era una moneda. "
             "Medio siclo ≈ 5,7 g. Cuatrocientos siclos (Génesis 23:15) ≈ 4,6 kg de plata.",
     "pattern": r"\bsiclos?\b"},
    {"id": "gera", "kind": "Peso", "name": "Gera", "value": "≈ 0,57 g",
     "note": "La veinteava parte de un siclo, como un grano de arroz grande.",
     "pattern": r"\bgeras?\b"},
    {"id": "mina", "kind": "Peso", "name": "Mina", "value": "≈ 570 g",
     "note": "Cincuenta siclos. La RV1909 la llama a veces «libra» («libras de plata»).",
     "pattern": r"\bminas?\b|\blibras de (?:oro|plata)\b", "books": OT, "exclude": {"zep": {2}}},
    {"id": "talento", "kind": "Peso", "name": "Talento", "value": "≈ 34 kg",
     "note": "Tres mil siclos: más o menos lo que puede cargar una persona. Un talento de oro valía una fortuna.",
     "pattern": r"\btalentos?\b", "books": OT | {"rev"}},
    {"id": "libra", "kind": "Peso", "name": "Libra", "value": "≈ 330 g",
     "note": "La libra romana. Las cien libras de mirra y áloes de Juan 19:39 pesaban ≈ 33 kg.",
     "pattern": r"\blibras?\b", "books": {"jhn"}},

    # Capacidad
    {"id": "epha", "kind": "Capacidad", "name": "Epha", "value": "≈ 22 litros",
     "note": "Medida para grano y harina, como un cubo grande. Igual que el bato, que se usaba para líquidos.",
     "pattern": r"\bepha\b"},
    {"id": "gomer", "kind": "Capacidad", "name": "Gomer", "value": "≈ 2,2 litros",
     "note": "La décima parte de un epha: la ración de maná de una persona por día (Éxodo 16).",
     "pattern": r"\bgomer(?:es)?\b"},
    {"id": "homer", "kind": "Capacidad", "name": "Homer o coro", "value": "≈ 220 litros",
     "note": "Diez ephas: la carga de un asno. «Coro» es otro nombre de la misma medida.",
     "pattern": r"\bhomer\b|\bcoros?\b", "exclude": {"neh": {12}}},
    {"id": "seah", "kind": "Capacidad", "name": "Seah", "value": "≈ 7,3 litros",
     "note": "Un tercio de epha. Las «tres medidas de harina» de Génesis 18:6 y de la parábola de la levadura "
             "son tres seahs, ≈ 22 litros: pan para mucha gente.",
     "pattern": r"\bseah\b|\bsatos?\b|\btres medidas de (?:flor de )?harina\b"},
    {"id": "cabo", "kind": "Capacidad", "name": "Cabo", "value": "≈ 1,2 litros",
     "note": "La sexta parte de un seah, como una botella grande.",
     "pattern": r"\bun cabo de estiércol\b"},
    {"id": "almud", "kind": "Capacidad", "name": "Almud", "value": "≈ 8,7 litros",
     "note": "Recipiente de madera para medir grano que había en las casas; poner la lámpara debajo la apagaba.",
     "pattern": r"\balmud\b"},
    {"id": "bato", "kind": "Capacidad", "name": "Bato", "value": "≈ 22 litros",
     "note": "Medida para líquidos como vino y aceite, igual que el epha. Los «barriles» de Lucas 16:6 son batos.",
     "pattern": r"\bbatos?\b|\bbarriles de aceite\b"},
    {"id": "hin", "kind": "Capacidad", "name": "Hin", "value": "≈ 3,7 litros",
     "note": "La sexta parte de un bato, como un garrafón pequeño de agua.",
     "pattern": r"\bhin\b"},
    {"id": "log", "kind": "Capacidad", "name": "Log", "value": "≈ 0,3 litros",
     "note": "La medida más pequeña para líquidos, como un vaso.",
     "pattern": r"\blog\b"},
    {"id": "cantaro", "kind": "Capacidad", "name": "Cántaro (metreta)", "value": "≈ 39 litros",
     "note": "Cada tinaja de Caná tenía de dos a tres cántaros: entre 80 y 120 litros. Seis tinajas, unos 600 litros de vino.",
     "pattern": r"\bcántaros\b", "books": {"jhn"}},
    {"id": "quenice", "kind": "Capacidad", "name": "«Libra» de trigo (quénice)", "value": "≈ 1,1 litros",
     "note": "En Apocalipsis 6:6 «libra» traduce el quénice griego, la ración diaria de grano de un trabajador. "
             "Que costara un denario, el jornal de un día, describe una carestía.",
     "pattern": r"\blibras de (?:trigo|cebada)\b"},

    # Dinero
    {"id": "talento-nt", "kind": "Dinero", "name": "Talento", "value": "≈ 6.000 denarios",
     "note": "Unos veinte años de jornal de un trabajador. Diez mil talentos (Mateo 18:24) era una deuda imposible de pagar.",
     "pattern": r"\btalentos?\b", "books": {"mat"}},
    {"id": "mina-nt", "kind": "Dinero", "name": "Mina", "value": "≈ 100 denarios",
     "note": "Unos tres o cuatro meses de jornal.",
     "pattern": r"\bminas?\b", "books": {"luk"}},
    {"id": "denario", "kind": "Dinero", "name": "Denario", "value": "1 día de trabajo",
     "note": "Moneda romana de plata (≈ 3,8 g): el jornal de un obrero del campo (Mateo 20:2).",
     "pattern": r"\bdenarios?\b"},
    {"id": "dracma", "kind": "Dinero", "name": "Dracma", "value": "≈ 1 denario",
     "note": "Moneda griega de plata, un día de trabajo. «Las dos dracmas» de Mateo 17:24 eran el impuesto anual del templo.",
     "pattern": r"\bdracmas?\b", "books": NT},
    {"id": "darico", "kind": "Dinero", "name": "Dracma de oro (dárico)", "value": "≈ 8,4 g de oro",
     "note": "Moneda persa de oro; en Esdras y Nehemías la RV1909 la llama dracma.",
     "pattern": r"\bdracmas?\b", "books": {"ezr", "neh"}},
    {"id": "estatero", "kind": "Dinero", "name": "Estatero", "value": "4 dracmas",
     "note": "Moneda de plata que alcanzaba para pagar el impuesto del templo de dos personas (Mateo 17:27).",
     "pattern": r"\bestatero\b"},
    {"id": "piezas", "kind": "Dinero", "name": "Piezas de plata", "value": "≈ 11,4 g cada una",
     "note": "Casi siempre siclos de plata. Treinta siclos era el precio de un esclavo (Éxodo 21:32).",
     "pattern": r"\bpiezas de plata\b"},
    {"id": "cuarto", "kind": "Dinero", "name": "Cuarto (asarión)", "value": "1/16 de denario",
     "note": "Moneda romana de bronce: menos de una hora de trabajo.",
     "pattern": r"\bpor un cuarto\b"},
    {"id": "blanca", "kind": "Dinero", "name": "Blanca y maravedí", "value": "1/128 y 1/64 de denario",
     "note": "La blanca (leptón) era la moneda más pequeña, de cobre; dos blancas hacían un cuadrante o maravedí. "
             "La ofrenda de la viuda valía unos minutos de jornal. En Lucas 12:6 «dos blancas» traduce dos asariones.",
     "pattern": r"\bdos blancas\b|\bmaravedí\b|\bcuadrante\b"},

    # Tiempo
    {"id": "horas", "kind": "Tiempo", "name": "Horas del día", "value": "desde las 6 de la mañana",
     "note": "Las horas se contaban desde la salida del sol. «La hora de las tres» o tercia ≈ 9 de la mañana; "
             "sexta ≈ mediodía; nona o «de las nueve» ≈ 3 de la tarde; «las diez» ≈ 4 y undécima ≈ 5 de la tarde.",
     "pattern": r"\bhoras? (?:de )?(?:las )?(?:tres|seis|siete|nueve|diez|once|tercia|sexta|nona|undécima)\b"
                r"|\bAyer á las siete\b"},
    {"id": "vigilias", "kind": "Tiempo", "name": "Vigilias de la noche", "value": "3 horas cada una",
     "note": "En tiempos romanos la noche se dividía en cuatro vigilias, de 6 de la tarde a 6 de la mañana: "
             "la cuarta ≈ de 3 a 6 de la madrugada. En el Antiguo Testamento eran tres («vela del medio», «de la mañana»).",
     "pattern": r"\bvigilias? de la noche\b|\b(?:primera|segunda|tercera|cuarta) vigilia\b"
                r"|\bvela (?:de la mañana|del medio)\b"},
]

for m in MEASURES:
    m["regex"] = re.compile(m["pattern"])


def applies(m, book, chapter):
    if "chapters" in m:
        span = m["chapters"].get(book)
        return bool(span) and span[0] <= chapter <= span[1]
    if "books" in m:
        if book not in m["books"]:
            return False
    return chapter not in m.get("exclude", {}).get(book, set())


def chapter_measures(book, chapter, verses):
    """Medidas de un capítulo, en el orden de la tabla, con los versículos donde aparecen."""
    found = []
    for m in MEASURES:
        if not applies(m, book, chapter):
            continue
        hits = [n for n, t in verses if m["regex"].search(t)]
        if hits:
            found.append({k: m[k] for k in ("id", "kind", "name", "value", "note")} | {"verses": hits})
    return found
