# Exportaciones Word docentes

El formato se construye en `lib/docx/`. Los datos y los criterios se reciben del
recurso existente; no se llama a IA.

```
lib/docx/tema.js              paleta, tipografía, geometría y proporciones
lib/docx/core.js              primitivas: sección, barra, tablas, celdas, header, footer
lib/docx/plantillas/sesion.js maqueta de la sesión de aprendizaje (14 secciones)
lib/docx/plantillas/steam.js  maqueta del proyecto STEAM (9 secciones romanas)
lib/docx/plantillas/laboratorio.js  ficha del estudiante (5) + guia del docente (9)
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
| Guía de laboratorio | `downloadResource("lab_guide", ...)` | Vertical · ficha del estudiante + guía del docente en un solo DOCX, separadas por salto de página |
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
- **Laboratorio: dos documentos, un archivo.** La ficha del estudiante y la
  guía del docente son la MISMA práctica —comparten pregunta, materiales y los
  cinco momentos— así que van en un solo DOCX separadas por un salto de
  página. La hipótesis y las variables de la ficha se dejan EN BLANCO: las
  escribe el estudiante, y ése es el ejercicio. La hipótesis modelo va en la
  guía del docente, con su aviso de que no se entrega.

  Las dos mitades se declaran en `laboratorioBloques()` —seis bloques la ficha,
  diez la guía— y las tres composiciones (`fichaEstudianteChildren`,
  `guiaDocenteChildren`, `labGuideChildren`) se arman **tomando** de ahí, en el
  orden que fijan `BLOQUES_FICHA` y `BLOQUES_DOCENTE`. Una prueba comprueba que
  `hijos === suma de los bloques + 1` (el salto de página) y que cada rótulo
  —«Ficha del Estudiante», «Guía del Docente»— aparece EXACTAMENTE una vez, en
  ese orden. Es la misma disciplina que `sessionBloques()`: nada se deduce
  releyendo párrafos ya construidos, porque los objetos de `docx` no exponen su
  texto y ese troceado falla en silencio.

  Los dos rótulos van en caja de título, no en mayúsculas, porque así los traen
  las dos plantillas del pack; el que va en mayúsculas es «GUÍA DE LABORATORIO»,
  común a las dos mitades, más el encabezado de página que Word repite en cada
  hoja. Buscar «GUÍA DEL DOCENTE» en mayúsculas no encuentra nada, y contar
  sobre el PDF cuenta también los encabezados: seis páginas, seis encabezados.
- **El cuestionario comparte la maqueta de la ficha de trabajo**, que es lo
  correcto —datos del estudiante, instrucciones y preguntas numeradas— pero no
  su título: se descargaba encabezado «FICHA DE TRABAJO». `worksheetSections`
  recibe ahora el `type` y rotula según corresponda.

  En verdadero/falso las casillas SON las opciones. Listarlas además como
  «A. Verdadero / B. Falso» las imprimía dos veces; no se veía en la ficha de
  trabajo, donde esas preguntas llegan sin `opciones`, pero el esquema del
  cuestionario las exige siempre.
- **Área articuladora del STEAM.** Se reutiliza el área curricular principal que
  el formulario ya envía; si no llega, la fila se omite.

## Personalizar export · la marca del colegio

Tres modos por docente, de menos a más específico. Se eligen en
**Mi cuenta → Personalizar export** y se aplican a TODAS sus descargas.

| Modo | Qué hace | Plan |
| --- | --- | --- |
| `estandar` | La maqueta de siempre. Valor por defecto y respaldo de todo | Todos |
| `colegio` | La misma maqueta con el logo y los colores de la institución | Todos |
| `plantilla` | El `.docx` del propio colegio, relleno por marcadores | Pro |

```
lib/export/marca.js            modelo puro: normalización, modo efectivo, respaldos
lib/export/plantilla.js        validación del .docx y contrato de marcadores
lib/export/almacen.js          Supabase: fila, bucket privado y caché de sesión
lib/export/useMarcaExport.js   el hook de la pantalla
components/account/ExportSection.jsx   las tres tarjetas
scripts/plantilla-base.mjs     genera la plantilla de partida descargable
```

### El modo guardado no es el que manda

Lo guardado es una intención, no una garantía: un plan puede caducar y un
fichero puede borrarse desde el panel de Storage. `modoEfectivo()` resuelve la
caída en un solo sitio, y siempre hacia abajo:

```
plantilla  →  sin plan o sin fichero  →  colegio  →  sin logo ni colores  →  estandar
```

Una docente nunca se queda sin poder exportar. Si eligió plantilla y la pierde,
conserva sus colores: perderlos además del `.docx` sería castigar dos veces por
el mismo problema.

### El gate de Pro está en la base, no en la interfaz

La tercera tarjeta se ve siempre, con candado si el plan no la incluye —
esconderla dejaría a una docente Free sin saber que existe. Pero **el candado
es sólo lo que se ve**. Quien impide subir es la política de `storage.objects`:

```sql
with check (bucket_id = 'export-templates'
            and (storage.foldername(name))[1] = auth.uid()::text
            and (name not like '%.docx' or public.puede_plantilla_propia()))
