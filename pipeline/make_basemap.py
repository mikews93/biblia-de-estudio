"""Genera pipeline/geo/basemap.json, el mapa de fondo (tierra, mares interiores y ríos) de los mapas bíblicos.

Uso: python3 pipeline/make_basemap.py   (solo hace falta volver a ejecutarlo si cambia la región o el detalle)

Fuentes:
- Costas: Natural Earth 1:10m (dominio público), vía el paquete npm world-atlas
- Ríos y lagos (Jordán, mar de Galilea, mar Muerto, Nilo, Éufrates, Tigris): OpenBible.info Bible Geocoding Data,
  con geometrías de OpenStreetMap (© colaboradores de OpenStreetMap, ODbL)
"""

import io
import json
import sys
import tarfile
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent / "geo" / "basemap.json"
WORLD_ATLAS = "https://registry.npmjs.org/world-atlas/-/world-atlas-2.0.2.tgz"
GEO = "https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/7eb18a5ee62f27b9b93bd6689ea272d76dd23b8f/geometry/"
# De Tarsis (España) a Persia, y de Grecia al sur de Egipto
BBOX = (-12.0, 8.0, 65.0, 50.0)
WATER = {
    "Mar de Galilea": "gdea47d.simplified.geojson",
    "Mar Muerto": "abed304.geojson",
}
RIVERS = {
    "Jordán": "ga8da80.simplified.geojson",
    "Nilo": "gbd7010.simplified.geojson",
    "Éufrates": "g8bbbc3.simplified.geojson",
    "Tigris": "gb238a8.simplified.geojson",
}


def get(url):
    with urllib.request.urlopen(url) as r:
        return r.read()


def topo_land():
    with tarfile.open(fileobj=io.BytesIO(get(WORLD_ATLAS))) as tar:
        topo = json.load(tar.extractfile("package/land-10m.json"))
    (sx, sy), (tx, ty) = topo["transform"]["scale"], topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)

    def ring(ids):
        pts = []
        for i in ids:
            a = arcs[i] if i >= 0 else arcs[~i][::-1]
            pts.extend(a if not pts else a[1:])
        return pts

    polys = []
    for geom in topo["objects"]["land"]["geometries"]:
        shapes = geom["arcs"] if geom["type"] == "MultiPolygon" else [geom["arcs"]]
        for shape in shapes:
            polys.extend(ring(r) for r in shape)
    return polys


def clip(ring, bbox):
    """Sutherland-Hodgman contra el rectángulo de la región."""
    x0, y0, x1, y1 = bbox
    edges = [
        (lambda p: p[0] >= x0, lambda a, b: (x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0]))),
        (lambda p: p[0] <= x1, lambda a, b: (x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0]))),
        (lambda p: p[1] >= y0, lambda a, b: (a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0)),
        (lambda p: p[1] <= y1, lambda a, b: (a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1)),
    ]
    for inside, cross in edges:
        if not ring:
            break
        out = []
        prev = ring[-1]
        for p in ring:
            if inside(p):
                if not inside(prev):
                    out.append(cross(prev, p))
                out.append(p)
            elif inside(prev):
                out.append(cross(prev, p))
            prev = p
        ring = out
    return ring


def simplify(pts, tol):
    """Douglas-Peucker."""
    if len(pts) < 3:
        return pts
    (ax, ay), (bx, by) = pts[0], pts[-1]
    dx, dy = bx - ax, by - ay
    norm = (dx * dx + dy * dy) ** 0.5 or 1e-12
    far, idx = 0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = abs(dy * px - dx * py + bx * ay - by * ax) / norm if (dx or dy) else ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
        if d > far:
            far, idx = d, i
    if far <= tol:
        return [pts[0], pts[-1]]
    return simplify(pts[: idx + 1], tol)[:-1] + simplify(pts[idx:], tol)


def rnd(pts):
    return [[round(x, 3), round(y, 3)] for x, y in pts]


def lines(geojson, polygons):
    feats = geojson["features"] if geojson["type"] == "FeatureCollection" else [geojson]
    out = []
    for f in feats:
        g = f.get("geometry", f)
        if polygons and g["type"] in ("Polygon", "MultiPolygon"):
            for poly in g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]:
                out.append(poly[0])
        elif not polygons and g["type"] in ("LineString", "MultiLineString"):
            out.extend(g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]])
    return out


def main():
    sys.setrecursionlimit(100000)
    land = []
    for ring in topo_land():
        xs, ys = [p[0] for p in ring], [p[1] for p in ring]
        if max(xs) < BBOX[0] or min(xs) > BBOX[2] or max(ys) < BBOX[1] or min(ys) > BBOX[3]:
            continue
        r = simplify(clip(ring, BBOX), 0.01)
        if len(r) >= 4:
            land.append(rnd(r))
    water = []
    for name, f in WATER.items():
        for ring in lines(json.loads(get(GEO + f)), True):
            water.append({"name": name, "points": rnd(simplify(ring, 0.004))})
    rivers = []
    for name, f in RIVERS.items():
        for line in lines(json.loads(get(GEO + f)), False):
            pts = simplify(line, 0.01)
            if len(pts) >= 2:
                rivers.append({"name": name, "points": rnd(pts)})
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(
        json.dumps({"bbox": BBOX, "land": land, "water": water, "rivers": rivers}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Listo: {OUT} ({OUT.stat().st_size // 1024} KB, {len(land)} costas, {len(water)} lagos, {len(rivers)} ríos)")


if __name__ == "__main__":
    main()
