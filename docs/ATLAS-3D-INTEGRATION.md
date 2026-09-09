# Atlas 3D en SciVerse · integración, licencias y arquitectura

Documento de referencia del bloque **Laboratorios / Atlas 3D**. Recoge lo que se
encontró al auditar los dos proyectos de referencia, qué se reutilizó, qué no y
por qué, y cómo está montado lo que hay ahora en el repositorio.

Todas las afirmaciones sobre licencias citan el fichero concreto donde se leyó
el dato. No hay ninguna conclusión legal inventada: donde el origen no dice
nada, aquí tampoco.

---

## 1. Auditoría de Human Atlas

**Repositorio:** <https://github.com/ashemag/human-atlas>
**Aplicación:** <https://human-atlas-seven.vercel.app/>

| Aspecto | Hallazgo |
|---|---|
| Licencia del código | **MIT** — `LICENSE`: «MIT License / Copyright (c) 2026 ashemag» |
| Stack | Next.js (`app/`) + React + **Three.js** + shadcn/ui; Node ≥ 22.13; desplegado en Vercel |
| Lenguaje | TypeScript |
| Arquitectura | `app/page.tsx` (interfaz), `app/scene.tsx` (escena 3D), `app/anatomy.ts` (datos), `app/model-download.ts` (descarga/descompresión), `hooks/use-mobile.ts`, ~60 componentes en `components/ui/` |
| Formato de modelos | **No es glTF ni GLB.** Empaquetado binario propio: `atlas.json` (manifiesto) + 15 bloques `body-N.bin` |
| Compresión | Gzip por bloque (`body-N.bin.gz`), descomprimido en el navegador con `DecompressionStream`. **No usa Draco ni Meshopt** |
| Peso de los assets | 15 × `.bin` = 59,5 MB sin comprimir · 15 × `.bin.gz` = **31,4 MB** medidos · `atlas.json` 1,3 MB. Repositorio completo ≈ 104 MB. Su README habla de «approximately 33 MB of compressed geometry», que cuadra sumando el manifiesto |
| Contenido | 2.234 mallas seleccionables, 15 sistemas, 3.432 conceptos FMA, 2.288.268 triángulos |
| Licencia de los datos | **CC BY 4.0** — `README.md`: «Anatomy data … CC BY 4.0 license», hay que «preserve the attribution when redistributing it» |
| Origen de los datos | `public/ATTRIBUTION.md`: BodyParts3D 4.0, © The Database Center for Life Science; licencia <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html>; descarga `isa_BP3D_4.0_obj_99.zip` |
| Cita exigida | Mitsuhashi *et al.* (2009), <https://doi.org/10.1093/nar/gkn613> |
| Limitaciones que declara | «does not represent every human structure or variation»; «This is an educational explorer, not a diagnostic or surgical tool»; «Physical-device performance and real multitouch hardware have not been tested» |

### Formato binario, en detalle

Cada entrada de `atlas.json` trae desplazamientos en bytes dentro de su bloque:

```
positions   Float32   vertexCount * 3
normals     Int16     vertexCount * 3      (normalizado en la GPU)
indices     Uint32    indexCount
```

Verificado aritméticamente contra el manifiesto real: para `FJ1252`
(883 vértices, 4.272 índices) los desplazamientos 0 → 10.596 → 15.896 → 32.984
sólo cuadran con esa combinación de tipos.

---

## 2. Auditoría de OMF Atlas

**Repositorio:** <https://github.com/choxos/OMFAtlas>
**Aplicación:** <https://omfatlas.xera.ac/>

