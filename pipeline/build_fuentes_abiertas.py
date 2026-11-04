"""Léxicos y diccionario bíblico que ya vienen en español, con licencia CC BY-SA 4.0.

Uso: python3 pipeline/build_fuentes_abiertas.py [carpeta_salida]   (por defecto: public/data)

Fuentes, en copias con commit fijado (raw.githubusercontent.com):
- UBS Dictionary of Biblical Hebrew y UBS Dictionary of the Greek New Testament (Sociedades Bíblicas Unidas, 2023),
  edición en español, de github.com/ubsicap/ubs-open-license. El griego adapta el léxico de Louw y Nida.
- Aquifer Open Bible Dictionary en español (Mission Mutual, 2026), adaptación del Tyndale Open Bible Dictionary
  (Tyndale House Publishers, 2023), de github.com/BibleAquifer/AquiferOpenBibleDictionary.
Las dos piden dar crédito y compartir lo derivado con la misma licencia: src/lib/fuentesCreditos.ts y /fuentes lo dicen.

Salida:
  lexico/<Strong>.json     el léxico de un número de Strong («G0026», «H2617»; el arameo «A» de UBS va con su «H»):
                           [{"l": lema, "s": [[glosas, definición, comentario, dominio, {libro: "c.v c.v"}], ...]}]
  diccionario-es/indice.json      [[id, título, tipo]] de todos los artículos, en orden alfabético
  diccionario-es/a/<id>.json      {"t": título, "x": texto, "tipo": tipo}; el texto es el markdown sencillo de los
                                  comentarios (##, **, *, ⟦jhn.3.16⟧) y ⟦d:<id>|texto⟧ para enlazar otro artículo
  diccionario-es/cap/<libro>/<c>.json   {versículo: [[id, título, tipo], ...]}: los artículos que tratan ese versículo
"""

import html
import json
import re
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

from books import BOOKS

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / ".cache" / "fuentes-abiertas"
UBS = "https://raw.githubusercontent.com/ubsicap/ubs-open-license/a15a96cfaa4ca18a6c0339016645ba1e534db3c8/dictionaries/"
UBS_FILES = {"griego": UBS + "greek/JSON/UBSGreekNTDic-v1.0-es.JSON", "hebreo": UBS + "hebrew/JSON/UBSHebrewDic-v0.9.4-es.JSON"}
AQUIFER = ("https://raw.githubusercontent.com/BibleAquifer/AquiferOpenBibleDictionary/"
           "663a34ef9c4edfeff17c8dda22f5f926a8b41f90/spa/json/{:03d}.content.json")
AQUIFER_PARTS = 27
IDS = [b[0] for b in BOOKS]
# Artículos por versículo, como mucho; primero los más específicos (los que tratan menos pasajes).
POR_VERSICULO = 6
# Las personas y los lugares ya tienen su ficha en el lector; sus artículos salen en el buscador y en /diccionario.
SIN_CHIP = {"person", "place"}
# Artículos que la edición en español dejó sin traducir.
SALTAR = {"Without"}


def fetch(name, url):
    path = CACHE / name
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"Descargando {name}…")
        path.write_bytes(urllib.request.urlopen(url, timeout=300).read())
    return path


def write(out, rel, data):
    path = out / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


# ------------------------------------------------------------------------------------------------ léxicos de UBS

def limpiar_ubs(t):
    """Las marcas de UBS: {L:ἀγαπάω<SDBG:ἀγαπάω:000000>}[a] → ἀγαπάω[a]; {S:…} y {D:…} igual; las referencias
    sueltas («04302101500046») → ⟦jhn.21.15⟧."""
    t = re.sub(r"\{[A-Z]:([^<}]*)<[^>]*>\}", r"\1", t or "")
    t = re.sub(r"\b\d{14}\b", lambda m: (lambda r: f"⟦{r[0]}.{r[1]}.{r[2]}⟧" if r else "")(ubs_ref(m.group(0))), t)
    t = re.sub(r"\{[A-Z]:([^}]*)\}", r"\1", t)
    t = re.sub(r"<[^>]+>", "", t)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def ubs_ref(code):
    """«04200100500044» (libro 042, capítulo 001, versículo 005, palabra) → ("luk", 1, 5)."""
    if not code or len(code) < 9 or not code[:9].isdigit():
        return None
    b, c, v = int(code[:3]), int(code[3:6]), int(code[6:9])
    if not 1 <= b <= 66 or not c or not v:
        return None
    return IDS[b - 1], c, v


