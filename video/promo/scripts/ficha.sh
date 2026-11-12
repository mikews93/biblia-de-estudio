#!/usr/bin/env bash
# Las 8 capturas de la ficha de Google Play: bash scripts/ficha.sh [carpeta]  (por defecto ../../tiendas/google-play)
set -euo pipefail
cd "$(dirname "$0")/.."
out=${1:-../../tiendas/google-play}
nombres=(1-hoy 2-pregunta 3-original 4-podcast 5-dramatizado 6-preparar 7-en-vivo 8-linea-de-tiempo)
for i in "${!nombres[@]}"; do
  bunx remotion still src/index.ts "ficha-$((i + 1))" "$out/${nombres[$i]}.png" --frame=0 --log=error
done