| Aspecto | Hallazgo |
|---|---|
| Licencia del código | **MIT** — `LICENSE`: «MIT License / Copyright (c) 2026 Ahmad Sofi-Mahmudi» |
| Stack | JavaScript sin framework + **Three.js**, empaquetado con Vite; Node ≥ 22.13 |
| Arquitectura | `src/main.js` (93 KB), `src/viewer.js` (46 KB), `src/style.css` (159 KB), más módulos de dominio (`dental-models.js`, `schematic-anatomy.js`, `embryology.js`, `endodontics.js`, `periodontium.js`) y scripts de importación en `scripts/` |
| Formato de modelos | El mismo esquema `.bin` + manifiesto JSON |
| Peso de los assets | `facial.bin` 16,4 MB · `dental.bin` 10,3 MB · `open-full-jaw.bin` 8,3 MB · `toothfairy.bin` 8,2 MB · 200+ ficheros de alta resolución · repositorio ≈ 68 MB |
| Contenido | 643 mallas de BodyParts3D 4.0 + 77 estructuras esquemáticas propias; 28 piezas permanentes y 615 mallas de cabeza y cuello |

### Licencias de la geometría (de `README.md` y `public/models/dental/ATTRIBUTION.md`)

| Fichero | Origen | Licencia | Restricción |
|---|---|---|---|
| mallas de cabeza y cuello | BodyParts3D 4.0 | **CC BY 4.0** | Atribución |
| `facial.bin` | adaptación de BodyParts3D 3.0 | **CC BY-SA 2.1 Japan** | ShareAlike |
| `dental.bin` | Diaz *et al.* (2024), <https://doi.org/10.17632/xjsx7nfhj8.1> · Kang (2024), <https://doi.org/10.6084/m9.figshare.24591537.v1> | **CC BY 4.0** | Atribución |
| `open-full-jaw.bin` | Gholamalizadeh *et al.* (2022), <https://doi.org/10.1016/j.cmpb.2022.107009> | **CC BY-NC-SA 4.0** | **NonCommercial** + ShareAlike |
| `toothfairy.bin` | Bolelli *et al.*, ToothFairy3 / MICCAI 2025 | **CC BY-SA 4.0** | ShareAlike |

Su propio `ATTRIBUTION.md` avisa de dos cosas que pesan aquí:

- sobre `open-full-jaw.bin`: «Cannot be used for commercial advantage;
  restriction transfers to derivatives»;
- sobre las mallas simplificadas: son derivados y «must be distributed under the
  same license their source carries»;
- y, en general: «Repository's MIT license covers code only, never these assets».

---

## 3. Qué se reutilizó y qué no

### Riesgo de uso comercial

SciVerse **es** un producto comercial: tiene un plan Pro de pago. Eso descarta
sin discusión cualquier material marcado NonCommercial, y hace que ShareAlike
sea un compromiso que no conviene adquirir para un asset accesorio.

| Elemento | Decisión | Motivo |
|---|---|---|
| Pack BodyParts3D 4.0 (`atlas.json` + 15 `.bin.gz`, 32,7 MB) | **Reutilizado** | CC BY 4.0: uso comercial permitido con atribución |
| Esquema del formato binario y la lógica de descompresión de `model-download.ts` | **Reimplementado** en `lib/atlas/carga.js` | Código MIT; se cita la autoría en el fichero |
| `SYSTEMS[].description` y `EXPLANATIONS` de `app/anatomy.ts` (human-atlas) | **Traducido** a `lib/atlas/textos-anatomia.es.js` | Texto MIT; se cita autoría y licencia en el fichero y en la ficha |
| `topics` de `src/content.js` (OMFAtlas) — 5 temas con sus fuentes NCBI | **Traducido** al mismo fichero | Texto MIT; se conservan las referencias bibliográficas |
| `toothNumber()` de `src/content.js` (OMFAtlas) — notación FDI | **Adaptado** en `lib/atlas/metadatos.js` | Algoritmo MIT; se cita la autoría |
| `MASTICATORY` de OMFAtlas | **No usable** | Sus 14 identificadores FMA no existen en BodyParts3D 4.0 |
| `schematic-anatomy.js` y sus 36 notas (OMFAtlas) | **No reutilizado** | Describen geometría propia de OMFAtlas que aquí no se sirve |
| Interfaz, componentes y CSS de Human Atlas | **No reutilizados** | Están en inglés, con shadcn/ui y tokens ajenos. El encargo pedía que se viera nativo de SciVerse |
| Interfaz y `src/` de OMFAtlas | **No reutilizados** | Mismo motivo; además es JS sin framework y SciVerse es React |
| `open-full-jaw.bin` | **Descartado** | CC BY-NC-SA 4.0 — NonCommercial |
| `toothfairy.bin` | **Descartado** | CC BY-SA 4.0 — ShareAlike sobre derivados |
| `facial.bin` | **Descartado** | CC BY-SA 2.1 Japan — ShareAlike sobre derivados |
| `dental.bin` | **No incorporado** | Es CC BY 4.0 y sí podría usarse, pero resultó innecesario: ver abajo |

