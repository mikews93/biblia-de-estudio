# Instrucciones para el proyecto de Rvela: publicar y programar carruseles desde el conector

Pedido de Mike (2026-11-19). Repo mikews93/editor-ia. Sigue CLAUDE.md: rama `feat/…` desde `dev`, PR a `dev`, `bun run ci` antes del PR, `bun run schema` si cambia el esquema, sin nombres de proveedores a la vista.

## Contexto
El conector (MCP) y /v1 de Rvela solo publican y programan videos: `publish_video` es solo para reels y `plan_campaign` solo acepta videos. Los carruseles NO están en el repo de Rvela: los diseña el proyecto Biblia (HTML + Playwright, en `marketing/carruseles/` del repo mikews93/biblia-de-estudio) y Rvela solo tiene que publicarlos y programarlos. Zarza (marca `brd_03615ca019414aa1ae51`, con Facebook, Instagram y TikTok conectados) quiere programar carruseles de imágenes ya diseñadas (PNG de 1080 × 1350, 4:5, de 7 a 10 láminas) junto con sus videos.

## Lo que hace falta
1. **`publish_carousel` en el MCP** (y su ruta en /v1): `account_id`, `brand_id`, `images` (de 2 a 10 URLs https, en orden), `caption`, `scheduled_at` opcional (ISO 8601 con zona) y `confirm`. Que funcione igual que `publish_video`: sin `confirm` devuelve lo que saldría (red, cuenta, hora, número de láminas y texto) y solo publica con `confirm=true`. Rvela trae las imágenes tal cual, sin recortarlas ni ponerles marca.
   - Instagram: carrusel del feed (contenedores de imagen y luego el contenedor CAROUSEL). Facebook: publicación con varias fotos. TikTok: publicación de fotos, si la cuenta lo permite. Si una red no acepta carruseles, decirlo en la vista previa y no fallar a medias.
   - Validar antes de programar: proporción (4:5, 1:1 o 1.91:1, todas iguales), peso y número de láminas.
2. **Campañas con carruseles**: en `plan_campaign` (cuando cada publicación trae `at` y `caption`), aceptar `{images: [...]}` además de `{job_id}` o `{video_url}`, para mezclar videos y carruseles en el mismo calendario. Lo mismo en `assign_campaign_video`, o una `assign_campaign_carousel`.
3. **`list_posts` y `get_post_stats`** deben mostrar los carruseles con su tipo y sus números (alcance, guardados, compartidos), que son los que importan en un carrusel.
4. Si Rvela ya hace o guarda carruseles en su pantalla, exponer también `list_carousels`. Si no, no hace falta diseñarlos: basta con publicar imágenes ya hechas.

## Para probar
Dos carruseles reales de Zarza (JPG 1080 × 1350; Instagram solo acepta JPEG por API), con URLs https públicas listas para usar como `images`, en este orden. El texto de cada publicación está en `texto.txt` de su carpeta.

- Carrusel 1, «Juan 3:16» (7 láminas). Texto: lo pasa Mike
  - https://raw.githubusercontent.com/mikews93/biblia-de-estudio/claude/project-thread-ghqrgd/marketing/carruseles/01-juan-3-16/01.jpg
  - https://raw.githubusercontent.com/mikews93/biblia-de-estudio/claude/project-thread-ghqrgd/marketing/carruseles/01-juan-3-16/02.jpg
  - https://raw.githubusercontent.com/mikews93/biblia-de-estudio/claude/project-thread-ghqrgd/marketing/carruseles/01-juan-3-16/03.jpg
  - https://raw.githubusercontent.com/mikews93/biblia-de-estudio/claude/project-thread-ghqrgd/marketing/carruseles/01-juan-3-16/04.jpg
  - https://raw.githubusercontent.com/mikews93/biblia-de-estudio/claude/project-thread-ghqrgd/marketing/carruseles/01-juan-3-16/05.jpg
  - https://raw.githubusercontent.com/mikews93/biblia-de-estudio/claude/project-thread-ghqrgd/marketing/carruseles/01-juan-3-16/06.jpg
  - https://raw.githubusercontent.com/mikews93/biblia-de-estudio/claude/project-thread-ghqrgd/marketing/carruseles/01-juan-3-16/07.jpg
- Carrusel 2, «6 funciones» (8 láminas). Texto: lo pasa Mike
  - https://raw.githubusercontent.com/mikews93/biblia-de-estudio/claude/project-thread-ghqrgd/marketing/carruseles/02-funciones/01.jpg
  - https://raw.githubusercontent.com/mikews93/biblia-de-estudio/claude/project-thread-ghqrgd/marketing/carruseles/02-funciones/02.jpg
  - https://raw.githubusercontent.com/mikews93/biblia-de-estudio/claude/project-thread-ghqrgd/marketing/carruseles/02-funciones/03.jpg
  - https://raw.githubusercontent.com/mikews93/biblia-de-estudio/claude/project-thread-ghqrgd/marketing/carruseles/02-funciones/04.jpg
  - https://raw.githubusercontent.com/mikews93/biblia-de-estudio/claude/project-thread-ghqrgd/marketing/carruseles/02-funciones/05.jpg
  - https://raw.githubusercontent.com/mikews93/biblia-de-estudio/claude/project-thread-ghqrgd/marketing/carruseles/02-funciones/06.jpg
  - https://raw.githubusercontent.com/mikews93/biblia-de-estudio/claude/project-thread-ghqrgd/marketing/carruseles/02-funciones/07.jpg
  - https://raw.githubusercontent.com/mikews93/biblia-de-estudio/claude/project-thread-ghqrgd/marketing/carruseles/02-funciones/08.jpg

Fechas que Mike quiere (hora de Bogotá, Instagram y Facebook de Zarza): carrusel 1 el martes 24 de noviembre de 2026 a las 11 a. m.; carrusel 2 el viernes 27 de noviembre a las 11 a. m. Probar primero sin `confirm`. Nunca publicar de inmediato sin el OK de Mike.
