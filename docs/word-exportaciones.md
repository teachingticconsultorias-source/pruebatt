# Exportaciones Word docentes

El formato se construye en `lib/docx/core.js` y `lib/docx/exporters.js`.
Los datos y los criterios se reciben del recurso existente; no se llama a IA.

| Descarga activa | Adaptador / entrada | Maquetación |
| --- | --- | --- |
| Sesión | `downloadSessionWord` | Vertical |
| Clase completa | `downloadClass` → `downloadCompleteClass` | Sesión vertical, instrumento con secciones propias, material vertical normalmente |
| Proyecto STEAM | `downloadProject` | Vertical |
| Rúbrica | `downloadRubricWord` | Datos verticales y rúbrica horizontal |
| Lista de cotejo | `downloadChecklistWord` | Datos y criterios verticales; registro horizontal |
| Escala de valoración | `downloadResource("rating_scale", ...)` | Datos y criterios verticales; registro horizontal |
| Ficha de trabajo / lectura vinculada o independiente | `downloadResource` | Vertical; una tabla de más de cuatro columnas usa sección horizontal |
| Reto y actividades de catálogo | `downloadResource("challenge", ...)` / `downloadActivityWord` | Vertical |
| Sopa de letras | `downloadWordSearch` | Vertical hasta 17 filas; horizontal desde 18; solucionario separado |
| Biblioteca | `downloadMaterial` | El mismo constructor según el tipo guardado |
| Recursos de sesión de ambas versiones | `SessionNextFlow`, `SessionResourcesPanel` | Los mismos constructores; adapta ambos esquemas de datos |
| Plantillas antiguas | `downloadText` | Convierte párrafos, énfasis y tablas Markdown a DOCX |

Se retiraron los estilos y constructores duplicados de las tres pantallas.
Las funciones de texto que permanecen sirven a las vistas previas web, no a las
descargas estructuradas. Las herramientas antiguas no activas conservan el
adaptador de texto compartido.

## Reglas de impresión

- A4; margen de 1000 DXA, Arial 11 pt y mínimo de 10 pt en tablas y pie.
- Identidad institucional, sombreado claro, bordes discretos y Página X de Y.
- Anchos calculados sobre el área imprimible, encabezados de tabla repetidos,
  filas indivisibles y títulos unidos al contenido siguiente.
- Cotejo y escala muestran C1…Cn. Más de seis criterios producen registros
  adicionales, conservando todos los criterios y la numeración de estudiantes.
- Rúbricas extensas se distribuyen en bloques equilibrados, con hasta seis
  criterios por bloque, sin reducir los descriptores ni la fuente.
- Las preguntas permanecen unidas a sus espacios de respuesta con bordes.
- Secciones `nextPage` reales para los cambios de orientación. La librería
  `docx` intercambia las dimensiones al aplicar landscape: recibe el tamaño
  base vertical A4 para evitar invertir dos veces el papel.

## QA reproducible

```sh
node scripts/word-qa.mjs
npx vitest run tests/word.test.js
```

El primer comando genera los diez archivos `01-sesion.docx` a
`10-sopa-letras.docx` en `docs/qa/word/`, carpeta ya ignorada por Git. Todos los
datos son ficticios. Las pruebas empaquetan DOCX reales y abren su OOXML para
validar orientación, secciones, tablas, filas, contenido y tipografía.

Además se revisaron los diez DOCX con Microsoft Word instalado, exportándolos
a PDF localmente. Los PDF y las hojas de contacto de esa revisión quedan en
la misma carpeta ignorada. La paginación concreta depende de la extensión del
contenido; el constructor no elimina texto para forzar un número de páginas.
