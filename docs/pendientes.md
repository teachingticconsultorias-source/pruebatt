# Pendientes abiertos a propósito

Cosas que se decidieron NO hacer, con el motivo. No son olvidos: cada una se
evaluó y se dejó fuera por una razón concreta. Este fichero existe para que esa
razón no se pierda y para que nadie las «arregle» sin saber por qué estaban así.

Ordenadas por lo que costaría si se ignoran.

---

## Riesgo real, sin resolver

### 1 · `thinkingLevel` sin fijar en los recursos de `generate-session-resource.js`

Rúbrica, lista de cotejo, escala de valoración, guía de observación y
cuestionario corren con el razonamiento de Gemini en `medium` —el valor por
defecto del modelo— y un tope de **4500 tokens**.

Es la combinación exacta que truncó el módulo `sequence` en producción:
`medium` gastó 2901 tokens de razonamiento y a la salida le quedaron 1599. Una
rúbrica con ocho criterios y descriptores largos está en ese rango.

No se tocó porque cambiar presupuestos de herramientas que hoy funcionan estaba
fuera del alcance de los bloques en que se detectó. `lab_guide` es el único tipo
de ese endpoint que declara su nivel (`low`, tope 6000, medido).

**Qué haría falta:** medir un ejemplar completo de cada tipo como se hizo con
`sequence` y `lab_guide` —contar caracteres, dividir por 4,33— y fijar tope y
nivel por tipo. Media jornada.

---

## Decisiones de producto, esperando decisión

### 2 · `lab_teacher_guide` declarada y sin conectar

La guía de laboratorio es Free **completa**, incluida la Guía del Docente con su
solucionario y su rúbrica. Se decidió así para no dejar Ciencia y Tecnología
—el área por defecto de la aplicación— peor servida que las demás.

La capacidad está declarada en `api/_lib/entitlements.js` y probada
(`permiteGuiaDocente()`), pero **nadie la llama**. Moverla a Pro es llamarla
desde el endpoint y recortar la respuesta ahí; no hay que tocar el esquema.

### 3 · «Estándar de aprendizaje» no se genera

Las plantillas oficiales de sesión y de laboratorio reservan una fila para la
copia TEXTUAL del estándar del ciclo según el CNEB. SciVerse no tiene ese dato y
pedírselo al modelo sería invitarle a redactar normativa.

La fila se omite entera —ni «Por completar» ni «N/A»—. Las tres salidas posibles:
una tabla local por ciclo y competencia, un campo que rellene el docente, o
dejarlo fuera.

### 4 · Ciencia y Tecnología sólo tiene la plantilla genérica del pack

De las 11 áreas de Secundaria, diez traen su plantilla con sus procesos
didácticos propios. `CIENCIA Y TECNOLOGIA.docx` **no es de Ciencia y
Tecnología**: es la plantilla maestra genérica, con marcadores
`Proceso 1` / `Proceso 2`. Siendo el área por defecto, es la laguna más visible
del pack. El servidor sí tiene sus procesos de indagación en
`DIDACTIC_PROCESSES`, así que el documento sale correcto; lo que falta es la
referencia visual.

### 5 · Tutoría sin herramienta

El pack entrega una plantilla completa de Sesión de Tutoría (14 secciones,
estructura propia: indicadores actitudinales, «después de la hora de tutoría»,
ficha de observación). No hay herramienta que la genere. El sistema visual ya
está listo para ella.

---

## Aceptado como está

### 6 · `docx_remove_watermark` inerte en `plans.features`

Se sembró en la migración 009 y nunca se usó: el exportador no pinta ninguna
marca de agua y `permiteQuitarMarca()` no se llamaba desde ningún endpoint. La
función se retiró del código en el bloque de Personalizar export; la clave
**sigue en producción**, inerte.

La migración 012 trae el `update` para limpiarla, **comentado**. Se dejó así
para no alterar datos de producción en la misma migración que crea la tabla y
el bucket. Descomentar y ejecutar cuando se quiera.

