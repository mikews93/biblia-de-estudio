#!/usr/bin/env bash
# Enseña cuánto cómputo gasta cada rama del proyecto de Neon y, con BORRAR=true, borra las «preview/*».
# Nunca borra la rama principal (default/primary), las protegidas ni las que se nombran en GUARDAR.
# Lo usa .github/workflows/neon-limpieza.yml. Necesita NEON_API_KEY y NEON_PROJECT_ID.
set -euo pipefail

if [ -z "${NEON_API_KEY:-}" ] || [ -z "${NEON_PROJECT_ID:-}" ]; then
  echo "::warning::Faltan NEON_API_KEY o NEON_PROJECT_ID."
  exit 0
fi
api="https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID"
auth=(-H "Authorization: Bearer $NEON_API_KEY" -H "Accept: application/json")

echo "== Proyecto =="
curl -sSf "${auth[@]}" "$api" | jq -r '.project | "periodo desde \(.consumption_period_start // "?")\ncómputo: \(((.compute_time_seconds // 0) / 3600 * 100 | round) / 100) CU-h · activo: \(((.active_time_seconds // 0) / 3600 * 10 | round) / 10) h\nescala a cero por defecto: \(.default_endpoint_settings.suspend_timeout_seconds // "?") s · CU \(.default_endpoint_settings.autoscaling_limit_min_cu // "?")-\(.default_endpoint_settings.autoscaling_limit_max_cu // "?")"'

echo
echo "== Computadoras (endpoints) =="
curl -sSf "${auth[@]}" "$api/endpoints" | jq -r '.endpoints[] | "\(.branch_id)  \(.current_state)  CU \(.autoscaling_limit_min_cu)-\(.autoscaling_limit_max_cu)  suspende tras \(.suspend_timeout_seconds) s  última actividad \(.last_active // "-")"'

ramas=$(curl -sSf "${auth[@]}" "$api/branches")
echo
echo "== Ramas (cómputo del periodo) =="
echo "$ramas" | jq -r '.branches | sort_by(-(.compute_time_seconds // 0))[] | "\(.name)  [\(.id)]  \(if (.default or .primary) then "PRINCIPAL " else "" end)\(if .protected then "PROTEGIDA " else "" end)creada \(.created_at[0:10])  cómputo \(((.compute_time_seconds // 0) / 3600 * 100 | round) / 100) CU-h  activo \(((.active_time_seconds // 0) / 3600 * 10 | round) / 10) h  tamaño \(((.logical_size // 0) / 1048576 | round)) MB"'

borrables=$(echo "$ramas" | jq -r --arg guardar " ${GUARDAR:-} " '.branches[]
  | select((.name | startswith("preview/")) and (.default | not) and (.primary | not) and (.protected | not))
  | select(($guardar | contains(" " + .name + " ")) | not)
  | "\(.id) \(.name)"')

echo
if [ -z "$borrables" ]; then
  echo "No hay ramas preview/* para borrar."
  exit 0
fi
echo "== Ramas preview/* que se borran ($(echo "$borrables" | wc -l)) =="
echo "$borrables"
if [ "${BORRAR:-false}" != "true" ]; then
  echo "(solo se enseñan: BORRAR no es true)"
  exit 0
fi
echo
while read -r id nombre; do
  # Neon no deja borrar una rama mientras otra operación está en curso: se reintenta un poco.
  for intento in 1 2 3 4 5; do
    if curl -sSf -X DELETE "${auth[@]}" "$api/branches/$id" > /dev/null; then
      echo "borrada $nombre ($id)"; break
    fi
    sleep $((intento * 3))
  done
done <<< "$borrables"
