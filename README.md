# Biblia de estudio

App para estudiar la Biblia a fondo con la sencillez de La Biblia App: texto, interlineal en el idioma original, referencias cruzadas y comentarios, en iOS, Android y web desde un mismo código ([Expo](https://expo.dev)).

## Qué hace hoy

- Lector de Reina-Valera 1909 con los 66 libros, selector de libro y capítulo, tamaño de letra y modo oscuro automático.
- Al tocar un versículo se abre un panel con:
  - **Interlineal** del Nuevo Testamento: griego, transliteración y glosa en español palabra por palabra; al tocar una palabra se ve su lema, significado, número Strong y morfología.
  - **Referencias cruzadas** ordenadas por relevancia, con vista previa y salto al pasaje.
  - **Comentario:** enlace al capítulo en Enduring Word mientras llega el comentario propio.

## Cómo correrla

Necesitas Node 22 y Python 3.

```sh
npm install
npm run data      # descarga las fuentes y genera public/data (unos 26 MB)
npm run web       # abre la app en el navegador
```

En el teléfono (Expo Go o una build de desarrollo) los datos se leen de una URL: publica la web (`npm run build:web` genera `dist/`) y define `EXPO_PUBLIC_DATA_URL=https://tu-sitio/data` antes de `npm start`. Los paquetes descargables para leer sin conexión llegan en una fase posterior.

## Datos y licencias

`pipeline/build_data.py` descarga las fuentes en cada build; no se guardan en el repositorio.

| Datos | Fuente | Licencia |
| --- | --- | --- |
| Reina-Valera 1909 | [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) | Dominio público |
| Griego del NT, morfología, glosas inglesas y españolas | [STEPBible TAGNT](https://github.com/STEPBible/STEPBible-Data), Tyndale House | CC BY 4.0 |
| Referencias cruzadas | [OpenBible.info](https://www.openbible.info/labs/cross-references/) | CC BY |

El interlineal muestra las palabras del texto tradicional (Textus Receptus), que es el que traduce la RV1909, con la versificación de la KJV. Las glosas españolas de STEPBible vienen del proyecto Marvel Bible y usan términos de la Traducción del Nuevo Mundo («madero de ejecución», «bondad inmerecida»). El pipeline los sustituye por los de la tradición cristiana histórica (`fix_gloss` en `pipeline/build_data.py`), pero las glosas necesitan una revisión completa antes del lanzamiento.

## Estudiar con IA

El botón «Estudiar» (en la cabecera del capítulo y en la barra de cada versículo) llama a `api/estudiar.ts`, una función de Vercel. Pasa a Claude el capítulo en RV1909, el griego y las referencias cruzadas como documentos con citas, y devuelve el estudio por partes con notas numeradas que llevan al pasaje citado. Después se pueden hacer preguntas sobre el mismo pasaje.

Variables en Vercel:

- `ANTHROPIC_API_KEY` (obligatoria).
- `ESTUDIO_MODEL` (opcional, por defecto `claude-opus-5-5`).

En el teléfono, `EXPO_PUBLIC_API_URL` apunta a la web publicada.

## Versiones

Además de la RV1909 hay dos versiones modernas libres: La Biblia en Español Sencillo (dominio público) y Palabra de Dios para ti (© 2020 Asociación Bíblica Latinoamericana, CC BY 4.0). `pipeline/fetch_versions.py` las descarga una vez y las guarda en `pipeline/versions/`, así la compilación no depende de miles de descargas. El griego, las referencias y el estudio con IA siguen la numeración de la RV1909.

## Rutas y Google

Las rutas son en español: `/juan/3` y `/juan/3/16` (`src/lib/routes.ts`); los códigos antiguos como `/jhn/3?v=16` siguen funcionando. Después de exportar la web, `pipeline/seo_pages.py` escribe una página por capítulo con el texto de la RV1909, título, descripción y enlaces, además de `sitemap.xml` y `robots.txt`. La app reemplaza ese contenido al cargar. Las demás rutas sirven `app.html`.

## Publicación

La web está en https://biblia.migueblanco.com (proyecto `biblia-de-estudio` en Vercel). El DNS está en Cloudflare: un CNAME `biblia` → `cname.vercel-dns.com` sin proxy (nube gris), igual que `hoyvemos`. Mientras el MVP no esté en `main`, el dominio sigue la rama `claude/estudiar`; las publicaciones de esa rama son de tipo Preview, así que `ANTHROPIC_API_KEY` tiene que estar también en Preview.

## Estructura

- `src/app/`: pantallas (Expo Router).
- `src/components/VersePanel.tsx`: panel del versículo.
- `src/lib/data.ts`: carga de datos; `src/lib/refs.ts`: formato de referencias.
- `src/components/StudyPanel.tsx` y `src/lib/estudio.ts`: estudio con IA.
- `api/estudiar.ts`: función de Vercel que genera el estudio.
- `pipeline/`: generación de datos.
