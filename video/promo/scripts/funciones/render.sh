#!/usr/bin/env bash
# Renderiza un video de función y lo deja listo para redes: bash scripts/funciones/render.sh <id> [carpeta]
# Necesita public/vo/funciones/<id>/ (de la versión «video-promo») y public/capturas/funciones/<id>/.
set -euo pipefail
cd "$(dirname "$0")/../.."
id=$1; out=${2:-out-funciones}
mkdir -p "$out"
bunx remotion render src/index.ts "fn-$id" "$out/$id-master.mp4" --log=error --concurrency=4
ffmpeg -y -hide_banner -loglevel error -i "$out/$id-master.mp4" -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p \
  -af loudnorm=I=-16:TP=-1.5 -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$out/zarza-$id.mp4"
rm "$out/$id-master.mp4"
echo "$out/zarza-$id.mp4"
