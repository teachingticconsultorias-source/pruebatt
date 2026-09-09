# QA manual · herramientas y sugerencias de Kantu

Los 765 tests automáticos cubren datos, lógica y marcado. Lo que no pueden
cubrir es lo que se ve: si un modal cabe en pantalla, si el teclado del móvil
tapa el textarea, o si la sugerencia que devuelve Kantu tiene sentido para el
tema que escribió la docente. Eso hay que mirarlo.

**Servir `dist/`** (`npm run build && npm run preview`), no `npm run dev`: se
prueba lo que recibe una docente.

---

## 0 · Lo que motivó este bloque

| # | Comprobación | ☐ |
|---|---|---|
| 0.1 | Sopa de letras → Tema: `HEROES DE DOTA 2` → **Sugerir con Kantu** | ☐ |
| 0.2 | **No** aparece ningún cuadro del navegador | ☐ |
| 0.3 | Aparece un modal de SciVerse con Kantu en la cabecera | ☐ |
| 0.4 | Las palabras son de Dota 2, **no** árbol / flor / hierba | ☐ |
| 0.5 | El textarea **sigue vacío** hasta pulsar «Usar palabras» | ☐ |
| 0.6 | «Cancelar» deja el formulario exactamente como estaba | ☐ |

> 0.4 es la prueba del bloque. Antes esto no llamaba a Kantu: era un
> diccionario de diez categorías y, si el tema no coincidía con ninguna,
> devolvía en silencio las palabras de «naturaleza».

---

## 1 · Sugerir con Kantu · las primeras cuatro rutas

Repetir en las cuatro. Las otras seis están en el bloque 10. En cada una, **completar primero varios campos** y
comprobar que la sugerencia los tiene en cuenta.

| Herramienta | Campos con sugerencia | Contexto que debe usar |
|---|---|---|
| Sesión de aprendizaje | Propósito · Situación · Evidencia | tema, nivel, grado, área, competencia, capacidades, región, duración |
| Rúbrica / Lista de cotejo | Evidencia | + evidencia y cantidad de criterios |
| Proyecto STEAM | Situación · Reto · Producto · Evidencias | + áreas STEAM, semanas, y **lo que ya se escribió en los otros tres** |
| Sopa de letras | Palabras | tema, grado, área, dificultad |

| # | Comprobación | ☐ |
|---|---|---|
| 1.1 | Con el tema vacío, el botón avisa «Escribe primero el tema…» en vez de quedarse muerto | ☐ |
| 1.2 | Mientras piensa, el botón dice «Buscando ideas para tu tema…» | ☐ |
| 1.3 | Si tarda más de 6 s, cambia a «Kantu sigue trabajando…» | ☐ |
| 1.4 | Pulsar el botón cinco veces seguidas lanza **una** petición (mirar la pestaña de red) | ☐ |
| 1.5 | El resto de botones «Sugerir» quedan deshabilitados mientras tanto | ☐ |
| 1.6 | «Volver a sugerir» pide otra sin cerrar el modal | ☐ |
| 1.7 | Si el campo ya tenía texto, el modal avisa de que se va a reemplazar | ☐ |
| 1.8 | Si estaba vacío, **no** aparece ese aviso | ☐ |

### La prueba de contexto (STEAM)

| # | Comprobación | ☐ |
|---|---|---|
| 1.9 | Rellenar tema, situación, reto y **producto** | ☐ |
| 1.10 | Pulsar «Sugerir» en **Evidencias** | ☐ |
| 1.11 | Las evidencias propuestas mencionan el producto que se escribió | ☐ |

> 1.11 es el segundo agujero del bloque: el prompt de STEAM enumeraba cinco
> campos a mano y «producto» no estaba, así que Kantu no lo veía nunca.

---

## 2 · Sopa de letras, completa

