# 14 — Responsive y accesibilidad

Referencia: **WCAG 2.2 nivel AA** donde sea razonable para un producto educativo.

---

## PARTE I — Responsive

### 1. Estado general

| Aspecto | Estado |
|---|---|
| Enfoque | `max-width` (escritorio primero) |
| Puntos de ruptura distintos | **más de 25** |
| Media queries en `index.css` | 22 bloques |
| Barra lateral | Se oculta bajo 900 px |
| Navegación móvil | Existe (5 pestañas) |
| Meta viewport | ✅ Correcto (`index.html:5`) |
| Tablas responsive | ❌ Solo en admin, sin adaptar |
| Modales en móvil | ⚠️ Centrados, no a pantalla completa |

**La aplicación funciona en móvil.** No está rota. Los problemas son de coherencia y de detalle.

### 2. 🔴 Puntos de ruptura sin sistema

Valores encontrados en `index.css`:

```
1240 · 1180 · 1160 · 1120 · 1050 · 1000 · 960 · 920 · 900 · 850 · 800
 760 ·  700 ·  650 ·  620 ·  600 · 570 · 560 · 520 · 460 · 450 · 310 · 280 · 190 · 165
```

Más de 25 valores. Cada componente eligió el suyo cuando se escribió.

**Consecuencia observable.** Al redimensionar la ventana, las secciones se reorganizan en momentos distintos: el dashboard cambia a 1050 px, las tarjetas de creación a 720 px, la biblioteca a 900 px, los planes a 850 px. La interfaz nunca se reorganiza como un conjunto.

**Impacto en tablet.** El rango 768-1024 px —donde están muchas tablets que usan los docentes— cae entre puntos de ruptura pensados para otra cosa. Es la franja peor resuelta.

**Solución.** Cinco puntos de ruptura (`04-` §2.6) y migración a `min-width`.

**P1 · Esfuerzo M**

### 3. Problemas por dispositivo

#### 3.1 Escritorio (≥1280 px)

| Problema | Dónde | Prioridad |
|---|---|---|
| Contenido sin `max-width` en pantallas anchas: las líneas se estiran y pierden legibilidad | `.teacher-dashboard`, `.library-page` | P2 |
| Barra superior y lateral duplican marca y cerrar sesión | `App.jsx:3657`, `:3672` | P2 |
| El asistente usa `max-w-5xl` mientras otras secciones son fluidas | `App.jsx:3721` | P3 |

#### 3.2 Portátil (1024-1280 px)

| Problema | Dónde | Prioridad |
|---|---|---|
| Con la lateral de 264 px, la retícula de 4 columnas del dashboard deja tarjetas muy estrechas | `.home-v2-categories` | P2 |
| La barra de filtros de la biblioteca (buscador + 3 desplegables) se aprieta | `App.jsx:3729` | P2 |

#### 3.3 Tablet (768-1024 px) — la peor resuelta

| Problema | Dónde | Prioridad |
|---|---|---|
| **Zona muerta**: la lateral desaparece a 900 px pero la navegación móvil aparece más tarde en algunos casos | `index.css` | **P1** |
| Retículas de 4 columnas pasan a 2 en 1050 px: cada tarjeta ocupa casi media pantalla | `.home-v2-categories` | P2 |
| Los modales a `min(920px, 100%)` casi llenan la pantalla sin ser pantalla completa | `.flow-modal-card` | P2 |
| El asistente de 3 pasos apila las etiquetas de forma inconsistente | `.wizard-card` | P2 |

#### 3.4 Móvil (<768 px)

| Problema | Dónde | Prioridad |
|---|---|---|
| **Navegación móvil sin acceso a cuenta ni cerrar sesión** | `App.jsx:3683` | **P1** |
| **Texto de 7-9 px es ilegible en pantallas pequeñas** | 157 reglas en `index.css` | **P0** |
| **Tabla del admin sin adaptación**: 6 columnas provocan scroll horizontal | `AdminPanel.jsx:69` | **P1** |
| Los modales son centrados en vez de hojas inferiores | los 5 modales | P2 |
| El canvas de la sopa de letras puede desbordar | `App.jsx:1298` | P2 |
| Objetivos táctiles por debajo de 44×44 px en los iconos de la biblioteca | `App.jsx:3733` | **P1** |
| La barra de filtros de la biblioteca apila 4 controles a ancho completo | `App.jsx:3729` | P2 |
| El icono del menú es `Layers`, no una hamburguesa reconocible | `App.jsx:2528` | P3 |

### 4. Elementos con riesgo de desbordamiento

