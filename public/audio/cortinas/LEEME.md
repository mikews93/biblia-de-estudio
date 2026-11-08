# Cortinas del audio dramatizado

Música de entrada, de paso entre escenas y de cierre de los capítulos dramatizados a pedido (api/dramatizado.ts),
una por tono: `<tono>-entrada.mp3`, `<tono>-paso.mp3` y `<tono>-cierre.mp3`, con tono paz, esperanza, tension,
duelo o gloria. Las compone Eleven Music con pipeline/audio_dramatizado/cortinas.mjs (acción «Cortinas del
dramatizado») y solo entran aquí las que Mike aprueba. Si falta una, ese momento suena sin música.
