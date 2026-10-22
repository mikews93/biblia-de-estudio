"""Páginas estáticas por capítulo para que Google pueda leer la Biblia sin ejecutar JavaScript.

Uso (después de `expo export`): python3 pipeline/seo_pages.py [dist] [https://biblia.migueblanco.com]

Escribe dist/<libro>/<capítulo>/index.html con el texto de la RV1909 dentro de #root (la app lo
reemplaza al cargar), título, descripción, URL canónica y enlaces al capítulo anterior y siguiente.
Añade sitemap.xml y robots.txt, y guarda la app vacía en app.html para las demás rutas. También escribe
precache.json: el código y las imágenes de la app, que src/lib/descargas.ts guarda para abrirla sin conexión.
"""

import html
import json
import re
import sys
import unicodedata
from pathlib import Path

from books import BOOKS

STYLE = """<style id="seo">
.seo{max-width:680px;margin:0 auto;padding:24px;font-family:Georgia,serif;color:#1F1B16;background:#FBF8F3;line-height:1.7}
.seo h1{font-size:28px;font-weight:normal}.seo sup{color:#8A4B2A;font-weight:700;font-size:.6em;margin-right:2px}
.seo nav a{color:#8A4B2A;margin-right:16px}.seo small{color:#6B6358}
</style>"""


def slug(name):
    n = unicodedata.normalize("NFD", name.lower())
    n = "".join(c for c in n if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", n).strip("-")


def page(shell, *, title, description, url, body):
    head = (
        f"<title>{html.escape(title)}</title>\n"
        f'    <meta name="description" content="{html.escape(description)}" />\n'
        f'    <link rel="canonical" href="{url}" />\n'
        f'    <meta property="og:title" content="{html.escape(title)}" />\n'
        f'    <meta property="og:description" content="{html.escape(description)}" />\n'
        f'    <meta property="og:url" content="{url}" />\n'
        f'    <meta property="og:type" content="article" />\n'
        f'    <meta property="og:locale" content="es_ES" />\n    {STYLE}'
    )
    out = re.sub(r"<title>.*?</title>", lambda _: head, shell, count=1, flags=re.S)
    return out.replace('<div id="root"></div>', f'<div id="root"><main class="seo">{body}</main></div>', 1)


def main():
    dist = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "dist"
    site = (sys.argv[2] if len(sys.argv) > 2 else "https://biblia.migueblanco.com").rstrip("/")
    shell = (dist / "index.html").read_text(encoding="utf-8")
    # La app sin contenido queda en app.html: vercel.json manda allí las rutas que no tienen página propia
    (dist / "app.html").write_text(shell, encoding="utf-8")
    data = dist / "data"
    books = json.loads((data / "books.json").read_text(encoding="utf-8"))
    order = [(b["id"], ch) for b in books for ch in range(1, b["chapters"] + 1)]
    names = {b[0]: b[1] for b in BOOKS}
    urls = [f"{site}/"]

    for i, (bid, ch) in enumerate(order):
        verses = json.loads((data / "text" / "rv1909" / bid / f"{ch}.json").read_text(encoding="utf-8"))
        name = names[bid]
        path = f"/{slug(name)}/{ch}"
        url = site + path
        urls.append(url)
        text = " ".join(f"<sup>{n}</sup>{html.escape(t)}" for n, t, *_ in verses)
        first = verses[0][1] if verses else ""
        links = []
        if i > 0:
            pb, pc = order[i - 1]
            links.append(f'<a href="/{slug(names[pb])}/{pc}">‹ {names[pb]} {pc}</a>')
        if i < len(order) - 1:
            nb, nc = order[i + 1]
            links.append(f'<a href="/{slug(names[nb])}/{nc}">{names[nb]} {nc} ›</a>')
        body = (
            f"<h1>{name} {ch}</h1><p>{text}</p><nav>{''.join(links)}</nav>"
            "<p><small>Reina-Valera 1909 · dominio público. Con griego, referencias cruzadas y estudio con IA en "
            "Biblia de estudio.</small></p>"
        )
        description = f"{name} {ch} (Reina-Valera 1909): {first[:130]}… Lee con griego, referencias y estudio."
        out = dist / path.lstrip("/") / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(
            page(shell, title=f"{name} {ch} · Biblia de estudio", description=description, url=url, body=body),
            encoding="utf-8",
        )

    root = page(
        shell,
        title="Biblia de estudio · Reina-Valera, griego y estudio con IA",
        description="Lee y estudia la Biblia en español: texto, griego del Nuevo Testamento, referencias cruzadas "
        "y un estudio con IA que cita sus fuentes. Gratis.",
        url=f"{site}/",
        body="<h1>Biblia de estudio</h1><nav>"
        + "".join(f'<a href="/{slug(b[1])}/1">{b[1]}</a> ' for b in BOOKS)
        + "</nav>",
    )
    (dist / "index.html").write_text(root, encoding="utf-8")

    sitemap = "".join(f"<url><loc>{u}</loc></url>" for u in urls)
    (dist / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{sitemap}</urlset>',
        encoding="utf-8",
    )
    (dist / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: {site}/sitemap.xml\n", encoding="utf-8")
    shell_files = sorted("/" + p.relative_to(dist).as_posix() for d in ("_expo", "assets", "ninos") for p in (dist / d).rglob("*") if p.is_file())
    (dist / "precache.json").write_text(json.dumps(shell_files), encoding="utf-8")
    print(f"{len(order)} capítulos con página propia en {dist}")


if __name__ == "__main__":
    main()
