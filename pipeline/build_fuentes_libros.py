"""Obras de dominio público de los módulos SWORD de CrossWire: el Treasury of Scripture Knowledge (referencias
cruzadas), la International Standard Bible Encyclopedia (1915) y el Torrey's New Topical Textbook.

Uso: python3 pipeline/build_fuentes_libros.py [carpeta_salida]   (por defecto: public/data)

Los módulos están en la versión «fuentes-libros-v1» del repositorio (pipeline/fuentes_libros.txt y
.github/workflows/fuentes-libros.yml), porque crosswire.org no siempre responde desde el despliegue.

Salida:
  tsk/<libro>/<c>.json   {versículo: ["job.26.7", "isa.40.12-isa.40.14", ...]}: las referencias del Treasury, en su
                         orden. El lector enseña las que no están ya entre las de OpenBible.
  isbe/indice.json       [[título, n.º de archivo]] de los artículos de la ISBE; isbe/<n>.json {título: texto}
  torrey/indice.json     igual para los temas de Torrey; torrey/<n>.json {tema: texto}
El texto de la ISBE y de Torrey va en inglés: solo lo lee la IA (api/_diccionario.ts), que lo explica en español.
"""

import html
import json
import re
import struct
import sys
import urllib.request
import zipfile
import zlib
from collections import defaultdict
from pathlib import Path

from books import BOOKS

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / ".cache" / "fuentes-libros"
RELEASE = "https://github.com/mikews93/biblia-de-estudio/releases/download/fuentes-libros-v1/"
KJV = "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/KJV.json"
IDS = [b[0] for b in BOOKS]
# Artículos por archivo de la ISBE y de Torrey: la IA lee uno o dos artículos y así no se baja la obra entera.
POR_ARCHIVO = 60

# Abreviaturas del Treasury → id del libro
TSK_LIBROS = dict(zip(
    "Ge Ex Le Nu De Jos Jud Ru 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Ne Es Job Ps Pr Ec So Isa Jer La Eze Da Ho Joe Am Ob Jon "
    "Mic Na Hab Zep Hag Zec Mal Mt Mr Lu Joh Ac Ro 1Co 2Co Ga Eph Php Col 1Th 2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe "
    "1Jo 2Jo 3Jo Jude Re".split(), IDS))


def fetch(name, url=None):
    path = CACHE / name
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"Descargando {name}…")
        path.write_bytes(urllib.request.urlopen(url or RELEASE + name, timeout=300).read())
    return path


def write(out, rel, data):
    path = out / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def modulo(nombre):
    """Los archivos de un módulo SWORD: {«ot.bzv»: bytes, …}."""
    with zipfile.ZipFile(fetch(f"{nombre}.zip")) as z:
        return {Path(n).name: z.read(n) for n in z.namelist() if n.startswith("modules/") and not n.endswith("/")}


# ------------------------------------------------------------------------------------------------- Treasury (zCom)

def zcom(files, t):
    """Las entradas de un testamento de un comentario zCom, en el orden del índice (con las de encabezado)."""
    bzs, bzv, bzz = files[f"{t}.bzs"], files[f"{t}.bzv"], files[f"{t}.bzz"]
    bloques = [struct.unpack("<III", bzs[i:i + 12]) for i in range(0, len(bzs), 12)]
    cache = {}

    def bloque(n):
        if n not in cache:
            o, s, _ = bloques[n]
            cache[n] = zlib.decompress(bzz[o:o + s])
        return cache[n]

    out = []
    for i in range(0, len(bzv), 10):
        b, o, s = struct.unpack("<IIH", bzv[i:i + 10])
        out.append(bloque(b)[o:o + s].decode("utf-8", "replace") if s else "")
    return out


def tsk_refs(texto, libro, cap):
    """«Job 26:7; Isa 45:18; Ps 33:6,9; 104:30; 10,12» → ["job.26.7", "isa.45.18", "psa.33.6", …]. Sin libro ni
    capítulo, los números son versículos del mismo capítulo."""
    refs = []
    for grupo in re.findall(r"<scripRef[^>]*>([^<]*)</scripRef>", texto):
        b, c = libro, cap
        for parte in re.split(r";\s*", grupo):
            parte = parte.strip().rstrip(".")
            m = re.match(r"((?:[123] ?)?[A-Z][a-z]+)\s+(.*)", parte)
            if m:
                ab = m[1].replace(" ", "")
                if ab not in TSK_LIBROS:
                    break
                b, parte = TSK_LIBROS[ab], m[2]
            if ":" in parte:
                c_txt, parte = parte.split(":", 1)
                if not c_txt.isdigit():
                    continue
                c = int(c_txt)
            elif m:
                continue  # un capítulo entero («Ps 23»): no es un versículo
            for v in parte.split(","):
                r = re.fullmatch(r"\s*(\d+)(?:-(\d+))?\s*", v)
                if not r:
                    continue
                ini, fin = int(r[1]), int(r[2] or 0)
                refs.append(f"{b}.{c}.{ini}" + (f"-{b}.{c}.{fin}" if fin > ini else ""))
    return refs


