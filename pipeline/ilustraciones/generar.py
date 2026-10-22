"""Genera las ilustraciones del Espacio Niños con los modelos de imagen de Cloudflare AI Gateway (como en deusrex).

Para cada escena de escenas.json y cada modelo de MODELOS deja una candidata en candidatas/<escena>-<modelo>.webp.
Las que ya existen no se vuelven a pedir: solo se paga lo nuevo. Después se elige una por escena y se copia a
public/ninos/<escena>.webp (la app usa el dibujo en SVG mientras no exista).

Necesita CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_AI_API_TOKEN. Uso: python3 generar.py [escena ...]
"""
import base64
import io
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

AQUI = Path(__file__).parent
SALIDA = AQUI / 'candidatas'
CUENTA = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '')
TOKEN = os.environ.get('CLOUDFLARE_AI_API_TOKEN', '')

# Cada modelo pide el encuadre a su manera; un campo que no conoce es un error, no una pista.
MODELOS = {
    'nano': ('google/nano-banana-2', {'aspect_ratio': '3:2'}),
    'flux': ('black-forest-labs/flux-2-pro-preview', {'width': 1536, 'height': 1024}),
}
ANCHO = 1280


def medio(payload: bytes, content_type: str) -> bytes:
    """El gateway devuelve la imagen tal cual o envuelta en JSON (a veces dos veces), en base64 o como URL."""
    if 'json' not in content_type:
        return payload
    data = json.loads(payload)
    if data.get('success') is False:
        raise RuntimeError(f'Cloudflare: {data.get("errors")}')

    def buscar(nodo):
        if isinstance(nodo, dict):
            for v in nodo.values():
                if (x := buscar(v)) is not None:
                    return x
        elif isinstance(nodo, list):
            for v in nodo:
                if (x := buscar(v)) is not None:
                    return x
        elif isinstance(nodo, str) and nodo.startswith('http'):
            with urllib.request.urlopen(nodo, timeout=120) as res:
                return res.read()
        elif isinstance(nodo, str) and len(nodo) > 200:
            return base64.b64decode(nodo.split(',', 1)[-1])
        return None

    out = buscar(data)
    if out is None:
        raise RuntimeError(f'Cloudflare no devolvió imagen: {str(data)[:300]}')
    return out


def pedir(modelo: str, prompt: str, encuadre: dict) -> bytes:
    body = {'model': modelo, 'input': {'prompt': prompt, **encuadre}}
    req = urllib.request.Request(
        f'https://api.cloudflare.com/client/v4/accounts/{CUENTA}/ai/run',
        data=json.dumps(body).encode(),
        method='POST',
        headers={
            'Authorization': f'Bearer {TOKEN}',
            'Content-Type': 'application/json',
            'cf-aig-gateway-id': 'default',
            'cf-aig-collect-log': 'false',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as res:
            return medio(res.read(), res.headers.get('content-type', ''))
    except urllib.error.HTTPError as err:
        raise RuntimeError(f'{modelo} → {err.code}: {err.read().decode(errors="replace")[:500]}') from None


def webp(datos: bytes, destino: Path):
    img = Image.open(io.BytesIO(datos)).convert('RGB')
    if img.width > ANCHO:
        img = img.resize((ANCHO, round(img.height * ANCHO / img.width)), Image.LANCZOS)
    img.save(destino, 'WEBP', quality=80, method=6)


def main():
    if not CUENTA or not TOKEN:
        sys.exit('Faltan CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_AI_API_TOKEN')
    cfg = json.loads((AQUI / 'escenas.json').read_text())
    elegidas = sys.argv[1:] or list(cfg['escenas'])
    SALIDA.mkdir(exist_ok=True)
    fallos = 0
    for escena in elegidas:
        prompt = f'{cfg["estilo"]}\n\nScene: {cfg["escenas"][escena]}'
        for nombre, (modelo, encuadre) in MODELOS.items():
            destino = SALIDA / f'{escena}-{nombre}.webp'
            if destino.exists():
                continue
            try:
                webp(pedir(modelo, prompt, encuadre), destino)
                print(f'✓ {destino.name} ({destino.stat().st_size // 1024} KB)', flush=True)
            except Exception as err:  # una escena que falla no detiene las demás
                fallos += 1
                print(f'::warning::{escena} con {nombre}: {err}', flush=True)
    if fallos:
        print(f'{fallos} imágenes no se generaron')


if __name__ == '__main__':
    main()