| Elemento | Riesgo | Mitigación |
|---|---|---|
| Tabla del admin (6 columnas) | **Alto** | Convertir a tarjetas bajo 768 px |
| Canvas de sopa de letras | Medio | `max-width: 100%` con escalado |
| Tablas de rúbrica en la vista previa | Medio | Contenedor con `overflow-x: auto` |
| Títulos largos de materiales | Medio | `text-overflow: ellipsis` con `title` |
| Nombres de competencias CNEB (muy largos) | Medio | Truncar con expansión |
| Barra de filtros de la biblioteca | Bajo | Agrupar tras un botón "Filtros" |

### 5. Lo que está bien

1. **Navegación móvil inferior**: patrón correcto y con la sección activa marcada.
2. **El CSS del codemod incluye reglas responsive pensadas**: `@media(max-width:720px)` colapsa retículas a una columna y oculta elementos decorativos.
3. **Reglas de impresión**: `@media print` oculta la navegación — pensado para docentes que imprimen.
4. **`meta viewport` correcto**, sin `maximum-scale` (permite el zoom, requisito WCAG).
5. **Uso de `clamp()`** en algunos títulos: `font: 700 clamp(30px,3.2vw,48px)`.

---

## PARTE II — Accesibilidad (WCAG 2.2 AA)

### 6. Resumen por principio

| Principio | Estado | Detalle |
|---|---|---|
| **Perceptible** | 🔴 Deficiente | Texto de 7-9 px; contraste insuficiente; sin `alt` descriptivo en varios casos |
| **Operable** | 🔴 Deficiente | Sin cierre por teclado en modales; foco apenas visible; sin salto al contenido |
| **Comprensible** | 🟠 Regular | Errores técnicos en crudo; etiquetas sin asociar formalmente |
| **Robusto** | 🟠 Regular | HTML semántico parcial; ARIA incompleta |

### 7. Hallazgos por criterio

#### 7.1 🔴 1.4.3 Contraste mínimo (AA) — **falla**

**Dónde.** `index.css`, múltiples reglas.

```css
.steam-card-footer span { color:#829794; font-size:7px }
.auth-company          { color:#A9CFCC; font-size:9px }
.recent-material-list small { color:#708986; font-size:7px }
.steam-catalog-summary p    { color:#476b67; font-size:9px }
```

`#829794` sobre blanco ronda **3.1:1**; `#A9CFCC` sobre fondo claro está aún peor. El mínimo AA para texto normal es **4.5:1**.

Además, `C.teal` (`#3EC6C0`) sobre blanco da aproximadamente **2.1:1**. Se usa como color de texto en varios sitios (`App.jsx`, enlaces y acentos), donde falla claramente.

**Impacto.** El público objetivo son docentes en ejercicio, muchos entre 35 y 60 años, trabajando en portátiles de gama media con brillo reducido. Texto pequeño y de bajo contraste es directamente inaccesible para ellos.

**Solución.** Paleta de neutrales de `04-` §2.1, donde `--neutral-500` (`#6B8280`) alcanza 4.6:1, y regla de que el teal 400 no se use nunca como color de texto.

**P0**

#### 7.2 🔴 1.4.4 Redimensionamiento del texto (AA) — **falla**

**157 reglas** fijan `font-size` en 7, 8, 9 o 10 px, incluidos elementos de contenido real: el **título de un material** en el dashboard está a 9 px y su fecha a 7 px.

Aunque el zoom del navegador funciona (no hay `maximum-scale`), partir de 7 px significa que un docente necesita 200 % de zoom solo para leer texto normal — momento en el que las retículas se rompen.

**Solución.** Escala tipográfica de `04-` §2.2, con **12 px como mínimo absoluto**.

**P0**

#### 7.3 🔴 2.1.2 Sin trampa de teclado / 2.4.3 Orden del foco — **falla en modales**

**Cero usos de `onKeyDown`** en `App.jsx`. Los cinco modales (`ActivityModal`, `RetoModal`, `MaterialViewerModal`, `TeacherAccountModal`, `PlansModal`, `LegalModal`) carecen de:

- Cierre con `Escape`
- Trampa de foco (el `Tab` se escapa al contenido de fondo)
- Foco inicial dentro del modal
- Devolución del foco al elemento que lo abrió
- Bloqueo del scroll de fondo

Un usuario de teclado que abre un modal **queda navegando por detrás de él** sin forma evidente de cerrarlo.

Algunos declaran `aria-modal="true"` y `role="dialog"` (`App.jsx:3564`), lo que es correcto, pero sin el comportamiento no sirve.

**Solución.** Componente `Modal` base con todo el comportamiento (`04-` §3.6).

**P0**

#### 7.4 🔴 2.4.7 Foco visible (AA) — **falla**

Solo **3 reglas `:focus`** en 99 KB de CSS, y ninguna `:focus-visible`.

Navegar con `Tab` es prácticamente a ciegas: en la mayoría de botones y tarjetas no hay indicación de dónde está el foco.

