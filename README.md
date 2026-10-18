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

## Genealogías y contexto histórico

El estudio de cada capítulo (o versículo) muestra arriba dos secciones fijas, que no genera la IA:

- **El mundo en …**: el periodo bíblico del capítulo con sus fechas y lo que pasaba en Egipto, Mesopotamia, Persia, Grecia, Roma, India, China o América en esos años, con enlaces a los pasajes relacionados. `/historia` es la línea de tiempo completa. Los datos están en `src/lib/historia.ts`: fechas bíblicas según la cronología conservadora habitual (éxodo c. 1446 a.C., reyes según Thiele, crucifixión c. 30 d.C., con la alternativa en la nota cuando hay una seria) y una selección propia de eventos con las fechas de la historia académica.
- **Familias y genealogías**: las personas del pasaje con familia conocida. `/genealogia/994-david` dibuja el árbol (abuelos, padres, hermanos, cónyuges e hijos) y el linaje hasta Adán; `/genealogia` busca por nombre. `pipeline/genealogias.py` toma las relaciones de [Theographic Bible Metadata](https://github.com/robertrouse/theographic-bible-metadata) (CC BY-SA 4.0, commit fijado) y busca el nombre de cada persona en la RV1909. No usa las fechas de Theographic (cronología de Ussher/Jones) ni su diccionario.

## Rutas y Google

Las rutas son en español: `/juan/3` y `/juan/3/16` (`src/lib/routes.ts`); los códigos antiguos como `/jhn/3?v=16` siguen funcionando. Después de exportar la web, `pipeline/seo_pages.py` escribe una página por capítulo con el texto de la RV1909, título, descripción y enlaces, además de `sitemap.xml` y `robots.txt`. La app reemplaza ese contenido al cargar. Las demás rutas sirven `app.html`.

## Comunidad

La pestaña Comunidad (`/comunidades`) es el muro de la gente con la que lees. Cada persona crea su cuenta solo con un nombre (y, si quiere, correo y contraseña en `/cuenta` para entrar desde otro dispositivo).

- **Amigos:** cada cuenta tiene un código de amistad y un enlace `/amigo/CODIGO`. También se sugiere agregar a la gente de tus grupos. La amistad se pide y se acepta.
- **Lo que leen tus amigos:** al marcar un capítulo como leído aparece en el muro de tus amigos («leyó hoy Juan 3 y 4»). Se puede apagar en Amigos > Privacidad.
- **Versículos resaltados e imágenes:** desde «Compartir» en un versículo, «Publicar en Comunidad» publica la imagen elegida o el versículo como resaltado, con un comentario opcional. El texto del versículo lo pone el servidor desde los datos de la app.
- **Preguntas y lo que aprendí:** se escriben desde «Pregúntale algo a la comunidad…».
- **Me gusta y comentarios** en todo. Quien publica puede borrar los comentarios de su publicación.
- **Para quién:** cada publicación es para tus amigos o para toda la comunidad (filtro «Todos»). Las lecturas son solo para amigos. Quien reporta una publicación deja de verla, y con 3 reportes se oculta para los que no son amigos de quien la escribió.

## Planes en grupo

En `/grupos` (pestaña Planes) se crean grupos privados para la iglesia, la célula, la familia o los amigos. Se entra únicamente con el enlace `/unirse/CODIGO`.

- **Plan de lectura en común:** un libro, un ritmo (1 a 3 capítulos al día) y una fecha de inicio. El grupo ve quién ya leyó la lectura de hoy, sin «me gusta» ni rankings, y una meta de la semana compartida (hasta 5 días por persona).
- **Notas compartidas en un versículo:** pestaña «Grupo» del panel del versículo y pestaña «Notas» del grupo.
- **Peticiones de oración** con «Estoy orando» y «Dios respondió».
- **Preguntas para la reunión** sugeridas por la IA a partir del capítulo (RV1909). Solo propone preguntas al estilo del Estudio Bíblico de Descubrimiento; no escribe la enseñanza.

Al marcar un capítulo como leído, la app lo avisa a los grupos de la persona.

Todo pasa por `api/comunidades.ts`, una función de Vercel con Postgres. Variables en Vercel:

- `DATABASE_URL` (o `POSTGRES_URL`): la base de Neon que crea la integración del Marketplace de Vercel. Las tablas se crean solas la primera vez.
- `ANTHROPIC_API_KEY` para las preguntas de la reunión (la misma del estudio).

## Compartir versículos

El botón «Compartir» de la barra del versículo abre `src/components/VerseImage.tsx`: una imagen del versículo en formato publicación (1080×1080) o historia (1080×1920), con cuatro estilos, para compartir en redes o descargar, además de compartir o copiar el texto con su enlace. En web la imagen se dibuja en un canvas (`src/lib/compartir.ts`); en el teléfono se captura la vista previa con `react-native-view-shot` y se comparte con `expo-sharing`.

## Publicación

La web está en https://biblia.migueblanco.com (proyecto `biblia-de-estudio` en Vercel). El DNS está en Cloudflare: un CNAME `biblia` → `cname.vercel-dns.com` sin proxy (nube gris), igual que `hoyvemos`. Mientras el MVP no esté en `main`, el dominio sigue la rama `claude/estudiar`; las publicaciones de esa rama son de tipo Preview, así que `ANTHROPIC_API_KEY` tiene que estar también en Preview.

## Estructura

- `src/app/`: pantallas (Expo Router).
- `src/components/VersePanel.tsx`: panel del versículo.
- `src/lib/data.ts`: carga de datos; `src/lib/refs.ts`: formato de referencias.
- `src/components/StudyPanel.tsx` y `src/lib/estudio.ts`: estudio con IA.
- `api/estudiar.ts`: función de Vercel que genera el estudio.
- `api/comunidades.ts`, `src/lib/comunidad.ts`, `src/app/comunidades/` y `src/components/comunidad/`: comunidades.
- `pipeline/`: generación de datos.
