# Exportaciones Word docentes

El formato se construye en `lib/docx/`. Los datos y los criterios se reciben del
recurso existente; no se llama a IA.

```
lib/docx/tema.js              paleta, tipografía, geometría y proporciones
lib/docx/core.js              primitivas: sección, barra, tablas, celdas, header, footer
lib/docx/plantillas/sesion.js maqueta de la sesión de aprendizaje (14 secciones)
lib/docx/plantillas/steam.js  maqueta del proyecto STEAM (9 secciones romanas)
lib/docx/exporters.js         el resto de documentos y el enrutado por tipo
```

| Descarga activa | Adaptador / entrada | Maquetación |
| --- | --- | --- |
| Sesión | `downloadSessionWord` | Vertical · plantilla oficial de 14 secciones |
| Clase completa | `downloadClass` → `downloadCompleteClass` | Sesión vertical; la rúbrica del paso 2 entra como anexo de la sesión; cualquier otro instrumento conserva su parte |
| Proyecto STEAM | `downloadProject` | Vertical · plantilla oficial de 9 secciones |
| Rúbrica | `downloadRubricWord` | Vertical · cinco columnas AD → C con escala de color |
| Lista de cotejo | `downloadChecklistWord` | Datos y criterios verticales; registro horizontal |
| Escala de valoración | `downloadResource("rating_scale", ...)` | Datos y criterios verticales; registro horizontal |
| Ficha de trabajo / lectura vinculada o independiente | `downloadResource` | Vertical; una tabla de más de cuatro columnas usa sección horizontal |
| Reto y actividades de catálogo | `downloadResource("challenge", ...)` / `downloadActivityWord` | Vertical |
| Sopa de letras | `downloadWordSearch` | Vertical hasta 17 filas; horizontal desde 18; solucionario separado |
| Biblioteca | `downloadMaterial` | El mismo constructor según el tipo guardado |
| Recursos de sesión de ambas versiones | `SessionNextFlow`, `SessionResourcesPanel` | Los mismos constructores; adapta ambos esquemas de datos |
| Plantillas antiguas | `downloadText` | Convierte párrafos, énfasis y tablas Markdown a DOCX |

## Sistema visual

Los valores de `tema.js` están MEDIDOS sobre el OOXML de las 25 plantillas
oficiales de `PLANTILLAS/SCIVERSE/` —material de referencia local, fuera de
git—. Las 25 comparten paleta, tipografía y geometría.

| Elemento | Valor |
| --- | --- |
| Tipografía | Calibri en todo el documento |
| Navy · titulares, cabecera de tabla, barra de momento | `0B2E4F` |
| Azul · regla de sección, subtítulos, barra de sesión | `1C74BC` |
| Fondo suave · celda-etiqueta y destacados | `EAF4FB` |
| Texto / auxiliar | `1A1A1A` / `6B7C8C` |
| Rúbrica AD → C | `1C74BC` · `6BB3E0` · `BBDBF0` · `EAF4FB` |
| Título · subtítulo · sección · momento · cuerpo · nota | 16 · 13 · 12,5 · 11 · 10,5 · 10 pt |
| Página | A4 vertical, margen 900 dxa, header y footer 708 |
| Encabezado | `SCIVERSE · <TIPO> · <ÁREA>` |
| Pie | `SciVerse · una iniciativa de Teaching TIC | Página X de Y` |

El pack entregado firma de dos maneras distintas —las sesiones dicen «Elaborado
con Teaching Tic - Sciverse» y el proyecto STEAM «SciVerse · una iniciativa de
Teaching TIC»—. Se unifica en la segunda: dos descargas del mismo docente no
pueden parecer de dos productos.

Las tablas se declaran en PROPORCIONES, no en los anchos literales de la
plantilla: `widths()` los reparte sobre el ancho imprimible real, así que la
tabla encaja aunque cambie el margen o la orientación.

## Reglas de impresión

- Ningún tamaño por debajo de 10 pt, tampoco para hacer caber contenido.
- Anchos calculados sobre el área imprimible; títulos unidos al contenido que
  encabezan (`keepNext`).