def strong_key(code):
    m = re.fullmatch(r"([GHA])0*(\d{1,4})[A-Za-z]?", code or "")
    if not m:
        return None
    return f"{'G' if m.group(1) == 'G' else 'H'}{int(m.group(2)):04d}"


def build_lexicos(out):
    por_strong = defaultdict(list)
    for nombre, url in UBS_FILES.items():
        entradas = json.loads(fetch(f"ubs-{nombre}.json", url).read_text(encoding="utf-8-sig"))
        for e in entradas:
            sentidos = []
            for base in e.get("BaseForms") or []:
                for m in base.get("LEXMeanings") or []:
                    sense = next((s for s in m.get("LEXSenses") or [] if s.get("LanguageCode") == "es"), None)
                    if not sense:
                        continue
                    glosas = [limpiar_ubs(g) for g in sense.get("Glosses") or [] if limpiar_ubs(g)]
                    definicion = limpiar_ubs(sense.get("DefinitionLong") or sense.get("DefinitionShort"))
                    definicion = re.sub(r"^[=≈►]\s*", "", definicion)
                    if not glosas and not definicion:
                        continue
                    dominio = next((limpiar_ubs(d.get("Domain")) for d in m.get("LEXDomains") or [] if d.get("Domain")), "")
                    refs = defaultdict(list)
                    for code in m.get("LEXReferences") or []:
                        r = ubs_ref(code)
                        if r and f"{r[1]}.{r[2]}" not in refs[r[0]]:
                            refs[r[0]].append(f"{r[1]}.{r[2]}")
                    sentidos.append([glosas, definicion, limpiar_ubs(sense.get("Comments")), dominio,
                                     {b: " ".join(v) for b, v in refs.items()}])
            if not sentidos:
                continue
            claves = {k for k in map(strong_key, e.get("StrongCodes") or []) if k}
            for k in claves:
                por_strong[k].append({"l": e["Lemma"], "s": sentidos})
    for k, entradas in por_strong.items():
        write(out, f"lexico/{k}.json", entradas)
    print(f"Léxicos de UBS: {len(por_strong)} números de Strong")


# ------------------------------------------------------------------------------------- diccionario bíblico Tyndale

def aquifer_ref(start, end):
    """«43003016», «43003021» → «jhn.3.16-jhn.3.21»; un capítulo entero (versículo 000) → «jhn.3»."""
    def one(code):
        code = (code or "").zfill(8)
        if not code.isdigit():
            return None
        b, c, v = int(code[:2]), int(code[2:5]), int(code[5:8])
        if not 1 <= b <= 66 or not c:
            return None
        return IDS[b - 1], c, v

    a, z = one(start), one(end or start)
    if not a:
        return None
    if not a[2]:
        return f"{a[0]}.{a[1]}"
    if not z or z == a or not z[2]:
        return f"{a[0]}.{a[1]}.{a[2]}"
    return f"{a[0]}.{a[1]}.{a[2]}-{z[0]}.{z[1]}.{z[2]}"


