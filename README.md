# Biblia de estudio

App para estudiar la Biblia a fondo con la sencillez de La Biblia App: texto, interlineal en el idioma original, referencias cruzadas y comentarios, en iOS, Android y web desde un mismo código ([Expo](https://expo.dev)).

## Qué hace hoy

- Lector de Reina-Valera 1909 con los 66 libros, selector de libro y capítulo, tamaño de letra y modo oscuro automático.
- Al tocar un versículo se abre un panel con:
  - **Interlineal** del Nuevo Testamento: griego, transliteración y glosa en español palabra por palabra; al tocar una palabra se ve su lema, significado, número Strong y morfología.
  - **Referencias cruzadas** ordenadas por relevancia, con vista previa y salto al pasaje.
  - **Comentario:** Matthew Henry y Jamieson-Fausset-Brown (dominio público) traducidos al español con IA, y enlace al capítulo en Enduring Word.

## Cómo correrla

Necesitas Node 22 y Python 3.

```sh
npm install
npm run data      # descarga las fuentes y genera public/data (unos 26 MB)
npm run web       # abre la app en el navegador
```

En el teléfono (Expo Go o una build de desarrollo) los datos se leen de la web publicada (https://biblia.migueblanco.com/data); para usar otra, publica la web (`npm run build:web` genera `dist/`) y define `EXPO_PUBLIC_DATA_URL=https://tu-sitio/data` antes de `npm start`. Las traducciones libres, el interlineal y las referencias se pueden descargar completos desde «Sin conexión» (en la web con Cache Storage y en el teléfono con expo-file-system, ver `src/lib/almacen.native.ts`).

## Datos y licencias

`pipeline/build_data.py` descarga las fuentes en cada build; no se guardan en el repositorio.

| Datos | Fuente | Licencia |
| --- | --- | --- |
| Reina-Valera 1909 | [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) | Dominio público |
| Griego del NT, morfología, glosas inglesas y españolas | [STEPBible TAGNT](https://github.com/STEPBible/STEPBible-Data), Tyndale House | CC BY 4.0 |
| Referencias cruzadas | [OpenBible.info](https://www.openbible.info/labs/cross-references/) | CC BY |
| Fotos de lugares | [OpenBible.info Bible Geocoding Data](https://github.com/openbibleinfo/Bible-Geocoding-Data), fotos de Wikimedia Commons | Solo las de licencia libre (dominio público, CC0, CC BY, CC BY-SA), con autor y licencia |
| Fotos de objetos y mapas históricos | Imagen principal de artículos de Wikipedia, alojada en Wikimedia Commons (`pipeline/imagenes.py`) | Solo libres; se comprueba la licencia en cada build |
| Fichas de personas y lugares | [STEPBible TIPNR](https://github.com/STEPBible/STEPBible-Data/tree/master/Proper%20Nouns), Tyndale House (`pipeline/fichas.py`, commit fijado) | CC BY 4.0; con cambios: nombres de la RV1909 y descripción traducida con IA |
| Medidas antiguas | Tabla propia (`pipeline/medidas.py`) con los valores aproximados habituales | — |

El interlineal muestra las palabras del texto tradicional (Textus Receptus), que es el que traduce la RV1909, con la versificación de la KJV. Las glosas españolas de STEPBible vienen del proyecto Marvel Bible y usan términos de la Traducción del Nuevo Mundo («madero de ejecución», «bondad inmerecida»). El pipeline los sustituye por los de la tradición cristiana histórica (`fix_gloss` en `pipeline/build_data.py`), pero las glosas necesitan una revisión completa antes del lanzamiento.

## Comentarios

La pestaña «Comentario» de cada versículo muestra la sección del comentario que lo trata. Las fuentes están en `src/lib/comentarioFuentes.ts` y son intercambiables:

- **Traducidas:** Matthew Henry (*Commentary on the Whole Bible*, 1706-1721) y Jamieson, Fausset y Brown (1871), de dominio público, tomados de los módulos SWORD de CrossWire. `pipeline/build_comentarios.py` los descarga en cada build y los parte en secciones y partes de unas 700 palabras en `public/comentarios/` (solo la lee la función; la app nunca muestra el inglés).
- **Propias:** texto que ya está en español, con el mismo formato en `public/comentarios/<id>/`, se sirve sin traducir. Ahí iría Enduring Word en español si David Guzik da permiso.
- **Enlace:** Enduring Word, mientras tanto, se abre en su sitio.

`api/comentario.ts` traduce cada parte la primera vez que alguien la abre (con la RV1909 del pasaje para que las citas usen esas palabras), la guarda en la base de datos (`comentarios_es`) y después otra pasada de IA la revisa contra el original. Las personas pueden avisar de errores desde la app (`comentarios_reportes`); una traducción revisada a mano se marca con `estado = 'humano'`. Variables opcionales: `COMENTARIO_MODEL` (traducción, por defecto `claude-sonnet-5-5`), `COMENTARIO_REVISOR` (revisión, por defecto `claude-opus-5-5`) y `COMENTARIO_PARTES_DIA` (tope diario de partes nuevas, por defecto 400).

## Estudiar con IA

El botón «Estudiar» (en la cabecera del capítulo y en la barra de cada versículo) llama a `api/estudiar.ts`, una función de Vercel. Pasa a Claude el capítulo en RV1909, el griego y las referencias cruzadas como documentos con citas, y devuelve el estudio por partes con notas numeradas que llevan al pasaje citado. Después se pueden hacer preguntas sobre el mismo pasaje.

Variables en Vercel:

- `ANTHROPIC_API_KEY` (obligatoria).
- `ESTUDIO_MODEL` (opcional, por defecto `claude-opus-5-5`).

En el teléfono, `EXPO_PUBLIC_API_URL` apunta a la web publicada.

### Herramientas del capítulo (ideas de NotebookLM)

Debajo de los botones de la cabecera del capítulo, con las mismas fuentes y citas que el estudio (`herramienta` en `api/estudiar.ts`). Lo que prepara la IA se guarda en el dispositivo, con la opción de pedir otra versión.

- **Pódcast** (`/podcast/juan/3`): Ana y Tomás conversan sobre el capítulo durante 5 a 7 minutos. Lo lee la voz del dispositivo (`expo-speech`), así que no hay servidor de voz ni coste por minuto; la transcripción sigue la voz y cada intervención lleva sus citas.
- **Mapa mental** (`/mapa-mental/juan/3`): idea central, partes del capítulo e ideas con su versículo. Se dibuja en SVG (a los dos lados en pantallas anchas, en columna en el teléfono) y también se puede ver como lista.
- **Tarjetas** (`/tarjetas/juan/3`): la IA propone preguntas de repaso y la persona elige cuáles guardar. «Memorizar» en la barra del versículo crea una tarjeta del versículo. `/repaso` las muestra con repetición espaciada (una versión de SM-2) y Hoy avisa cuando hay tarjetas pendientes. Todo queda en el dispositivo.

### La historia de una palabra

`/palabras` sigue una palabra del hebreo o del griego por toda la Biblia. El catálogo (`src/lib/palabras.json`) tiene 17 temas, cada uno con su palabra hebrea y su palabra griega (jésed y éleos, ahavá y ágape, shalóm y eiréne…), y cada palabra con sus números de Strong de la concordancia. `/palabras/jesed` muestra cuántas veces aparece, su recorrido de Génesis a Apocalipsis y cómo se lee en la RV1909; Hoy propone una palabra cada semana y la ficha de una palabra del interlineal lleva a su historia.

- **El relato:** `api/estudiar.ts` con `palabra` pasa a Claude la entrada del léxico breve de STEPBible (TBESH/TBESG, CC BY 4.0, que `build_data.py` guarda en `palabras/<id>.json`), el resumen de la concordancia y unos 70 pasajes repartidos por todos los libros con su RV1909, más los de la palabra hermana. Responde con «Qué significa», de 4 a 6 momentos en el orden de la Biblia, «El hilo» y «Para pensar», todo con citas. Se guarda en `herramientas_ia` (`palabra`, capítulo 0) y, ya preparado, se lee sin cuenta.
- **Pódcast:** `/palabras/jesed/podcast`, con el guion de Ana y Tomás (`palabra-podcast`) y la grabación con voces naturales de `api/podcast-grabado.ts` (`palabra`), con los mismos límites diarios que los capítulos.

## Versiones

Además de la RV1909 hay cinco versiones libres. `pipeline/fetch_versions.py` las descarga una vez y las guarda en `pipeline/versions/`, así la compilación no depende de miles de descargas. El griego, el hebreo, las referencias y el estudio con IA siguen la numeración de la RV1909.

- Reina-Valera 1865 (dominio público), de scrollmapper/bible_databases.
- Reina Valera Gómez (© 2004, 2010 Dr. Humberto Gómez Caballero; eBible.org la publica como redistribuible) y Santa Biblia libre para el mundo (dominio público): USFM de eBible.org. Como eBible.org no se abre desde todos los entornos, la acción «Versiones de la Biblia» (`.github/workflows/versiones.yml`) corre el script y sube los archivos.
- La Biblia en Español Sencillo (dominio público) y Palabra de Dios para ti (© 2020 Asociación Bíblica Latinoamericana, CC BY 4.0), de wldeh/bible-api.

No se incluye la Versión Biblia Libre (Jonathan Gallagher, adventista): la app evita fuentes de grupos sectarios.

## Genealogías y contexto histórico

El estudio de cada capítulo (o versículo) muestra arriba dos secciones fijas, que no genera la IA:

- **El mundo en …**: el periodo bíblico del capítulo con sus fechas y lo que pasaba en Egipto, Mesopotamia, Persia, Grecia, Roma, India, China o América en esos años, con enlaces a los pasajes relacionados. `/historia` es la línea de tiempo completa. Los datos están en `src/lib/historia.ts`: fechas bíblicas según la cronología conservadora habitual (éxodo c. 1446 a.C., reyes según Thiele, crucifixión c. 30 d.C., con la alternativa en la nota cuando hay una seria) y una selección propia de eventos con las fechas de la historia académica.
- **Familias y genealogías**: las personas del pasaje con familia conocida. `/genealogia/994-david` dibuja el árbol (abuelos, padres, hermanos, cónyuges e hijos) y el linaje hasta Adán; `/genealogia` busca por nombre. `pipeline/genealogias.py` toma las relaciones de [Theographic Bible Metadata](https://github.com/robertrouse/theographic-bible-metadata) (CC BY-SA 4.0, commit fijado) y busca el nombre de cada persona en la RV1909. No usa las fechas de Theographic (cronología de Ussher/Jones) ni su diccionario.

## Fichas de personas y lugares

`/ficha/h1732-david` junta en una página lo que la app sabe de una persona o un lugar: quién fue, su familia (con enlace al árbol de las genealogías), cuándo vivió (periodos de la línea de tiempo y qué pasaba en el mundo), los lugares de su historia en el mapa, sus versículos clave y en qué libros aparece. Los lugares muestran su ubicación (OpenBible.info), la foto libre de la zona y la gente que vivió allí.

- **Datos:** `pipeline/fichas.py` (al final de `build_data.py`) lee TIPNR de STEPBible, que distingue a cada persona o lugar en cada versículo (los varios Zacarías, las dos Belén), y lo junta con las genealogías de Theographic (por los versículos en común) y con OpenBible (por el nombre que da TIPNR). Los nombres en español son los de la RV1909, como en los mapas. Salida: `fichas/f/<id>.json`, `fichas/indice.json` (buscador) y `fichas/cap/<libro>/<cap>.json` (lector).
- **Descripción:** el artículo de TIPNR está en inglés. `api/comentario.ts` (`?ficha=` y `{ ficha }`) lo traduce la primera vez que alguien abre la ficha, con un glosario de nombres de la RV1909, y lo guarda en `fichas_es` para todos. Tope diario de fichas nuevas: `FICHAS_DIA` (300). Va en la misma función que los comentarios porque el plan Hobby de Vercel admite 12 funciones.
- **Cómo se llega:** al elegir un versículo, la barra muestra a las personas y lugares que nombra y, en la RV1909, sus nombres se pueden tocar; el buscador encuentra fichas por nombre; el mapa del versículo y la genealogía enlazan a la ficha.

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

## Licencia

© 2026 Miguel Blanco. Todos los derechos reservados. El código es público para leerlo y revisarlo, pero no se puede copiar, modificar, publicar como otra app ni usar con fines comerciales sin permiso escrito: ver [LICENSE](LICENSE).

Esa licencia cubre solo la obra propia. Los textos bíblicos, comentarios, datos, fotos y grabaciones de terceros conservan su licencia (dominio público, CC BY, CC BY-SA, CC BY-NC), y lo que se deriva de una fuente CC BY-SA, como la traducción de las notas de Tyndale, sigue siendo CC BY-SA 4.0. El detalle está en [NOTICE.md](NOTICE.md).