- **`cantSplit` no es global.** Prohibir que una fila se parta sólo tiene
  sentido en filas cortas —el registro nominal de cotejo y escala—. En una
  rúbrica con cuatro descriptores largos la fila puede medir más que la página:
  se permite que Word la divida, antes que dejar media página en blanco.
- **Cabecera repetida** (`tableHeader`) en toda tabla de datos: desempeños,
  criterios, enfoques, competencias, rúbricas y registros.
- **Ninguna altura exacta** salvo la cuadrícula de la sopa, donde la celda debe
  ser cuadrada. El resto usa `ATLEAST` y crece con el contenido.
- Cotejo y escala muestran C1…Cn. Más de seis criterios producen registros
  adicionales, conservando todos los criterios y la numeración de estudiantes.
- Las preguntas permanecen unidas a sus espacios de respuesta con bordes.
- Secciones `nextPage` reales para los cambios de orientación. La librería
  `docx` intercambia las dimensiones al aplicar landscape: recibe el tamaño
  base vertical A4 para evitar invertir dos veces el papel.

## Decisiones de contenido

- **Estándar de aprendizaje.** La plantilla reserva una fila para la copia
  textual del estándar CNEB. SciVerse no tiene ese dato y pedírselo al modelo
  sería invitarle a redactar normativa: la fila se omite entera, sin «Por
  completar» ni «N/A».
- **Rutas por área.** Comunicación, Castellano L2, Inglés y Arte y Cultura
  ofrecen dos o tres rutas didácticas para que el docente elija una. La
  generación ya elige según la competencia, así que el Word imprime la ruta
  que salió y no las tres.
- **Anexos.** El bloque abre en hoja nueva, pero un anexo corto NO abre la
  suya: continúa debajo del anterior. La plantilla salta pagina por anexo
  porque los suyos son fichas completas; con un anexo de tres lineas ese salto
  fijo dejaba tres cuartos de pagina en blanco. Solo la guia de trabajo
  —la actividad para estudiantes— lleva la cabecera de datos del equipo y los
  espacios de respuesta: una ficha informativa se lee, no se rellena.
- **Rúbrica en clase completa.** La plantilla de sesión reserva su último anexo
  para una rúbrica analítica. Si el instrumento del paso 2 ES una rúbrica se
  coloca ahí y no se repite como parte independiente; con cotejo o escala la
  parte se conserva entera.
- **Área articuladora del STEAM.** Se reutiliza el área curricular principal que
  el formulario ya envía; si no llega, la fila se omite.

## QA reproducible

```sh
node scripts/word-qa.mjs
npx vitest run tests/word.test.js
```

El primer comando genera once archivos en `docs/qa/word/`: `01-sesion.docx` a
`10-sopa-letras.docx` mas `11-sesion-dpcc.docx`, el caso real de Secundaria 3.º
con el area de nombre mas largo del catalogo (DPCC), una IE de 78 caracteres y
un titulo de 111. La carpeta ya está ignorada por Git. Todos los datos son
ficticios y reproducen la FORMA REAL que entrega la generación
—`componerSesion()` y `PROJECT_SCHEMA`—, no una versión reducida.

Para revisarlos con Microsoft Word instalado, la conversión a PDF sólo funciona
con un proceso que cierre los modales en paralelo: Word rechaza las llamadas COM
(`RPC_E_CALL_REJECTED`) mientras tiene un diálogo abierto. Ver
`docs/qa/word/dismiss-word.py`.

Las pruebas empaquetan DOCX reales y abren su OOXML para validar identidad
(Calibri y la paleta), estructura (las 14 secciones de la sesión, las 9 del
proyecto), orientación, cabeceras repetidas, ausencia de `cantSplit` global,
ausencia de alturas exactas y resistencia al contenido largo: un área
«Desarrollo Personal, Ciudadanía y Cívica (DPCC)», un título de más de 150
caracteres y párrafos de 450 que deben entrar completos.

La paginación concreta depende de la extensión del contenido; el constructor no
elimina texto para forzar un número de páginas.