### Por qué el atlas maxilofacial no necesitó los datasets de OMF

El README de OMFAtlas declara que sus mallas de cabeza y cuello **son
BodyParts3D 4.0** (643 de ellas). Filtrando el pack que ya se descargó por
región anatómica salen **642 estructuras**, incluidas las **28 piezas dentarias
permanentes** y las dos encías.

El filtro es geométrico y tiene dos condiciones, no una:

```
y_min > 1,38 m           por encima del cuello, en un modelo de 1,73 m
|x| máx ≤ 0,15 m         y sin separarse del eje más que la anchura del cuello
```

Sólo con la altura entraban el supraespinoso, el trapecio transverso y las ramas
toracoacromiales: hombro, no cabeza. Con las dos condiciones quedan fuera esas
diez y siguen dentro la clavícula y el platisma, que sí son referencias
cervicales.

Es decir: la misma cobertura anatómica, con una sola licencia limpia, sin
ShareAlike, sin NonCommercial y sin 35 MB adicionales.

**Lo que este pack no tiene.** Los músculos de la masticación —masetero,
temporal, pterigoideos y buccinador— **no existen en BodyParts3D 4.0**. Se
comprobó buscando por nombre y por identificador FMA: los catorce que OMFAtlas
lista en su `MASTICATORY` no están en el manifiesto. Ésa es precisamente la
razón por la que OMFAtlas añade 77 estructuras esquemáticas propias. En el atlas
oral de SciVerse, la categoría «Músculos» contiene los 102 músculos de cabeza y
cuello que sí trae el pack —extraoculares, suprahioideos, infrahioideos,
linguales, faríngeos—, pero no los masticadores. Está en los pendientes.

### Atribución obligatoria

CC BY 4.0 exige conservar la atribución al redistribuir. Se cumple en tres
sitios:

1. `public/models/ATRIBUCION.md`, junto a los propios ficheros;
2. dentro del producto, en el panel de información de cada atlas
   (`T.atribucionTexto` en `lib/atlas/i18n.es.js`), con enlace a la licencia;
3. en este documento.

### Lo que conviene no copiar

- Los assets con NC/SA de OMFAtlas, ya tratados.
- Los `components/ui/` de Human Atlas: son shadcn/ui con su propia paleta.
  Traerlos habría metido un segundo sistema de diseño en SciVerse.
- El texto de la interfaz de ambos: está en inglés y su tono no es el de una
  herramienta docente peruana.

---

## 4. Arquitectura creada