### 7 · Ficheros huérfanos en `export-templates`

Borrar un docente elimina su fila de `export_branding` por `on delete cascade`,
pero **no** su logo ni su plantilla: Storage vive en otro esquema y el cascade
no lo alcanza. Son como mucho dos ficheros de 5 MB por docente eliminado.

El inspector `supabase/inspect/012_verify_export_branding.sql` los cuenta
(consulta 5). Si algún día pesan, se resuelve con una tarea programada o un
botón en el panel de administración. Hoy: 0.

### 8 · Sin vista previa del `.docx` subido

Renderizar un `.docx` en el navegador exige una dependencia pesada
(`docx-preview`, `mammoth`) y con plantillas de colegio daría una aproximación
poco fiel. En su lugar se enseña nombre, peso y la lista de marcas `{{...}}`
reconocidas, que es lo que de verdad decide si la plantilla va a funcionar.

### 9 · La cuadrícula del gráfico se parte entre páginas

En la Ficha del Estudiante de laboratorio, el papel milimetrado de 16×8 se
reparte entre dos páginas. Forzar un salto antes crearía media página en blanco
—el defecto que se corrigió en los anexos de la sesión—. Si se prefiere entera,
se baja a 6 filas y cabe.

### 10 · Orientación adaptativa de rúbrica: medida y descartada

Con descriptores de 450 caracteres caben **2,4 filas por página en vertical y
2,4 en horizontal**: el ancho extra se compensa con la altura perdida. Cambiar a
apaisado según densidad no aportaría nada. Queda documentado para no volver a
plantearlo.

---

## Código muerto o inalcanzable

### 11 · `SessionNextFlow.jsx` y `SessionResourcesPanel.jsx` no están importados

Ningún componente los renderiza. Con ellos quedan inalcanzables desde la
interfaz la **Guía de observación** y el **Cuestionario**, que sí existen en el
exportador, en el endpoint y en los tipos de la biblioteca. O se enrutan o se
retiran; mantenerlos a medias confunde al siguiente que los lea.

### 12 · `SteamGenerator` acepta cuatro `documentType` y sólo uno se usa

El componente contempla `session`, `project`, `rubric` y `checklist`, pero el
único enrutado es `session`. Las otras tres ramas no son alcanzables.

### 13 · Cinco generadores legacy sin ruta

`CrosswordGenerator`, `LearningUnitGenerator`, `WorksheetGenerator`,
`ReadingGenerator` y `EvaluationSheetGenerator` están definidos en `App.jsx` y
no se referencian desde ninguna parte. Usan la ruta antigua de exportación por
Markdown (`downloadText`).

---

## Infraestructura

### 14 · No hay tabla de control de migraciones

Este proyecto no registra en ninguna parte qué migraciones se han aplicado, y
las aplica a mano desde el editor SQL de Supabase. Eso hizo imposible saber
—desde el repositorio— si la 011 estaba puesta; hubo que consultar el CHECK en
producción.

Las migraciones **009, 010, 011 y 013 no tienen inspector**. La 012 sí
(`supabase/inspect/012_verify_export_branding.sql`). Escribir los que faltan, o
adoptar una tabla de control, evitaría repetir esa situación.

### 15 · Cobertura de plantillas por nivel

- **Primaria:** falta plantilla oficial de Educación para el Trabajo, que sí
  está en el catálogo de la aplicación.
- A la inversa, el pack trae plantillas de Primaria para Educación Física,
  Educación Religiosa, Inglés y Castellano L2, áreas que SciVerse **no ofrece**
  en ese nivel. El material sugiere un catálogo de Primaria más amplio que el
  actual (6 áreas).

### 16 · Borrador local del formulario y aviso al salir

Evaluados en el bloque de endurecimiento de UX y no implementados: el estado ya
sobrevive al fallo dentro de la pantalla, y ambos tocan el ciclo de vida del
formulario. Se propusieron para decidir aparte.