| # | Comprobación | ☐ |
|---|---|---|
| 2.1 | Escribir `plátano, montaña, MONTAÑA, ab, x9` y generar | ☐ |
| 2.2 | Aparece un aviso amarillo bajo el textarea explicando qué se quitó | ☐ |
| 2.3 | En la cuadrícula se lee PLATANO (sin tilde) y MONTAÑA (con Ñ) | ☐ |
| 2.4 | Ninguna celda del tablero tiene tilde | ☐ |
| 2.5 | Con dificultad **Fácil**, escribir una palabra de 12 letras: avisa que no cabe | ☐ |
| 2.6 | La lista de palabras impresa **sólo** contiene palabras que están en el tablero | ☐ |
| 2.7 | Con 14 palabras en Fácil, si alguna no encuentra sitio, se avisa | ☐ |
| 2.8 | El título respeta el tema tal cual se escribió | ☐ |
| 2.9 | Descargar en Word funciona y trae solucionario | ☐ |
| 2.10 | Descargar imagen del estudiante y del solucionario funciona | ☐ |
| 2.11 | **PDF** abre el modal «Próximamente» con la alternativa, no un cuadro del navegador | ☐ |
| 2.12 | Generar de nuevo con otras palabras produce otra cuadrícula | ☐ |

> 2.6 era un fallo real: la cuadrícula descarta en silencio las palabras que no
> encuentran hueco tras cincuenta intentos, pero la lista impresa salía de lo
> que se pidió. El estudiante buscaba palabras que no estaban.

---

## 3 · Las diez herramientas, de principio a fin

Para **cada una**: entrar → completar → generar → ver resultado → guardar →
abrir en Biblioteca → volver.

| Herramienta | Genera | Resultado | Guarda | Aparece en Biblioteca | Se reabre | Descarga |
|---|---|---|---|---|---|---|
| Clase completa | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Sesión de aprendizaje | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Proyecto STEAM | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Rúbrica de evaluación | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Lista de cotejo | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Escala de valoración | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Ficha de trabajo | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Ficha de lectura | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Sopa de letras | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Reto grupal | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

> La sopa de letras ya se guarda, pero **requiere aplicar
> `supabase/migrations/011_wordsearch_material.sql`**. Ver el bloque 11: sin
> la migración el guardado falla a propósito, con un mensaje preciso.

| # | Comprobación | ☐ |
|---|---|---|
| 3.1 | «Unidad de aprendizaje» abre el modal «Próximamente», no un formulario | ☐ |
| 3.2 | Ningún botón visible se queda sin hacer nada al pulsarlo | ☐ |
| 3.3 | En la sesión, la tarjeta «Escala de valoración» lleva a Herramientas y **no** dice «Próximamente» | ☐ |

---

## 4 · Biblioteca

| # | Comprobación | ☐ |
|---|---|---|
| 4.1 | Un material recién generado aparece sin recargar | ☐ |
| 4.2 | Se abre y muestra el contenido completo | ☐ |
| 4.3 | Duplicar crea «Copia de …» | ☐ |
| 4.4 | Eliminar **pide confirmación** antes de borrar | ☐ |
| 4.5 | Cancelar en esa confirmación no borra nada | ☐ |
| 4.6 | Con la red cortada al guardar, se avisa del fallo y se ofrece descargar | ☐ |
| 4.7 | Ese fallo **nunca** se muestra como «guardado» | ☐ |

> 4.6/4.7: en el proyecto STEAM el fallo de guardado se tragaba en un
> `console.error` y no se decía nada. Ahora se avisa y se ofrece la descarga.

---

## 5 · Modales y pantallas largas

| # | Comprobación | 1366×768 | 1440×900 | 1920×1080 |
|---|---|---|---|---|
| 5.1 | Modal de reto grupal: la cabecera se ve siempre | ☐ | ☐ | ☐ |
| 5.2 | …y los botones del pie también, sin bajar | ☐ | ☐ | ☐ |
| 5.3 | La X de cerrar está siempre accesible | ☐ | ☐ | ☐ |
| 5.4 | Sólo scrollea el contenido, no la página de detrás | ☐ | ☐ | ☐ |
| 5.5 | Ningún modal es más alto que la ventana | ☐ | ☐ | ☐ |
| 5.6 | Escape cierra el modal | ☐ | ☐ | ☐ |
| 5.7 | Al cerrar, el foco vuelve al botón que lo abrió | ☐ | ☐ | ☐ |
| 5.8 | Tabular dentro del modal no se escapa al fondo | ☐ | ☐ | ☐ |
| 5.9 | Ninguna vista provoca scroll horizontal | ☐ | ☐ | ☐ |
| 5.10 | Resultado de sesión completa: se lee entero sin cortes | ☐ | ☐ | ☐ |

