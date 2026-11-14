#!/bin/sh
# Despliega la ronda de avisos de Zarza en Cloud Run y la programa cada minuto con Cloud Scheduler.
# Uso: PROYECTO=<id del proyecto de GCP de Zarza> sh servidor/desplegar.sh
# La primera vez crea el secreto con la base, la cuenta de servicio del programador y la tarea. Después solo
# vuelve a subir el código. Ver servidor/README.md.
set -eu
: "${PROYECTO:?Falta PROYECTO (id del proyecto de Google Cloud de Zarza)}"
REGION="${REGION:-us-east4}"
SERVICIO=zarza-avisos
PROGRAMADOR="zarza-avisos-programador@${PROYECTO}.iam.gserviceaccount.com"
cd "$(dirname "$0")/.."

npx esbuild servidor/avisos.ts --bundle --platform=node --target=node22 --format=esm \
  --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" \
  --outfile=servidor/dist/avisos.mjs

gcloud services enable run.googleapis.com cloudscheduler.googleapis.com secretmanager.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com --project "$PROYECTO"

# La base de Zarza (Neon). Se toma de DATABASE_URL del entorno la primera vez; nunca queda en el repo.
if ! gcloud secrets describe zarza-database-url --project "$PROYECTO" >/dev/null 2>&1; then
  : "${DATABASE_URL:?La primera vez hace falta DATABASE_URL (la de producción de Zarza en Vercel)}"
  printf %s "$DATABASE_URL" | gcloud secrets create zarza-database-url --data-file=- --project "$PROYECTO"
fi

# Una sola instancia: la ronda ya evita repetirse en la base, y así la agenda en memoria (que deja dormir a Neon) vale.
gcloud run deploy "$SERVICIO" --source servidor --region "$REGION" --project "$PROYECTO" \
  --no-allow-unauthenticated --max-instances 1 --min-instances 0 --cpu 1 --memory 256Mi --timeout 60 \
  --set-secrets DATABASE_URL=zarza-database-url:latest --quiet

URL=$(gcloud run services describe "$SERVICIO" --region "$REGION" --project "$PROYECTO" --format 'value(status.url)')

if ! gcloud iam service-accounts describe "$PROGRAMADOR" --project "$PROYECTO" >/dev/null 2>&1; then
  gcloud iam service-accounts create zarza-avisos-programador --display-name "Programador de avisos de Zarza" --project "$PROYECTO"
fi
gcloud run services add-iam-policy-binding "$SERVICIO" --region "$REGION" --project "$PROYECTO" \
  --member "serviceAccount:$PROGRAMADOR" --role roles/run.invoker --quiet >/dev/null

if gcloud scheduler jobs describe zarza-avisos --location "$REGION" --project "$PROYECTO" >/dev/null 2>&1; then
  ACCION=update
else
  ACCION=create
fi
gcloud scheduler jobs "$ACCION" http zarza-avisos --location "$REGION" --project "$PROYECTO" \
  --schedule '* * * * *' --time-zone UTC --uri "$URL/" --http-method POST \
  --oidc-service-account-email "$PROGRAMADOR" --oidc-token-audience "$URL" --attempt-deadline 60s

echo "Listo: $URL, llamado cada minuto por Cloud Scheduler (zarza-avisos)."
echo "Falta apagar la tarea de cron-job.org que llama a /api/notificaciones?accion=enviar en Vercel."