def a_markdown(contenido):
    """El HTML del artículo → el markdown sencillo que dibuja Rich (Commentary.tsx). Sin el título <h1>."""
    t = contenido

    def bible(m):
        attrs, label = m.group(1), m.group(2)
        s = re.search(r'data-start-ref="(\d+)"', attrs)
        e = re.search(r'data-end-ref="(\d+)"', attrs)
        r = aquifer_ref(s and s.group(1), e and e.group(1))
        label = re.sub(r"<[^>]+>", "", label).strip()
        if not r or "." not in r[4:]:
            return label
        tail = re.search(r"[,;.]\s*$", label)
        return f"⟦{r}⟧{tail.group(0).strip() if tail else ''}"

    def resource(m):
        attrs, label = m.group(1), re.sub(r"<[^>]+>", "", m.group(2)).strip()
        cid = re.search(r'data-content-id="(\d+)"', attrs)
        return f"⟦d:{cid.group(1)}|{label}⟧" if cid and label else label

    t = re.sub(r'<data class="bible-ref"([^>]*)>(.*?)</data>', bible, t, flags=re.S)
    t = re.sub(r'<data class="resource-ref"([^>]*)>(.*?)</data>', resource, t, flags=re.S)
    t = re.sub(r"<h1[^>]*>.*?</h1>", "", t, flags=re.S)
    t = re.sub(r"<h[2-6][^>]*>(.*?)</h[2-6]>", lambda m: f"\n\n## {m.group(1)}\n\n", t, flags=re.S)
    t = re.sub(r"<(strong|b)>(.*?)</\1>", lambda m: f"**{m.group(2).strip()}**" if m.group(2).strip() else "", t, flags=re.S)
    t = re.sub(r"<(em|i)>(.*?)</\1>", lambda m: f"*{m.group(2).strip()}*" if m.group(2).strip() else "", t, flags=re.S)
    t = re.sub(r"<li[^>]*>", "\n\n• ", t)
    t = re.sub(r"</(p|li|ul|ol|tr|table|blockquote)>|<br\s*/?>", "\n\n", t)
    t = re.sub(r"</t[dh]>", " · ", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = html.unescape(t).replace(" ", " ")
    paras = []
    for p in re.split(r"\n{2,}", t):
        p = re.sub(r"[ \t\r\n]+", " ", p).strip(" ·")
        if p and p != "•":
            paras.append(p)
    return "\n\n".join(paras)


def titulo(a):
    return re.sub(r"\*$", "", a["title"]).strip()


def build_diccionario(out):
    articulos = []
    for i in range(1, AQUIFER_PARTS + 1):
        articulos += json.loads(fetch(f"aquifer-{i:03d}.json", AQUIFER.format(i)).read_text(encoding="utf-8"))
    ids = {a["content_id"] for a in articulos if titulo(a) not in SALTAR}
    tipos = {}
    indice = []
    por_versiculo = defaultdict(list)
    articulos = [a for a in articulos if titulo(a) not in SALTAR]
    for a in articulos:
        cid = a["content_id"]
        acai = a.get("associations", {}).get("acai") or []
        tipo = acai[0]["type"] if acai else ""
        tipos[cid] = tipo
        texto = a_markdown(a["content"])
        # Enlaces a artículos que no están en español: solo el texto
        texto = re.sub(r"⟦d:(\d+)\|([^⟧]*)⟧", lambda m: m.group(0) if m.group(1) in ids else m.group(2), texto)
        write(out, f"diccionario-es/a/{cid}.json", {"t": titulo(a), "x": texto, "tipo": tipo})
        indice.append([cid, titulo(a), tipo])
        pasajes = a.get("associations", {}).get("passage") or []
        # Lo que el artículo cita primero es lo que más trata: «Getsemaní» antes que «Fruto del Espíritu» en Jn 3.
        orden = [m.group(1) for m in re.finditer(r"⟦([0-9a-z]{3}\.\d+\.\d+)", texto)]
        versos = set()
        for p in pasajes:
            r = aquifer_ref(p.get("start_ref"), p.get("end_ref"))
            if not r or r.count(".") < 2:
                continue
            a0, _, z0 = r.partition("-")
            b, c, v = a0.split(".")
            if z0:
                zb, zc, zv = z0.split(".")
                if zb != b or zc != c or int(zv) - int(v) > 12:
                    continue  # un pasaje largo no hace que el artículo hable de cada versículo
                versos.update((b, int(c), n) for n in range(int(v), int(zv) + 1))
            else:
                versos.add((b, int(c), int(v)))
        if tipo in SIN_CHIP or ", Libro de" in titulo(a) or titulo(a).startswith("Cronología"):
            continue  # los artículos de un libro entero o de la cronología citan casi todo
        for b, c, v in versos:
            key = f"{b}.{c}.{v}"
            pos = orden.index(key) / max(len(orden), 1) if key in orden else 1
            por_versiculo[(b, c, v)].append((round(pos + len(pasajes) / 400, 3), cid, titulo(a), tipo))
    indice.sort(key=lambda x: (re.sub(r"[^a-z0-9 ]", "", strip_accents(x[1]).lower()), x[1]))
    write(out, "diccionario-es/indice.json", indice)
    por_cap = defaultdict(dict)
    for (b, c, v), arts in por_versiculo.items():
        arts.sort()
        vistos, fila = set(), []
        for _, cid, t, tipo in arts:
            if t.lower() in vistos:
                continue  # «Expiación» tiene dos artículos: uno basta en el versículo
            vistos.add(t.lower())
            fila.append([cid, t, tipo])
            if len(fila) == POR_VERSICULO:
                break
        por_cap[(b, c)][str(v)] = fila
    for (b, c), versos in por_cap.items():
        write(out, f"diccionario-es/cap/{b}/{c}.json", versos)
    print(f"Diccionario bíblico Tyndale en español: {len(articulos)} artículos, {len(por_cap)} capítulos con artículos")


def strip_accents(s):
    import unicodedata
    return "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn")


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "public" / "data"
    build_lexicos(out)
    build_diccionario(out)


if __name__ == "__main__":
    main()