```
lib/atlas/
  i18n.es.js      Todo el texto de interfaz + nombre y color de cada sistema
  fuentes.js      Qué estructuras enseña cada atlas y cómo se agrupan
  carga.js        Descarga, descompresión, fusión de mallas y caché de sesión
  visor.js        Motor Three.js: cámara, gestos, estados y selección por rayo
  metadatos.js    Ficha de cada estructura a partir del grafo FMA
  textos-anatomia.es.js  Textos educativos traducidos, con su procedencia

components/atlas/
  AtlasShell.jsx        Armazón común: estado, responsive, pantalla completa
  AtlasCanvas.jsx       Puente React ↔ motor
  AtlasToolbar.jsx      Barra de siete acciones
  AtlasSystemsPanel.jsx Sistemas/categorías + búsqueda
  AtlasInfoPanel.jsx    Ficha de la estructura seleccionada
  AtlasMobileSheet.jsx  Hoja inferior de móvil
  AtlasLoading.jsx      Estados de carga, sin WebGL y fallo de descarga
  AtlasErrorBoundary.jsx Red de seguridad ante fallos de render
  atlas.css             Piel, sobre los tokens de SciVerse

features/atlas/
  index.jsx             lazy() + Suspense + error boundary
  human/HumanAtlas.jsx  2.234 estructuras, 15 sistemas
  omf/OmfAtlas.jsx      648 estructuras de cabeza y cuello, 7 categorías

scripts/
  atlas-lexico.es.mjs            Léxico de las 2.234 estructuras, a mano
  atlas-lexico-conceptos.es.mjs  Léxico de los 3.432 conceptos FMA, a mano
  build-atlas-es.mjs             Genera public/models/atlas-es.json

public/models/
  atlas.json            Manifiesto original de BodyParts3D 4.0, sin tocar
  atlas-es.json         { partes, conceptos } en español (generado, 256 KB)
  body-0..14.bin.gz     Geometría, 31,4 MB
  ATRIBUCION.md         Atribución exigida por CC BY 4.0
```

### Decisiones que sostienen el resto

**Una malla por bloque, no una por estructura.** 2.234 mallas serían 2.234
llamadas de dibujo por fotograma y ningún móvil lo aguanta. Se fusionan en 15
mallas y cada vértice lleva el índice de su estructura.

**El estado vive en una textura.** Una `DataTexture` de un píxel de alto guarda,
por estructura, su color y si está oculta, visible o seleccionada. Mostrar,
ocultar y aislar son escrituras en un array de floats: no se recorre la
geometría ni se reconstruye nada.

**Selección por rayo, con descarte por caja.** Lanzar un rayo contra los 2,29
millones de triángulos tarda cientos de milisegundos. Aquí primero se descarta
con las cajas envolventes que ya trae el manifiesto, se ordenan las candidatas
por distancia de entrada y se para en cuanto ninguna caja pendiente puede
contener un impacto más cercano que el mejor encontrado. Medido sobre la
geometría real: **0,20 ms por rayo**, con una media de **1,6 estructuras y
2.837 triángulos** examinados. Barato hasta para el resaltado al pasar el ratón.

**Un pack, dos atlas.** Los dos comparten manifiesto, geometría y caché de
sesión. Cambiar de atlas no descarga nada.

**Traducción en build, no en runtime.** `scripts/build-atlas-es.mjs` compone los
2.234 nombres a partir de un léxico de 614 términos traducidos a mano, aplicando
el orden del español (el inglés antepone los modificadores, el español los
pospone) y concordancia de género y número. Cobertura: **2.234/2.234 (100 %)**.
El resultado se versiona, así que es revisable y corregible a mano.

Los **3.432 conceptos FMA** se traducen igual, con un segundo léxico de 209
términos más. Los dos diccionarios están separados a propósito: las estructuras
se traducen sólo con el suyo, de modo que añadir vocabulario abstracto para los
conceptos no puede cambiar en silencio un nombre de estructura ya revisado. El
generador lo comprueba.

---

## 4 bis. La ficha de una estructura

### De dónde sale cada campo

| Campo | Origen | Cobertura |
|---|---|---|
| Nombre | `atlas-es.json`, generado del léxico | 2.234 / 2.234 |
| Sistema o categoría | `part.system` del manifiesto | 2.234 |
| Identificador FMA | `part.conceptId` | 2.234 |
| Nombre original | `part.name` | 2.234 |
| **Descripción** | `EXPLANATIONS` de human-atlas, traducido (MIT) | **6** |
| Función del sistema | `SYSTEMS[].description` de human-atlas, traducido (MIT) | 2.234 |
| Localización | Conceptos FMA de región del propio manifiesto | 1.258 |
| Grupos anatómicos | Conceptos FMA de 2 a 60 elementos | 2.218 |
| Estructuras relacionadas | Hermanas del concepto más específico | 2.208 |
| Número FDI | Regla adaptada de `toothNumber()` de OMFAtlas (MIT) | 28 |
| Tema de la región oral | `topics` de OMFAtlas, traducido (MIT) | 5 temas |
| Para el aula | Redacción propia de SciVerse | 15 sistemas |