```

Forzar el navegador no sirve: el objeto no llega a insertarse. Y la capacidad se
lee de `plans.features → docx_custom_template`, sin `'pro'` escrito a fuego.

Leer y borrar sólo exigen propiedad: si alguien deja de ser Pro conserva y puede
borrar su fichero, pero no puede subir otro.

### El contrato de marcadores

`patchDocument()` sustituye marcas `{{nombre}}` dentro de un `.docx` existente.
No hay forma de «insertar el contenido respetando la estructura» de un documento
arbitrario: si la plantilla del colegio no dice dónde va el propósito, el sistema
no puede adivinarlo.

De ahí la plantilla de partida (`public/plantillas/plantilla-base-sciverse.docx`),
que se **genera** desde el mismo contrato con `node scripts/plantilla-base.mjs`.
Si fuera un binario hecho a mano, añadir un marcador al código lo dejaría atrás
en silencio.

Al subir una plantilla se detectan sus marcas con `patchDetector()` y se rechaza
si le faltan las mínimas (`titulo`, `secuencia`), diciendo cuáles — mucho más
útil que «plantilla inválida». La validación mira extensión, tamaño y los cuatro
bytes `PK\x03\x04`: renombrar un `.exe` a `.docx` es trivial.

No hay vista previa del `.docx`: exigiría una dependencia pesada y con
plantillas de colegio sería poco fiel. Se enseña el nombre, el peso y la lista
de marcas reconocidas, que es lo que de verdad decide si funcionará.

### La plantilla de partida son dos documentos, no uno

La primera versión era un **manual con marcadores intercalados**: cada marca
llevaba encima su párrafo explicativo. Subida sin modificar, `patchDocument`
sustituía los párrafos con marca y dejaba intactos todos los demás —que eran
las instrucciones—. Salía medio documento de ayuda y media sesión.

Ahora hay un salto de página en medio:

| | |
| --- | --- |
| **Página 1** | Las instrucciones, con el aviso de borrarlas. **Cero marcas.** |
| **Página 2+** | El esqueleto limpio, utilizable tal cual, sin una palabra de ayuda. |

Escribir `{{secuencia}}` dentro de una frase de la página de ayuda la
convertiría en una marca real, y al rellenar se comería la explicación. Pasó al
generar la primera versión de la página 1; por eso las marcas se listan ahí sin
llaves y hay una prueba que lo vigila.

### Por qué una marca de bloque va sola en su párrafo

Medido sobre `docx@9.7.1`: `PatchType.DOCUMENT` reemplaza el **párrafo entero**
donde vive la marca. Si hay texto al lado, **no falla: se lo come**. Una marca
de bloque compartiendo párrafo es pérdida silenciosa de lo que escribió la
docente, y por eso se rechaza al subir — por pérdida de contenido, no por
fallo de la librería.

Las de línea sí pueden vivir dentro de una frase o de una celda con rótulo:
usan `PatchType.PARAGRAPH`, que sustituye sólo la marca.

Al subir se comprueban tres cosas, **antes** de que el fichero llegue a Storage:

1. que estén las marcas mínimas (`titulo`, `secuencia`);
2. que cada marca detectada se pueda parchear de verdad — un parcheo de prueba
   con una sonda, porque Word parte las marcas copiadas con formato en varios
   `<w:r>` y entonces `patchDetector` las ve pero `patchDocument` no las
   sustituye;
3. que ninguna marca de bloque comparta `<w:p>` con otro texto u otra marca,
   inspeccionando el XML.

Un fichero que falle cualquiera de las tres se rechaza con el motivo concreto
(«la marca `{{secuencia}}` debe estar SOLA en su párrafo…»), no con «plantilla
inválida».

### El contenido lo declara la maqueta; aquí no se deduce nada

`sessionBloques()` en `lib/docx/plantillas/sesion.js` devuelve los ocho cubos ya
construidos, y `sessionChildren()` **se compone de ellos**: la maqueta de SciVerse y
el modo plantilla comparten exactamente los mismos párrafos y tablas, así que no
pueden divergir.

La primera versión hacía lo contrario —trocear el resultado leyendo el texto de
los párrafos ya construidos— y fallaba en silencio: los objetos de `docx` no
exponen su texto así, los ocho cubos salían vacíos y las ocho marcas de bloque
llegaban literales al documento. La prueba de entonces pasaba porque le daba los
hijos a mano, saltándose justo la parte rota.

Y **toda marca declarada recibe parche, aunque no traiga contenido**: una que no
se pase a `patchDocument` se queda literal en el documento final. Sin anexos, un
`{{anexos}}` visible; en un proyecto STEAM, siete marcas visibles.

### El contrato es de SESIÓN, y sólo dos tipos lo llenan

Medido sobre los ejemplares de `tests/fixtures/word.js` (número de hijos por
cubo):

| tipo | datos_g. | propósitos | desemp. | criterios | enfoques | secuencia | dua | anexos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `session` | 1 | 1 | 1 | 1 | 1 | 52 | 8 | 23 |
| `complete` | 1 | 1 | 1 | 1 | 1 | 52 | 8 | 27 |
| `project_steam` | 0 | 0 | 0 | 0 | 0 | 42 | 0 | 0 |
| `rubric` y demás | 0 | 0 | 0 | 0 | 0 | 8 | 0 | 0 |

Sesión y clase completa llenan las diecisiete. El resto vuelca su cuerpo entero
en `{{secuencia}}` y deja las otras siete en blanco, con un efecto visible en
`docs/qa/word/15-steam-plantilla.pdf`: los encabezados del colegio
—PROPÓSITOS, DESEMPEÑOS, CRITERIOS, ENFOQUES— **sobreviven vacíos**, y debajo
el proyecto repite su propio título y su propia tabla de datos informativos.

No es un fallo del troceado: un proyecto STEAM no tiene desempeños precisados ni
orientaciones DUA, y en cambio tiene integración STEAM, ruta por semanas y
sesiones, que en este contrato no tienen dónde caer. Son estructuras distintas,
no la misma con secciones ausentes.

Por eso el modo está **acotado**: `TIPOS_CON_PLANTILLA` en `lib/export/marca.js`
lo limita a `session` y `complete`, y `admitePlantilla(tipo)` es la puerta. Con
cualquier otro tipo, `modoEfectivo(marca, { tipo })` baja a `colegio`: la maqueta
de SciVerse con el logo y los colores del centro. El colegio conserva su identidad
en TODAS sus descargas y nadie recibe un documento con secciones huecas.

Un contrato por tipo obligaría a cada docente a mantener y subir varias
plantillas. Se reconsiderará si un colegio pide su formato propio de proyecto
STEAM; hoy nadie lo ha pedido.

El tipo llega hasta `coloresDe()`, y esa es la parte que arregla un fallo real:
antes `coloresDe` devolvía null en cuanto el modo era `plantilla`, así que un
STEAM de un colegio con plantilla salía **sin marca ninguna** —ni plantilla, ni
logo, ni colores—, peor que si no hubiera configurado nada. Compárense
`docs/qa/word/15-steam-plantilla.pdf` (encabezados vacíos) y
`docs/qa/word/16-steam-colegio.pdf` (granate y dorado del colegio, documento
completo).

### Dentro de la plantilla del colegio no entra nuestra identidad

Acotar el modo no bastaba. Lo que `patchDocument` insertaba —tablas, encabezados
de sección, barras de momento— seguía saliendo con el **navy y el azul de
SciVerse**, porque `coloresDe` devolvía `null` en modo plantilla y `null`
significa «la paleta de SciVerse». El resultado: cabeceras azul marino y barras de
momento de otro producto incrustadas en el membrete de la institución. Es
exactamente lo que el docente quiso evitar al subir su documento.

Ahora `coloresDe` devuelve `{ neutra: true }` y `tema.js` tiene una tercera
paleta:

| rol | SciVerse | colegio | **neutra** |
| --- | --- | --- | --- |
| texto, titulares | `1A1A1A` / `0B2E4F` | ídem / primario | `000000` |
| acento, reglas | `1C74BC` | acento | `000000` |
| apoyos | `6B7C8C` | `6B7C8C` | `444444` |
| borde de tabla | `BBDBF0` | `BBDBF0` | `auto` |
| relleno de cabecera, celda, fondo, rúbrica, aviso | varios | varios | **`null`** |

Los `null` no son huecos por rellenar: son la instrucción de **no pintar
fondo**. `core.js` omite el nodo `w:shd` entero cuando los ve, porque un `w:shd`
con `fill` vacío no es lo mismo que no tener `w:shd`. Y `borde: "auto"` es el
automático de Word, que respeta el tema del documento anfitrión.

Tampoco se usan los colores del colegio ahí: ya los trae su plantilla, y
deducirlos de dos campos de configuración daría un segundo azul parecido pero
distinto, que canta más que el neutro.

Medido sobre un anfitrión sin un solo color, para que todo hexadecimal de la
salida sea nuestro:

```
A · paleta de SciVerse     0B2E4F, 1C74BC, EAF4FB, 1A1A1A, FFFFFF, BBDBF0, 6BB3E0
B · colores del colegio 7A1F2B, C9A227 + los no sobreescritos
C · modo plantilla      NINGUNO   ·   0 nodos <w:shd>   ·   54 bordes «auto»
```

En C el único hexadecimal que queda en todo el contenido es `000000`. El
resultado sobre una plantilla de colegio realista está en
`docs/qa/word/20-clase-completa-en-plantilla.docx`: granate, dorado y Georgia
son del centro; lo nuestro va en negro.

Tres cosas hubo que separar para que esto fuera posible:

- **`cabecera` y `tintaCabecera`** son ahora roles propios, distintos de `navy`
  y `blanco`. Con un solo valor para «color del texto» y «relleno detrás» no
  había forma de decir «mismo texto, sin fondo».
- **`celda`** (fondo blanco de una celda normal) se separó de `blanco` (tinta).
  Un blanco explícito dentro de una plantilla con fondo tintado abre agujeros
  blancos en el diseño del colegio.
- **`THEME` y `TINTA_SOBRE_RUBRICA` eran objetos literales**, es decir FOTOS de
  la paleta de SciVerse tomadas al importar el módulo. `THEME.border` seguía siendo
  el azul de SciVerse aunque el documento fuera de un colegio con su marca, y el
  blanco de «Logro destacado» habría sido texto invisible sin relleno. Los dos
  leen ahora la paleta viva.

La ruta de plantilla aplica la paleta **ella misma**: no pasa por
`buildDocument`, así que sin su propio `aplicarMarca` los bloques se construían
en SciVerse por mucho que el modo dijera otra cosa.

Dos huecos más que se cerraron por el camino:

- **La clase completa no recogía la marca.** `buildCompleteClass` ignoraba
  `marca` por completo —no la desestructuraba siquiera—, así que se armaba sin
  logo y sin colores aunque el colegio los tuviera puestos. Ahora aplica y
  revierte con el mismo `finally` que `buildDocument`.
- **Una plantilla que falla a mitad se llevaba también los colores.** Si el
  fichero está y el plan está, `almacen.js` ya no puede degradar nada; si aun
  así `patchDocument` no puede con él, el repuesto salía en formato de SciVerse.
  `marcaSinPlantilla()` baja el modo a `colegio` en el `catch`: perder la
  plantilla no cuesta además el logo.

### Cómo llega la marca al exportador

`lib/docx/` **no importa Supabase** — lo usan las pruebas de OOXML, que corren
en node sin sesión. Y enhebrar la marca por los doce puntos de descarga
significaría que el que se olvidara exportaría sin ella.

En su lugar, `main.jsx` registra el resolvedor una vez
(`configurarMarca(marcaVigente)`). Sin registrar, todo sale en formato de SciVerse,
que es exactamente lo que deben hacer las pruebas.

Los colores se aplican con una **paleta activa** en `tema.js`: `COLOR` es una
vista sobre ella, así que las trescientas líneas de maqueta que ya escribían
`COLOR.navy` recogen el color correcto sin tocarlas. Se aplica antes de
construir y se deshace en un `finally`: un documento que falle a medias no
puede dejar los colores de un colegio pegados al siguiente.

### Límite conocido: ficheros huérfanos

Borrar un docente elimina su fila de `export_branding` por `on delete cascade`,
pero **no** su logo ni su plantilla: Storage vive en otro esquema y el cascade
no lo alcanza. Se acepta a propósito — son como mucho dos ficheros de 5 MB por
docente eliminado. El inspector `supabase/inspect/012_verify_export_branding.sql`
los cuenta (consulta 5); si algún día pesan, se resuelve con una tarea
programada o un botón en el panel de administración, no con complejidad ahora.

## QA reproducible

```sh
node scripts/word-qa.mjs
npx vitest run tests/word.test.js
```

El primer comando genera doce archivos en `docs/qa/word/`: de `01-sesion.docx` a
`10-sopa-letras.docx`, más dos casos reales:

- `11-sesion-dpcc.docx` — Secundaria 3.º con el área de nombre más largo del
  catálogo (DPCC), una IE de 78 caracteres y un título de 111.
- `12-laboratorio.docx` — la guía de laboratorio con sus dos partes.
- `13-clase-completa-plantilla.docx` — la clase completa dentro de la plantilla
  base, con las diecisiete marcas resueltas.
- `15-steam-plantilla.docx` — el mismo relleno sobre un STEAM, que es lo que
  motivó acotar el modo: cuatro encabezados del colegio se quedan vacíos.
- `16-steam-colegio.docx` — ese mismo STEAM como se descarga hoy: modo
  `colegio`, con el granate y el dorado del centro.
- `17-clase-completa-colegio.docx` — la clase completa recogiendo la marca, que
  antes ignoraba.
- `21-guia-observacion.docx` y `22-cuestionario.docx` — los dos tipos que el
  servidor sabía generar y ninguna pantalla ofrecía, ya enrutados.
- `19-plantilla-colegio-ejemplo.docx` — una plantilla de colegio ficticia, con
  identidad bien distinta de la nuestra: granate, dorado y Georgia.
- `20-clase-completa-en-plantilla.docx` — la misma, ya rellena. Sirve para ver
  de un vistazo qué pone el colegio y qué ponemos nosotros.

La carpeta ya está ignorada por Git. Todos los datos son ficticios y reproducen
la FORMA REAL que entrega la generación —`componerSesion()`, `PROJECT_SCHEMA` y
el esquema `lab_guide`—, no una versión reducida.

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