> 5.2 era el defecto: `.sv-modal` entero tenía `overflow-y: auto`, así que en
> 768 px de alto la cabecera y los botones se iban con el scroll.

---

## 6 · Móvil

Chrome de Android o emulador **con modo táctil**.

### 360 × 800

| # | Comprobación | ☐ |
|---|---|---|
| 6.1 | El modal de sugerencia sube desde abajo y se lee entero | ☐ |
| 6.2 | Los botones del modal ocupan el ancho y miden al menos 44 px | ☐ |
| 6.3 | Ningún botón queda bajo la barra de gestos del sistema | ☐ |
| 6.4 | Al abrir el teclado sobre un textarea, el campo sigue visible | ☐ |
| 6.5 | El textarea de la sopa es usable con el teclado abierto | ☐ |
| 6.6 | Los toasts no tapan la barra de navegación inferior | ☐ |
| 6.7 | Modal de reto grupal: el pie no queda bajo la barra del navegador | ☐ |
| 6.8 | Ningún formulario provoca scroll horizontal | ☐ |
| 6.9 | Formularios de las diez herramientas: todos los campos alcanzables | ☐ |

### 375 × 812 · 390 × 844 · 430 × 932

| # | Comprobación | 375 | 390 | 430 |
|---|---|---|---|---|
| 6.10 | Todo lo anterior | ☐ | ☐ | ☐ |
| 6.11 | El resultado de una sesión se lee sin zoom | ☐ | ☐ | ☐ |
| 6.12 | La cuadrícula de la sopa cabe a lo ancho | ☐ | ☐ | ☐ |

---

## 7 · Confirmaciones

| # | Comprobación | ☐ |
|---|---|---|
| 7.1 | **Cerrar sesión** pregunta antes | ☐ |
| 7.2 | «Seguir trabajando» no cierra la sesión | ☐ |
| 7.3 | **Eliminar** de Biblioteca pregunta antes | ☐ |
| 7.4 | Navegar entre secciones **no** pregunta | ☐ |
| 7.5 | Abrir una herramienta **no** pregunta | ☐ |
| 7.6 | Aceptar una sugerencia **no** pregunta | ☐ |
| 7.7 | Guardar un material **no** pregunta | ☐ |

---

## 8 · Errores

| # | Comprobación | ☐ |
|---|---|---|
| 8.1 | Cortar la red y pedir una sugerencia: mensaje en español, sin códigos | ☐ |
| 8.2 | Se puede reintentar después de restaurar la red | ☐ |
| 8.3 | Con la sesión caducada, dice que hay que volver a entrar | ☐ |
| 8.4 | En ningún mensaje aparece `undefined`, `[object Object]`, `HTTP 500` ni JSON | ☐ |
| 8.5 | Agotar el límite semanal: mensaje sobre el plan, sin jerga | ☐ |

---

## 9 · Kantu visual

| # | Comprobación | ☐ |
|---|---|---|
| 9.1 | El avatar de Kantu aparece en la cabecera del modal, pequeño | ☐ |
| 9.2 | Respira suavemente y la chispa destella de vez en cuando | ☐ |
| 9.3 | Con «reducir movimiento» activado en el sistema, se queda quieto | ☐ |
| 9.4 | No hay ninguna ilustración a pantalla completa en los modales | ☐ |

---

## Registro

| Fecha | Navegador / dispositivo | Bloques probados | Incidencias |
|---|---|---|---|
| | | | |

---

## 10 · Kantu en las seis herramientas restantes

Completar primero el contexto de cada formulario y comprobar que la
sugerencia lo tiene en cuenta.

