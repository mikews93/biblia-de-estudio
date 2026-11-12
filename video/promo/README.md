# Video promocional de Zarza

El video de la app como código, con Remotion, igual que el demo de DeusRex (`deusrex/video/demo`), del que
salen el movimiento (`src/motion.ts`), la voz con sincronía real (`scripts/vo.ts`) y la exportación
(`scripts/export.ts`). `src/film/Film.tsx` tiene toda la línea de tiempo (~47 s):

gancho con la llama → Hoy → lector e interlineal (Juan 3:16, «amó») → Pregúntale a la Biblia → pódcast y
lectura en griego → estudio en grupo en vivo → cierre con la llama, «Arde y no se consume», Google Play.

Las pantallas son **capturas reales** de la app en oscuro (`scripts/capturas.mjs`), dentro de un teléfono
animado, con un toque ámbar antes de cada cambio.

## Cortes

- `Promo16x9` (1920×1080): YouTube y la ficha de Google Play. Sin subtítulos quemados: YouTube lleva
  `zarza-promo.es.vtt`.
- `Reel9x16` (1080×1920): Reels, Shorts e Historias, con subtítulos quemados palabra por palabra.

## Cómo se hace

```bash
# 1. Capturas: la web de la app con la IA simulada (desde la raíz del repo)
npm run data && npm run comentarios && npm run build:web
npx tsx e2e/support/server.ts &
node video/promo/scripts/capturas.mjs            # → video/promo/public/capturas/

# 2. Voz y música: las graba la acción «Video promocional (voz y música)» al cambiar script.json
#    (api.elevenlabs.io no se alcanza desde los contenedores). Se bajan de la versión «video-promo»:
cd video/promo && mkdir -p public/vo public/music
for n in hook hoy original preguntar escuchar grupo cta; do for e in mp3 align.json; do
  curl -sL -o public/vo/$n.$e https://github.com/mikews93/biblia-de-estudio/releases/download/video-promo/vo-$n.$e; done; done
curl -sL -o public/music/zarza-promo.mp3 https://github.com/mikews93/biblia-de-estudio/releases/download/video-promo/zarza-promo.mp3

# 3. Ver y exportar
bun install
bun run studio
bun scripts/export.ts                            # → out/release/
```

## Voz, música y volumen

- Frases en `script.json`: Abel (voz de la biblioteca de ElevenLabs `452WrNT9o8dphaYW5YGU`, el narrador
  del audio dramatizado) en `eleven_v4`. `at` es el segundo en que empieza cada frase. Las `[etiquetas]`
  son indicaciones de entonación: nunca salen en los subtítulos.
- La sincronía de cada palabra (`src/vo-timing.json`, en git) es la alineación real de ElevenLabs: la usan
  los subtítulos, la entrada del gancho y la música, que baja bajo la voz.
- Música: una pieza instrumental de 47 s compuesta con Eleven Music para este corte (`scripts/musica.ts`).
  Si falta, suena el pad de piano de la app (`public/audio/ambiente/piano.mp3` copiado a `public/music/piano.mp3`).
- La exportación nivela cada corte a −16 LUFS integrados / −1,5 dBTP.

## Reglas

- Solo datos inventados en pantalla (la cuenta de las capturas es «Ana»).
- Nada con licencia en git: audios, capturas y videos quedan fuera (`.gitignore`). Las letras (Fraunces e
  Inter, OFL) sí van en `public/fonts/` para que el render no dependa de la red.