### La regla: ninguna sección vacía

Sólo **6 estructuras** de 2.234 tienen descripción propia, porque son las únicas
para las que existe un texto en una fuente reutilizable. Las demás enseñan lo
que sí hay y callan lo que no. No se rellena con una frase genérica ni se genera
con IA: una descripción inventada en material que va a un aula es el peor
resultado posible, y además parece correcta.

### El grafo FMA como fuente de relaciones

`atlas.json` no trae sólo geometría: trae 3.432 conceptos de la Foundational
Model of Anatomy, cada uno con la lista de mallas que le pertenece. La mandíbula
aparece en 23, desde «entidad anatómica» (las 2.234) hasta «esqueleto de la
boca» (una). De ahí salen:

- **Localización** — los conceptos que son regiones del cuerpo, ordenados de lo
  general a lo concreto: *Cuerpo humano › Cabeza › Cara › Cráneo ›
  Viscerocráneo › Boca*.
- **Grupos anatómicos** — los conceptos más específicos, entre 2 y 60 mallas.
  Se dice «pertenece a» y no «es un» ni «forma parte de»: el manifiesto guarda
  a qué conceptos pertenece una malla pero **no** el tipo de relación, y
  afirmarlo sería añadir información que el dato no tiene.
- **Estructuras relacionadas** — las hermanas del concepto más específico que
  tenga compañía, limitadas al atlas que se está mirando.

Las clases de la ontología («órgano con cavidad», «componente de órgano») se
filtran: son ciertas y no sitúan nada, y ocupaban el sitio de las que sí.

---

## 5. Rendimiento

### Reparto del bundle

| Trozo | Tamaño | Gzip | Cuándo se descarga |
|---|---|---|---|
| `index.js` (principal) | 1.116,6 KB | 313,0 KB | Siempre |
| `three-*.js` | 515,6 KB | 129,1 KB | Sólo al abrir un atlas |
| `fuentes-*.js` (código del atlas) | 49,1 KB | 17,5 KB | Sólo al abrir un atlas |
| `HumanAtlas` / `OmfAtlas` | 0,26 KB c/u | — | Sólo al abrir su atlas |

**Coste añadido al bundle principal, sobre SciVerse sin atlas: +10,8 KB
(+3,9 KB gzip)** y +21,8 KB de CSS (+2,7 KB gzip). Toda la información
anatómica —fichas, grafo FMA, textos, búsqueda— vive en el trozo diferido. Ese sobrante es deliberado: la pantalla de carga y la red de
seguridad tienen que existir *antes* de que llegue el trozo diferido, o el
primer instante sería una pantalla en blanco.

`dist/index.html` no lleva `modulepreload` de Three.js: la descarga está
realmente diferida, no sólo separada en otro fichero.

### Coste en red y memoria

- Primera apertura: **32,7 MB** — 1,3 MB de manifiesto + 31,4 MB en 15 bloques
  gzip, más 105 KB de nombres en español.
- Aperturas siguientes en la misma sesión: **0 bytes**.
- Memoria retenida tras la carga: **64 MB** de geometría descomprimida
  (1.782.519 vértices, 2.288.268 triángulos), a cambio de no volver a descargar
  al cambiar de atlas.

### Rendimiento estimado