| Herramienta | Boton | Que propone | Donde cae al pulsar «Usar» | ☐ |
|---|---|---|---|---|
| Rubrica | junto a «Criterios de evaluacion» | 4-8 criterios graduables | `criteriosBase` (la generacion los conserva) | ☐ |
| Lista de cotejo | junto a «Indicadores observables» | 5-10 items de Si/No | `criteriosBase` | ☐ |
| Escala de valoracion | junto a «Conducta o desempeño a observar» | la conducta a observar | campo Evidencia | ☐ |
| Ficha de trabajo | junto a «Contexto o indicacion adicional» | el enfoque de la ficha | campo Contexto | ☐ |
| Ficha de lectura | idem | el enfoque de la lectura | campo Contexto | ☐ |
| Reto grupal | «Sugerir dinamica» | una dinamica de equipo | **nada: solo lectura** | ☐ |

| # | Comprobación | ☐ |
|---|---|---|
| 10.1 | En las seis, sin tema el boton avisa «Escribe primero el tema…» | ☐ |
| 10.2 | Mientras piensa, el boton dice «Buscando ideas para tu tema…» | ☐ |
| 10.3 | Pulsar cinco veces lanza **una** peticion (pestaña de red) | ☐ |
| 10.4 | Rubrica: los criterios salen numerados en el modal | ☐ |
| 10.5 | Rubrica: «Usar estos criterios» los deja listados bajo el boton | ☐ |
| 10.6 | Rubrica: al generar, el instrumento **conserva** esos criterios | ☐ |
| 10.7 | Cotejo: los indicadores se responden con Si o No, no son graduables | ☐ |
| 10.8 | Reto grupal: el modal solo ofrece «Entendido», sin «Cancelar» ni «Usar» | ☐ |
| 10.9 | Reto grupal: cerrar el modal **no** cambia el tema escrito | ☐ |
| 10.10 | Fichas: la sugerencia es un enfoque, **no** la ficha generada | ☐ |
| 10.11 | En las seis, «Cancelar» deja el formulario intacto | ☐ |
| 10.12 | Ninguna de las seis descuenta creaciones (mirar el contador) | ☐ |

---

## 11 · Sopa de letras → Mi biblioteca

> **Requiere aplicar `supabase/migrations/011_wordsearch_material.sql`.**
> Sin ella el guardado falla a proposito, con el mensaje de la fila 11.2.

### Antes de aplicar la migracion

| # | Comprobación | ☐ |
|---|---|---|
| 11.1 | Generar una sopa y pulsar «Guardar en mi biblioteca» | ☐ |
| 11.2 | Sale «Este tipo de material todavia no esta habilitado en la base de datos» | ☐ |
| 11.3 | **No** dice «Guardado en tu biblioteca» | ☐ |
| 11.4 | Se ofrece reintentar y descargar en Word | ☐ |
| 11.5 | Las descargas (Word, imagen, solucionario) siguen funcionando | ☐ |

### Despues de aplicar la migracion

| # | Comprobación | ☐ |
|---|---|---|
| 11.6 | Guardar muestra «Guardado en tu biblioteca» | ☐ |
| 11.7 | Aparece en Mi biblioteca rotulada **«Sopa de letras»**, no «Ficha de trabajo» | ☐ |
| 11.8 | El filtro por tipo la encuentra en «Sopas» | ☐ |
| 11.9 | Al abrirla se ve la **misma** cuadricula, no otra distinta | ☐ |
| 11.10 | Se ve la lista de palabras utilizada | ☐ |
| 11.11 | «Ver solucionario» resalta las palabras en el tablero | ☐ |
| 11.12 | «Ocultar solucionario» las devuelve a normal | ☐ |
| 11.13 | Una palabra que no cupo **no** aparece en la lista guardada | ☐ |
| 11.14 | Duplicar y eliminar funcionan como con el resto de materiales | ☐ |
| 11.15 | En movil la cuadricula cabe a lo ancho, sin scroll horizontal | ☐ |

> 11.9 es la prueba de que se guarda y no se regenera: regenerar daria otra
> cuadricula y el solucionario ya impreso dejaria de coincidir.
