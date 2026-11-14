# Imagen de la ronda de avisos para Cloud Run. El código ya viene empaquetado en dist/avisos.mjs (servidor/desplegar.sh
# corre esbuild antes), así que la imagen no instala nada.
FROM node:22-slim
WORKDIR /app
COPY dist/avisos.mjs ./avisos.mjs
ENV NODE_ENV=production AVISOS_ESCUCHAR=1
USER node
CMD ["node", "avisos.mjs"]