| Equipo | Estimación |
|---|---|
| Escritorio con GPU dedicada | 60 fps holgados; 15 llamadas de dibujo, 2,29 M triángulos |
| Portátil con gráfica integrada | 45–60 fps; el cuello es el relleno de píxeles, mitigado con DPR ≤ 2 |
| Tablet | Fluido con sistemas encendidos parciales |
| Móvil de gama alta | Aceptable; DPR limitado a 1,5 y sin antialias |
| Móvil de gama baja | El riesgo real es la **memoria**, no los fotogramas: 64 MB de geometría más las texturas puede provocar que el navegador descarte la pestaña |

Dos medidas bajan el coste continuo: **sólo se dibuja cuando algo cambia** (un
bucle que repinta un modelo quieto funde la batería en una clase) y el DPR se
limita en pantallas táctiles.

**Sin medir en dispositivo real.** Igual que declara el propio Human Atlas, estas
cifras son estimaciones sobre el presupuesto de triángulos y llamadas de dibujo.

---

## 6. Móvil

Bajo 900 px no se encoge el diseño de escritorio: cambia.

- Desaparecen las dos columnas; el modelo ocupa la pantalla.
- Los paneles suben como hojas inferiores, **sin velo**, para poder seguir
  girando el modelo mientras se lee la ficha. Por eso tampoco llevan
  `aria-modal` ni atrapan el foco: sería mentir sobre su comportamiento.
- Se pueden minimizar sin cerrarse, y cerrarse con Escape o con su botón.
- La barra de acciones pasa abajo, en fila, con objetivos de 44 px.
- Alturas en `dvh` y no en `vh`: con `vh`, la barra de direcciones de Chrome en
  Android tapa los últimos píxeles y los botones quedan inalcanzables.
- `env(safe-area-inset-bottom)` en la hoja y en la barra flotante.
- Gestos: arrastrar gira, dos dedos pellizcan para acercar y desplazan el punto
  de mira, un toque sin arrastre selecciona (tolerancia de 6 px).
- `touch-action: none` en el lienzo y `max-width: 100%` en todo el subárbol: no
  hay scroll horizontal en ningún ancho.

Anchos contemplados: 360×800, 375×812, 390×844, 430×932, tablet, portátil y
escritorio grande.

### Pantalla completa

Se intenta la Fullscreen API. Cuando el navegador la rechaza —Safari en iPhone
no la concede a un `div`— se cae a un modo inmersivo propio (`position: fixed`
sobre toda la ventana). Se sale con el mismo botón y con Escape, y al salir el
lienzo se redimensiona para no quedar estirado.

---

## 7. Accesibilidad

- Cada botón tiene `aria-label`; los tooltips (`title`) sólo en escritorio,
  porque en táctil el tooltip tapa el botón que se acaba de pulsar.
- `aria-pressed` en los conmutadores y `aria-expanded` en los plegables: el
  estado no depende sólo del color. Un sistema apagado además pierde saturación.
- El lienzo es enfocable y se gira con las flechas; `+` y `-` acercan y alejan.
- `focus-visible` en todo lo interactivo, con el token de foco de SciVerse.
- Escape cierra por capas: primero el modo inmersivo, luego la pantalla
  completa, luego los paneles de móvil, luego la selección.
- El progreso de carga se anuncia con `role="progressbar"` y `aria-live`.
- `prefers-reduced-motion` desactiva la animación de la hoja y las transiciones.

---

## 7 bis. Calidad de imagen

El primer sombreado tenía una sola luz hemisférica y un realce de borde. Sobre
un modelo de dos millones de triángulos eso se lee plano: dos músculos vecinos
del mismo color se funden en una sola mancha.

Lo que se cambió, y por qué:

| Antes | Ahora | Qué gana |
|---|---|---|
| Color en sRGB sumado directamente | Se linealiza (`pow(c, 2.2)`) antes de iluminar y se devuelve con gamma al final | Los medios tonos dejan de ensuciarse |
| Sin curva de exposición | ACES en su forma reducida | Las caras orientadas a la luz no se queman |
| Una luz hemisférica | Principal + relleno + ambiente hemisférico | Volumen donde antes había gris uniforme |
| Sin especular | Especular de exponente 28 al 16 % | Sugiere curvatura sin parecer plástico |
| Borde a la potencia 3, al 25 % | Potencia 3,5 al 22 %, teñido del color de la estructura | Siluetas separadas sin halo blanco |
| Normales tal cual | Se voltean si miran en contra de la cámara | Deja de haber medias estructuras negras |
| Sin resaltado al pasar el ratón | Aclarado suave, cursor de mano | Se sabe qué se va a seleccionar antes de pulsar |
| Selección de color plano | Mezcla al 55 % con el verde azulado de SciVerse + borde reforzado | Destaca sin competir con el modelo |

