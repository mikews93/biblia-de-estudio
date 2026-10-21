"""Importa un comentario con licencia que ya está en español (fuente «propia» en src/lib/comentarioFuentes.ts).

Uso:
  python3 pipeline/importar_comentario.py <fuente> <archivo o URL> [carpeta_salida]   (por defecto: comentarios-licencia)
  python3 pipeline/importar_comentario.py --entorno [carpeta_salida]

Con --entorno importa cada fuente propia que tenga la variable COMENTARIO_<ID>_URL (por ejemplo COMENTARIO_BDV_URL) y,
si hace falta, COMENTARIO_<ID>_TOKEN, que se envía como «Authorization: Bearer …». Así el texto con licencia no se
guarda en el repositorio: vive donde la licencia lo permita y el build de Vercel lo descarga. Sin variables no hace nada.

Entrada: JSON Lines (una nota por línea), en el orden del libro:
  {"libro": "jhn", "capitulo": 3, "desde": 16, "hasta": 16, "titulo": "", "texto": "…"}
- libro: el id de la app (pipeline/books.py). desde = 0 es la introducción del capítulo; hasta es opcional (= desde).
- texto: markdown sencillo, párrafos separados por una línea en blanco, **negritas**, *cursivas* y, si se quieren
  enlaces, referencias como ⟦jhn.3.16⟧ o ⟦rom.8.1-rom.8.4⟧.
Las notas del mismo pasaje (mismo libro, capítulo y desde) se juntan en una sección.

Salida: la misma que pipeline/build_comentarios.py: <fuente>/<libro>/<capítulo>.json.gz con una lista de secciones
  {"desde": 16, "hasta": 16, "titulo": "…", "partes": ["…"]}
que /api/comentario sirve tal cual, sin traducir. Va a comentarios-licencia/, fuera de la web publicada (dist/): el
texto solo sale por /api/comentario, sección a sección.
"""

import gzip
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

from books import BOOKS
from build_comentarios import split_parts

ROOT = Path(__file__).resolve().parent
FUENTES_TS = ROOT.parent / "src" / "lib" / "comentarioFuentes.ts"
IDS = {b[0] for b in BOOKS}


def propias():
    """Ids de las fuentes de tipo «propia» declaradas en la app."""
    src = FUENTES_TS.read_text(encoding="utf-8")
    return re.findall(r"id: '([a-z0-9]+)',(?:(?!\n  \}).)*?tipo: 'propia'", src, re.S)


def read(origen, token=None):
    if re.match(r"https?://", origen):
        req = urllib.request.Request(origen)
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        with urllib.request.urlopen(req, timeout=120) as res:
            raw = res.read()
    else:
        raw = Path(origen).read_bytes()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return raw.decode("utf-8")


def parse(text):
    """Notas agrupadas por (libro, capítulo) y luego por pasaje, con los errores encontrados."""
    chapters, errors = {}, []
    for n, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        try:
            nota = json.loads(line)
            libro, cap, desde = nota["libro"], int(nota["capitulo"]), int(nota["desde"])
            hasta = int(nota.get("hasta") or desde)
            texto = nota["texto"].strip()
        except (ValueError, KeyError, TypeError, AttributeError) as e:
            errors.append(f"línea {n}: {e}")
            continue
        if libro not in IDS or cap < 1 or desde < 0 or hasta < desde or not texto:
            errors.append(f"línea {n}: nota no válida ({libro} {cap}:{desde}-{hasta})")
            continue
        sections = chapters.setdefault((libro, cap), {})
        s = sections.setdefault(desde, {"desde": desde, "hasta": hasta, "titulo": "", "paras": []})
        s["hasta"] = max(s["hasta"], hasta)
        s["titulo"] = s["titulo"] or (nota.get("titulo") or "").strip()
        s["paras"] += [p.strip() for p in re.split(r"\n{2,}", texto) if p.strip()]
    return chapters, errors


def write(fuente, chapters, out):
    for (libro, cap), sections in chapters.items():
        result = [
            {"desde": s["desde"], "hasta": s["hasta"], "titulo": s["titulo"], "partes": split_parts(s["paras"])}
            for s in sorted(sections.values(), key=lambda s: s["desde"])
        ]
        path = out / fuente / libro / f"{cap}.json.gz"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(gzip.compress(json.dumps(result, ensure_ascii=False).encode("utf-8"), mtime=0))


def importar(fuente, origen, out, token=None):
    if fuente not in propias():
        sys.exit(f"«{fuente}» no es una fuente propia en {FUENTES_TS.name}")
    chapters, errors = parse(read(origen, token))
    for e in errors[:20]:
        print(f"  {e}", file=sys.stderr)
    if errors:
        sys.exit(f"{fuente}: {len(errors)} notas con errores; no se importó nada")
    write(fuente, chapters, out)
    notas = sum(len(s) for s in chapters.values())
    print(f"{fuente}: {notas} secciones en {len(chapters)} capítulos")


def main():
    args = sys.argv[1:]
    if args[:1] == ["--entorno"]:
        out = Path(args[1] if len(args) > 1 else "comentarios-licencia")
        for fuente in propias():
            url = os.environ.get(f"COMENTARIO_{fuente.upper()}_URL")
            if url:
                importar(fuente, url, out, os.environ.get(f"COMENTARIO_{fuente.upper()}_TOKEN"))
        return
    if len(args) < 2:
        sys.exit(__doc__)
    importar(args[0], args[1], Path(args[2] if len(args) > 2 else "comentarios-licencia"))


if __name__ == "__main__":
    main()