**Solución.** Regla global:

```css
/* PROPUESTO */
:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

**P0 · Esfuerzo XS** — una regla resuelve casi todo el problema.

#### 7.5 🟠 2.4.1 Evitar bloques (A) — **falla**

Sin enlace "Saltar al contenido". Un usuario de teclado o lector de pantalla debe recorrer los 5 elementos de la lateral y los 3 de la superior en cada cambio de sección.

**P1 · Esfuerzo XS**

#### 7.6 🟠 4.1.2 Nombre, función, valor — **parcial**

| Elemento | Estado |
|---|---|
| Botones con solo icono en la biblioteca | ⚠️ Usan `title`, que **no lo anuncian todos los lectores**. Falta `aria-label` |
| Pestañas de biblioteca y cuenta | ⚠️ Sin `role="tab"` ni `aria-selected` |
| Pestañas de auth | ⚠️ Tienen `role="tablist"` (`AuthGate.jsx:207`) pero **sin navegación por flechas** |
| Conmutador primaria/secundaria | ⚠️ Botones con clase `active`, sin `aria-pressed` |
| `LevelChoice` en registro | ✅ Tiene `aria-pressed` (`AuthGate.jsx:277`) — bien hecho |
| Estados de carga | ⚠️ Solo un `aria-live` en toda la app |

**P1**

#### 7.7 🟠 3.3.1 Identificación de errores / 3.3.3 Sugerencia — **parcial**

Los errores de auth usan `role="alert"` (`AuthGate.jsx:253`) — correcto. Pero:

- Los errores de los generadores no tienen `role="alert"`: un lector de pantalla no los anuncia.
- Los errores no se asocian al campo con `aria-describedby`.
- **Se muestran mensajes técnicos en crudo** (`App.jsx:3503`), que no cumplen 3.3.3 (sugerencia de corrección).

**P1**

#### 7.8 🟠 1.1.1 Contenido no textual — **parcial**

6 atributos `alt` en `App.jsx`. Los de Kantu son descriptivos en un caso (`"Kantu, vicuña científica peruana de SciVerse"`, `:2371`) y genéricos en el resto (`alt="Kantu"`).

Las imágenes puramente decorativas deberían llevar `alt=""` explícito para que los lectores las omitan.

Los iconos de lucide-react se renderizan como SVG **sin `aria-hidden="true"`**, así que algunos lectores los anuncian como gráficos sin nombre.

**P2**

#### 7.9 🟠 1.3.1 Información y relaciones — **parcial**

**Etiquetas de formulario:** 49 `<label>` y **0 `htmlFor`**. Se usa el patrón de envoltura (`<label>Texto <input/></label>`), que **es válido** y asocia correctamente. No es un fallo, pero el patrón explícito con `htmlFor`/`id` es más robusto ante refactorizaciones.

**Jerarquía de encabezados:** 6 `<h1>`, 21 `<h2>`, 31 `<h3>`. Con seis `<h1>` en la aplicación es probable que haya más de uno visible por vista, lo que rompe la estructura del documento.

**Elementos semánticos:** se usan `<nav>`, `<aside>`, `<section>`, `<header>`, `<footer>`, `<article>` — bien. Pero hay tarjetas clicables construidas como `<button>` con contenido complejo dentro, lo que produce nombres accesibles muy largos.

**P2**

#### 7.10 🟢 2.3.3 Animación por interacción (AAA) — **cumple parcialmente**

Existe **una** regla `prefers-reduced-motion` en `index.css`. Es más de lo habitual, pero no cubre las órbitas animadas del hero, el carrusel de testimonios ni los `translateY` de hover.

**P2**

#### 7.11 🟠 2.5.8 Tamaño del objetivo mínimo (AA 2.2) — **falla en móvil**

Los botones de icono de la biblioteca (descargar, duplicar, eliminar) usan iconos de 14 px con relleno mínimo, quedando muy por debajo de los 24×24 px CSS que exige WCAG 2.2 y de los 44×44 px recomendados para táctil.

Están además **muy juntos**, con "eliminar" al lado de "duplicar": alto riesgo de pulsación errónea en una acción destructiva sin deshacer.

**P1**

#### 7.12 🟠 Diálogos nativos del navegador

`window.alert` (2 usos) y `window.confirm` (`App.jsx:3624`) no son controlables por ARIA, no reciben el foco de forma predecible y rompen la experiencia con lector de pantalla.

**P2**

### 8. Lo que está bien en accesibilidad

1. `<html lang="es">` correcto (`index.html:2`).
2. `role="alert"` y `role="status"` en los mensajes de auth (`AuthGate.jsx:253-254`).
3. `aria-pressed` en `LevelChoice` (`AuthGate.jsx:277`).
4. `aria-modal` y `aria-labelledby` presentes en varios modales.
5. `aria-label` en las navegaciones (`aria-label="Panel docente"`, `"Navegación móvil del panel"`).
6. `aria-expanded` en el menú móvil (`App.jsx:2528`).
7. Elementos HTML semánticos en lugar de `<div>` genéricos.
8. Uso de `<details>/<summary>` nativos en las preguntas frecuentes — accesibles por defecto.
9. `autoComplete` correcto en los campos de auth (`given-name`, `family-name`, `email`, `current-password`, `new-password`).
10. Sin `maximum-scale` en el viewport: el zoom funciona.

Hay intención de accesibilidad en el código. Lo que falta es sistematizarla.

---

## PARTE III — Plan de corrección

### 9. Por prioridad

| # | Acción | Criterio WCAG | Prioridad | Esfuerzo |
|---|---|---|---|---|
| AC1 | Escala tipográfica con mínimo de 12 px | 1.4.4 | **P0** | M |
| AC2 | Paleta de neutrales con contraste ≥4.5:1 | 1.4.3 | **P0** | M |
| AC3 | Regla global `:focus-visible` | 2.4.7 | **P0** | XS |
| AC4 | Modales con Escape, trampa y devolución de foco | 2.1.2, 2.4.3 | **P0** | M |
| AC5 | Objetivos táctiles ≥44 px y más separados | 2.5.8 | **P1** | S |
| AC6 | `aria-label` en botones de solo icono | 4.1.2 | **P1** | S |
| AC7 | Enlace "Saltar al contenido" | 2.4.1 | **P1** | XS |
| AC8 | `role="alert"` en errores de generadores | 3.3.1 | **P1** | S |
| AC9 | Mensajes de error comprensibles | 3.3.3 | **P1** | S |
| AC10 | Tabla del admin adaptada a móvil | 1.4.10 | **P1** | S |
| AC11 | Navegación móvil con acceso a cuenta | — | **P1** | S |
| AC12 | Unificar a 5 puntos de ruptura | 1.4.10 | **P1** | M |
| AC13 | Resolver la zona muerta de tablet | 1.4.10 | **P1** | S |
| AC14 | `aria-selected` en todas las pestañas | 4.1.2 | **P2** | S |
| AC15 | Un solo `<h1>` por vista | 1.3.1 | **P2** | S |
| AC16 | `aria-hidden` en iconos decorativos | 1.1.1 | **P2** | S |
| AC17 | `prefers-reduced-motion` completo | 2.3.3 | **P2** | S |
| AC18 | Sustituir `alert`/`confirm` por componentes | 4.1.2 | **P2** | S |
| AC19 | Modales como hoja inferior en móvil | — | **P2** | M |
| AC20 | Contenedores con `overflow-x: auto` | 1.4.10 | **P2** | S |
| AC21 | `alt=""` en imágenes decorativas | 1.1.1 | **P3** | XS |
| AC22 | Migrar a `htmlFor`/`id` explícito | 1.3.1 | **P3** | M |
| AC23 | Icono de hamburguesa reconocible | — | **P3** | XS |

### 10. Herramientas recomendadas

| Herramienta | Uso |
|---|---|
| `eslint-plugin-jsx-a11y` | Detecta problemas al escribir |
| axe DevTools | Auditoría manual por pantalla |
| Lighthouse Accessibility | Puntuación en CI |
| Navegación solo con teclado | Prueba manual obligatoria por pantalla |
| Zoom al 200 % | Verificación de 1.4.4 |
| NVDA o VoiceOver | Prueba con lector de pantalla en los flujos P0 |

### 11. Los cuatro cambios con mayor impacto

1. **Regla `:focus-visible` global** (AC3) — una regla CSS, resuelve casi todo el problema de navegación por teclado.
2. **Escala tipográfica** (AC1) — elimina de un golpe 157 incumplimientos y transforma la percepción de calidad del producto.
3. **Componente `Modal` accesible** (AC4) — corrige los cinco modales a la vez.
4. **Paleta de neutrales** (AC2) — resuelve el contraste sin tocar los colores de marca.

Los cuatro caben en la Fase 10 del roadmap, pero **AC3 puede hacerse hoy** y mejora inmediatamente la experiencia de cualquier usuario de teclado.

---

## Resumen

| Categoría | P0 | P1 | P2 | P3 |
|---|---|---|---|---|
| Accesibilidad | 4 | 7 | 5 | 3 |
| Responsive | 0 | 4 | 4 | 1 |

**El producto no es accesible hoy**, y la causa principal es una sola decisión de diseño: **texto de 7-9 px en gris claro**. Corregir la escala tipográfica y la paleta de neutrales resuelve simultáneamente el mayor problema de accesibilidad y el mayor problema de percepción de calidad — el mismo cambio, dos beneficios.