Lo que **no** se tocó, porque el coste no compensa en un móvil de aula: sombras
proyectadas, oclusión ambiental, mapas de entorno y suavizado en móvil. El DPR
sigue limitado a 1,5 en pantallas táctiles y a 2 en escritorio, y el bucle sigue
dibujando sólo cuando algo cambia.

---

## 8. Qué queda pendiente

1. **Los músculos de la masticación.** Masetero, temporal, pterigoideos y
   buccinador no están en BodyParts3D 4.0 (ver arriba). Es la carencia más
   visible del atlas oral. Traerlos exige otra fuente de geometría con licencia
   compatible, o modelarlos.
2. **Medir en dispositivos reales.** Las cifras de rendimiento son estimaciones.
   Falta probar en gama baja andina, que es el caso que más importa. La lista
   está en `docs/ATLAS-3D-QA.md`.
3. **Descripción por estructura.** Sólo 6 de 2.234 la tienen. Ampliarlo exige
   una fuente con licencia compatible o redacción propia revisada por alguien
   del área; lo que no se va a hacer es generarla.
4. **Localización para el 44 % restante.** 1.258 estructuras de 2.234 tienen
   conceptos de región en el manifiesto. Las demás —dientes incluidos— no, y
   por eso ese apartado no aparece en su ficha.
5. **Carga progresiva por región.** Hoy se descargan los 15 bloques aunque el
   atlas maxilofacial sólo use estructuras de tres o cuatro. Repaquetar por
   región bajaría esa primera carga de 32,7 MB a unos 8 MB para el atlas oral.
6. **Draco o Meshopt.** El pack de origen no los usa. Recomprimir la geometría
   podría bajar bastante los 32,7 MB, a cambio de un decodificador extra.
7. **Revisión odontológica de los 2.234 nombres.** La traducción está generada a
   partir de un léxico revisado y comprobada sobre una muestra, pero merece una
   pasada de alguien del área. El fichero es editable a mano.
8. **Vistas anatómicas predefinidas.** El motor ya tiene `vista("anterior")`,
   `"posterior"`, `"izquierda"`, `"derecha"` y `"superior"`; falta exponerlas en
   la interfaz.
9. **Cabeceras de caché.** Vercel sirve `/public` con revalidación; unas
   cabeceras `immutable` para los `.bin.gz` ahorrarían la ida y vuelta entre
   sesiones.
10. **`dental.bin` de OMFAtlas (CC BY 4.0).** Es legalmente reutilizable y añade
   detalle dental que BodyParts3D no tiene (pulpa, ligamento periodontal). Si
   algún día hace falta ese nivel, es el único de los cuatro que se puede
   incorporar, y habría que sumar su atribución a `ATRIBUCION.md`.

---

## 9. Cómo sustituir o ampliar los modelos

El manifiesto original no se toca, así que basta con:

1. Dejar los ficheros nuevos en `public/models/` y anotar su licencia en
   `ATRIBUCION.md`.
2. Ajustar `lib/atlas/carga.js` si cambian las rutas.
3. Regenerar los nombres: `node scripts/build-atlas-es.mjs`.
4. Añadir los términos que falten a `scripts/atlas-lexico.es.mjs` — el script
   informa de la cobertura y lista lo que no supo traducir.

Los tests de `tests/atlas.test.jsx` comprueban que en `public/models/` no
aparezca ningún fichero con licencia NonCommercial o ShareAlike.