def build_tsk(out):
    kjv = json.loads(fetch("KJV.json", KJV).read_text(encoding="utf-8"))
    capitulos = [[len(c["verses"]) for c in b["chapters"]] for b in kjv["books"]]
    files = modulo("TSK")
    por_cap = defaultdict(dict)
    total = 0
    for t, libros in (("ot", range(39)), ("nt", range(39, 66))):
        entradas = zcom(files, t)
        i = 2  # 0: el módulo, 1: el testamento
        for bi in libros:
            i += 1  # el libro
            for ci, versos in enumerate(capitulos[bi], 1):
                i += 1  # el capítulo
                for v in range(1, versos + 1):
                    propio = f"{IDS[bi]}.{ci}.{v}"
                    vistos, refs = {propio}, []
                    for r in tsk_refs(entradas[i], IDS[bi], ci):
                        if r not in vistos and r.split("-")[0] != propio:
                            vistos.add(r)
                            refs.append(r)
                    if refs:
                        por_cap[(IDS[bi], ci)][str(v)] = refs
                        total += len(refs)
                    i += 1
        assert i == len(entradas), f"{t}: el índice no cuadra con la versificación KJV ({i} ≠ {len(entradas)})"
    for (b, c), versos in por_cap.items():
        write(out, f"tsk/{b}/{c}.json", versos)
    print(f"Treasury: {total} referencias en {len(por_cap)} capítulos")


# ------------------------------------------------------------------------------------------------- ISBE y Torrey (LD)

def raw_ld(files, nombre):
    idx, dat = files[f"{nombre}.idx"], files[f"{nombre}.dat"]
    for i in range(0, len(idx), 6):  # RawLD: posición de 4 bytes y tamaño de 2
        o, s = struct.unpack("<IH", idx[i:i + 6])
        clave, _, texto = dat[o:o + s].partition(b"\n")
        yield clave.decode("utf-8", "replace").strip(), texto.decode("utf-8", "replace")


def z_ld(files, nombre):
    idx, dat, zdx, zdt = files[f"{nombre}.idx"], files[f"{nombre}.dat"], files[f"{nombre}.zdx"], files[f"{nombre}.zdt"]
    cache = {}

    def bloque(n):
        if n not in cache:
            o, s = struct.unpack("<II", zdx[n * 8:n * 8 + 8])
            data = zlib.decompress(zdt[o:o + s])
            cuantos = struct.unpack("<I", data[:4])[0]
            cache[n] = [struct.unpack("<II", data[4 + k * 8:12 + k * 8]) for k in range(cuantos)], data
        return cache[n]

    for i in range(0, len(idx), 8):
        o, s = struct.unpack("<II", idx[i:i + 8])
        clave, _, ptr = dat[o:o + s].partition(b"\n")
        if len(ptr) < 8:
            continue
        b, e = struct.unpack("<II", ptr[:8])
        entradas, data = bloque(b)
        eo, es = entradas[e]
        yield clave.decode("utf-8", "replace").strip(), data[eo:eo + es].decode("utf-8", "replace").rstrip("\0")


def a_texto(t):
    """ThML o TEI → texto llano, con los párrafos separados por una línea en blanco."""
    t = re.sub(r"<(br|p|/p|lb|div|/div|item|/item)\b[^>]*>", "\n", t, flags=re.I)
    t = html.unescape(re.sub(r"<[^>]+>", "", t))
    lineas = [re.sub(r"[ \t]+", " ", x).strip() for x in t.split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lineas)).strip()


def build_ld(out, carpeta, entradas):
    indice, archivo, n = [], {}, 0
    for clave, texto in entradas:
        texto = a_texto(texto)
        if not clave or len(texto) < 40 or clave.startswith("@"):
            continue
        titulo = clave.title() if clave.isupper() else clave
        indice.append([titulo, n])
        archivo[titulo] = texto
        if len(archivo) == POR_ARCHIVO:
            write(out, f"{carpeta}/{n}.json", archivo)
            archivo, n = {}, n + 1
    if archivo:
        write(out, f"{carpeta}/{n}.json", archivo)
    write(out, f"{carpeta}/indice.json", indice)
    print(f"{carpeta}: {len(indice)} artículos")


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "public" / "data"
    build_tsk(out)
    build_ld(out, "isbe", z_ld(modulo("ISBE"), "isbe"))
    build_ld(out, "torrey", raw_ld(modulo("Torrey"), "torrey"))


if __name__ == "__main__":
    main()
