#!/bin/sh
# Copia los vectores semánticos de la versión «semantica-vectores-v1» del repositorio a public/data/semantica/ (de ahí
# pasan a dist/data/semantica/, que lee api/_semantica.ts). Los calcula la acción «Vectores semánticos». Si no se pueden
# descargar, la búsqueda rápida queda solo por palabras: no detiene la construcción.
set -u
BASE="https://github.com/mikews93/biblia-de-estudio/releases/download/semantica-vectores-v1"
DIR="public/data/semantica"
mkdir -p "$DIR"
for f in meta.json vectores.i8 escalas.f32; do
  if ! curl -sfL --retry 3 -o "$DIR/$f.tmp" "$BASE/$f"; then
    echo "Aviso: no se pudieron traer los vectores semánticos ($f); la búsqueda rápida será solo por palabras."
    rm -f "$DIR"/*.tmp
    exit 0
  fi
done
for f in meta.json vectores.i8 escalas.f32; do mv "$DIR/$f.tmp" "$DIR/$f"; done
echo "Vectores semánticos: $(du -sh "$DIR" | cut -f1)"
