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

El interlineal muestra las palabras del texto tradicional (Textus Receptus), que es el que traduce la RV1909, con la versificación de la KJV. Las glosas españolas de STEPBible vienen del proyecto Marvel Bible y necesitan revisión antes del lanzamiento.

## Estructura

- `src/app/`: pantallas (Expo Router).
- `src/components/VersePanel.tsx`: panel del versículo.
- `src/lib/data.ts`: carga de datos y formato de referencias.
- `pipeline/`: generación de datos.
