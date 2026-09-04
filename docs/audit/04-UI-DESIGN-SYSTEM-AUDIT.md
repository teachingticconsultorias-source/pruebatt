# 04 — Auditoría UI y propuesta de Design System V2

El objetivo no es sustituir la identidad de SciVerse, sino **darle estructura**. La marca tiene carácter —teal científico, coral cálido, amarillo de primaria, la vicuña Kantu— y ese carácter se conserva íntegro. Lo que falta es un sistema: hoy cada pantalla reinventa sus valores.

---

## PARTE I — Identidad visual existente

### 1.1 Paleta actual

La paleta vive en **tres objetos JavaScript independientes** más ~330 literales en CSS.

**`App.jsx:69-84` — objeto `C`**

```js
const C = {
  bg: "#FAFEFE",  surface: "#FFFFFF",  surface2: "#F1FBFA",
  line: "rgba(15,61,58,0.14)",  lineSoft: "rgba(15,61,58,0.07)",
  text: "#0F2E2C",  muted: "#5B7876",
  teal: "#3EC6C0",      // primario, del logo
  tealDeep: "#1F9E98",
  coral: "#FB6542",     // del logo
  yellow: "#FFBB00",    // del logo
  violet: "#FB6542",    // ⚠ alias de coral
  amber: "#FFBB00",     // ⚠ alias de yellow
  cyan: "#1F9E98",      // ⚠ alias de tealDeep
};
```

**Trece nombres para nueve colores reales.** `violet` no es violeta: es coral. Un desarrollador que usa `C.violet` esperando morado obtiene naranja. `amber === yellow` y `cyan === tealDeep`. Estos alias fueron atajos que hoy son trampas.

**`AuthGate.jsx:5-13` — objeto `COLORS`** (valores distintos para los mismos roles)

| Rol | `App.jsx` | `AuthGate.jsx` | ¿Coinciden? |
|---|---|---|---|
| teal | `#3EC6C0` | `#35B9AD` | ❌ |
| bg | `#FAFEFE` | `#FAFEFE` | ✅ |
| surface | `#FFFFFF` | `#FFFFFF` | ✅ |
| text | `#0F2E2C` | `#102A2E` | ❌ |
| muted | `#5B7876` | `#64777A` | ❌ |
| line | `rgba(15,61,58,0.14)` | `#D7E9E7` | ❌ |
| danger | — | `#C2410C` | solo aquí |

**`AdminPanel.jsx:4-9` — constantes `C_*`**, una tercera copia con los valores de `App.jsx`.

**Consecuencia:** el login y la aplicación usan verdes ligeramente distintos. Al iniciar sesión, la marca cambia de tono. Es sutil pero se percibe como falta de acabado.

### 1.2 Tipografía

Cargada dos veces: en `index.html:8` (correcto) y otra vez mediante `@import` dentro de un `<style>` en un componente React (`App.jsx:3643`) —lo que **bloquea el render** y duplica la petición.

| Familia | Pesos | Uso | Ocurrencias |
|---|---|---|---|
| Space Grotesk | 500, 600, 700 | Títulos, marca | 55 |
| Inter | 400, 500, 600 | Cuerpo, interfaz | 12 |
| JetBrains Mono | 500 | Etiquetas, códigos | 29 |

La elección es buena: Space Grotesk aporta personalidad técnica sin ser fría, Inter es legible. **El problema no son las familias sino las escalas.**

### 1.3 Escala tipográfica — el hallazgo más grave de UI

18 tamaños distintos, sin progresión sistemática. Su distribución:

| Tamaño | Usos | Valoración |
|---|---|---|
| **7px** | **19** | 🔴 Ilegible |
| **8px** | **46** | 🔴 Ilegible |
| **9px** | **55** | 🔴 Muy difícil de leer |
| **10px** | **37** | 🟠 Bajo el mínimo |
| 11px | 29 | 🟠 Límite |
| 12px | 17 | 🟡 Aceptable solo para apoyo |
| 13px | 13 | 🟡 |
| 14-16px | 12 | 🟢 |
| 18-24px | 13 | 🟢 |
| 36-48px | 3 | 🟢 |

**157 reglas fijan texto a 10px o menos.** Y no son casos marginales: son elementos de contenido real.

```css
.recent-material-list strong { font-size:9px }   /* título del material en el dashboard */
.recent-material-list small  { font-size:7px }   /* tipo, grado y área */
.recent-material-list time   { font-size:7px }   /* fecha */
.steam-catalog-summary p     { color:#476b67; font-size:9px }
.steam-card-footer span      { color:#829794; font-size:7px }
.auth-company                { color:#A9CFCC; font-size:9px }
```

El **título de un material guardado** —dato principal de esa tarjeta— se muestra a 9 px, y su fecha a 7 px en gris claro.

**Por qué importa especialmente aquí.** El público objetivo son docentes en ejercicio, muchos entre 35 y 60 años, trabajando a menudo en pantallas de portátil de gama media con brillo bajo. Texto de 7 px en `#829794` sobre blanco combina el peor tamaño con el peor contraste. La combinación `#829794` sobre `#FFFFFF` ronda **3.1:1**, por debajo del mínimo de 4.5:1 de WCAG AA para texto normal — y a 7 px el problema real es que sencillamente no se lee.

**Prioridad P0.** Es simultáneamente un problema de accesibilidad, de percepción de calidad y de usabilidad básica.

### 1.4 Radios de esquina

**24 valores únicos**: 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 50%, 99px, 999px…

Los tres más usados (10px: 23 veces, 9px: 19, 11px: 19) son visualmente indistinguibles entre sí. Esa variación no comunica nada: es ruido acumulado.

### 1.5 Sombras

**58 sombras únicas.** Casi todas variaciones mínimas sobre `rgba(15,61,58,.04–.13)`:

```
0 15px 40px rgba(15,61,58,.06)
0 10px 30px rgba(15,61,58,.04)
0  9px 28px rgba(15,61,58,.04)
0  9px 25px rgba(15,61,58,.04)
0  9px 22px rgba(31,158,152,.25)
```

Tres sombras que difieren en 1 px de desenfoque no crean tres niveles de elevación: crean inconsistencia sin propósito.

### 1.6 Espaciado

Sin sistema. Valores arbitrarios: `padding: 38px 34px 52px`, `margin: 28px 0 16px`, `gap: 7px`, `gap: 9px`, `gap: 13px`, `gap: 14px`, `gap: 15px`. No hay base de 4 u 8 px.

### 1.7 Puntos de ruptura

**Más de 25 valores distintos** de `max-width`: 1240, 1180, 1160, 1120, 1050, 1000, 960, 920, 900, 850, 800, 760, 700, 650, 620, 600, 570, 560, 520, 460, 450, 310, 280, 190, 165…

Cada componente eligió el suyo. El resultado es que al redimensionar la ventana, la interfaz se reorganiza en momentos aparentemente aleatorios y sin coherencia entre secciones.

### 1.8 Componentes recurrentes identificados

Del análisis del CSS y el JSX, estos patrones se repiten y son candidatos naturales a componentes:

| Patrón | Clases | Variantes observadas |
|---|---|---|
| Botón primario | `.primary-btn`, `.primary-btn.compact` | 4 definiciones distintas del mismo selector |
| Botón secundario | `.secondary-btn` | 3 definiciones |
| Tarjeta de recurso | `.creation-type-card`, `.steam-card`, `.plan-card` | `.plan-card` aparece **12 veces** en el CSS |
| Etiqueta/píldora | `.eyebrow`, `.subject-pill`, `.badge` | Sin unificar |
| Paso de asistente | `.wizard-card` | 3 generadores lo reimplementan |
| Modal | `.account-backdrop`, `.plans-backdrop` | 5 modales, ninguno comparte base |
| Estado vacío | `.library-empty-state` | Solo uno bien resuelto; el resto improvisados |

### 1.9 Mascota Kantu

`public/mascot/kantu-material.png` y `kantu-session.png`. Es el mayor activo diferenciador de la marca y está infrautilizada: aparece en 4 lugares y solo como imagen decorativa. **Se conserva y se amplía** en la propuesta.

### 1.10 Balance de la identidad

| Aspecto | Valoración |
|---|---|
| Elección de colores de marca | 🟢 Buena — teal/coral/amarillo funcionan y son distintivos |
| Elección tipográfica | 🟢 Buena — Space Grotesk + Inter es una combinación acertada |
| Mascota y tono | 🟢 Muy buena — cercano, en español peruano, sin infantilizar |
| **Consistencia de aplicación** | 🔴 **Deficiente** — 3 paletas, 24 radios, 58 sombras, 18 tamaños |
| **Legibilidad** | 🔴 **Deficiente** — 157 reglas con texto ≤10px |
| **Tokenización** | 🔴 **Inexistente** — 331 literales, 0 bloques `:root` |
| Jerarquía visual | 🟠 Débil — todo compite por atención |
| Densidad | 🟠 Excesiva en dashboard y biblioteca |

---

## PARTE II — Design System V2

Principio rector: **conservar la esencia, sistematizar la aplicación.** Los colores de marca no cambian; cambia todo lo que los rodea.

### 2.1 Color

#### Primarios — de la marca, sin alterar

```css
--brand-teal-50:  #ECFAF9;
--brand-teal-100: #D3F2F0;
--brand-teal-200: #A8E5E1;
--brand-teal-300: #6FD4CE;
--brand-teal-400: #3EC6C0;   /* C.teal actual — color de marca */
--brand-teal-500: #2BAFA9;
--brand-teal-600: #1F9E98;   /* C.tealDeep actual */
--brand-teal-700: #177C77;
--brand-teal-800: #115E5A;
--brand-teal-900: #0F3D3A;   /* base de las líneas actuales */
```

> **Nota importante.** `--brand-teal-400` (`#3EC6C0`) sobre blanco da ~2.1:1 de contraste. **No es apto para texto ni para fondo de botón con texto blanco.** Hoy se usa así en `AuthGate.jsx:262` (fondo teal con texto `#072E2B`, que sí pasa) y en varios textos donde no pasa. Regla V2: **el teal 400 es color de marca y de acento, no de texto**. Para texto y botones sólidos se usa `--brand-teal-700` o superior.

#### Secundarios

```css
--accent-coral-100: #FFE7E0;
--accent-coral-400: #FB6542;   /* del logo */
--accent-coral-600: #D9421F;   /* variante accesible para texto */

--accent-amber-100: #FFF4D1;
--accent-amber-400: #FFBB00;   /* del logo */
--accent-amber-700: #A87A00;   /* variante accesible para texto */
```

**Se eliminan los alias `violet`, `amber` y `cyan`.** Si el producto necesita un cuarto color de acento (por ejemplo para distinguir "Planificación"), se añade uno real:

```css
--accent-indigo-100: #E8EDFF;
--accent-indigo-500: #4F63C7;
--accent-indigo-700: #37479B;
```

#### Neutrales

```css
--neutral-0:   #FFFFFF;
--neutral-25:  #FAFEFE;   /* C.bg actual */
--neutral-50:  #F4F8F8;
--neutral-100: #E8EFEF;
--neutral-200: #D5E2E1;
--neutral-300: #B4C6C4;
--neutral-400: #8CA3A1;
--neutral-500: #6B8280;   /* mínimo para texto secundario: 4.6:1 sobre blanco */
--neutral-600: #526966;
--neutral-700: #3A4F4C;
--neutral-800: #233735;
--neutral-900: #0F2E2C;   /* C.text actual */
```

> `--neutral-500` (`#6B8280`) sustituye al `#5B7876` actual como color mínimo de texto secundario y alcanza 4.6:1 sobre blanco. Los grises más claros (`#829794`, `#A9CFCC`) quedan reservados para bordes e iconos decorativos, **nunca para texto**.

#### Semánticos

```css
--success-50: #E9F9F1;  --success-500: #16A46A;  --success-700: #0E7A4E;
--warning-50: #FFF7E6;  --warning-500: #E09400;  --warning-700: #A86D00;
--danger-50:  #FDECE8;  --danger-500:  #DC4A2A;  --danger-700:  #A8321A;
--info-50:    #EAF1FF;  --info-500:    #3B6FD4;  --info-700:    #2A4F9B;
```

Hoy el único semántico definido es `danger` en `AuthGate.jsx`. El resto se improvisa con literales.

#### Fondos, bordes y roles

```css
--bg-canvas:     var(--neutral-25);
--bg-surface:    var(--neutral-0);
--bg-raised:     var(--neutral-0);
--bg-sunken:     var(--neutral-50);
--bg-brand-soft: var(--brand-teal-50);

--border-subtle: var(--neutral-100);
--border-default:var(--neutral-200);
--border-strong: var(--neutral-300);
--border-brand:  var(--brand-teal-300);
--border-focus:  var(--brand-teal-600);

--text-primary:   var(--neutral-900);
--text-secondary: var(--neutral-500);
--text-tertiary:  var(--neutral-400);   /* solo apoyo, nunca contenido */
--text-on-brand:  #04302C;
--text-inverse:   var(--neutral-0);
```

### 2.2 Escala tipográfica

Reemplaza los 18 tamaños actuales por **8 pasos**, con **12 px como mínimo absoluto** en toda la interfaz.

| Token | Tamaño / interlineado | Peso | Uso |
|---|---|---|---|
| `--text-display` | 44 / 1.08 | 700 | Título de la landing |
| `--text-h1` | 32 / 1.15 | 700 | Título de página |
| `--text-h2` | 24 / 1.2 | 700 | Título de sección |
| `--text-h3` | 19 / 1.3 | 600 | Título de tarjeta |
| `--text-body-lg` | 16 / 1.6 | 400 | Texto destacado, entradillas |
| `--text-body` | 15 / 1.6 | 400 | **Cuerpo por defecto** |
| `--text-sm` | 13 / 1.5 | 400/500 | Metadatos, ayuda |
| `--text-label` | 12 / 1.4 | 700, `letter-spacing: .08em` | Etiquetas en mayúsculas |

**Regla dura: nada por debajo de 12 px.** Migración de los tamaños actuales:

| Actual | V2 |
|---|---|
| 7px, 8px, 9px | → `--text-label` (12) o `--text-sm` (13) según si es etiqueta o dato |
| 10px, 11px | → `--text-sm` (13) |
| 12px, 13px | → `--text-sm` (13) |
| 14px, 15px, 16px | → `--text-body` (15) o `--text-body-lg` (16) |
| 18-24px | → `--text-h3` / `--text-h2` |
| 36-48px | → `--text-h1` / `--text-display` |

Aplicar esto tiene un efecto secundario deseable: **obliga a reducir densidad**, porque el contenido dejará de caber apretado. El resultado será una interfaz que respira.

### 2.3 Espaciado

Base de 4 px:

```css
--space-1: 4px;    --space-2: 8px;    --space-3: 12px;   --space-4: 16px;
--space-5: 20px;   --space-6: 24px;   --space-8: 32px;   --space-10: 40px;
--space-12: 48px;  --space-16: 64px;  --space-20: 80px;
```

Reglas: separación interna de tarjeta = `--space-6`; separación entre secciones = `--space-10`; hueco de retícula = `--space-4`; separación etiqueta–campo = `--space-2`.

### 2.4 Radios

De 24 valores a **5**:

```css
--radius-sm:   6px;    /* etiquetas, campos pequeños */
--radius-md:  10px;    /* botones, inputs */
--radius-lg:  14px;    /* tarjetas */
--radius-xl:  20px;    /* modales, contenedores destacados */
--radius-full: 999px;  /* píldoras, avatares */
```

### 2.5 Sombras

De 58 a **5 niveles de elevación**:

```css
--elev-0: none;
--elev-1: 0 1px 2px rgba(15,61,58,.06), 0 1px 3px rgba(15,61,58,.04);
--elev-2: 0 4px 8px rgba(15,61,58,.06), 0 2px 4px rgba(15,61,58,.04);
--elev-3: 0 12px 24px rgba(15,61,58,.08), 0 4px 8px rgba(15,61,58,.04);
--elev-4: 0 24px 48px rgba(15,61,58,.12), 0 8px 16px rgba(15,61,58,.06);
--elev-focus: 0 0 0 3px rgba(31,158,152,.28);
```

Asignación: tarjeta en reposo `--elev-1` · tarjeta en hover `--elev-2` · panel flotante `--elev-3` · modal `--elev-4`.

### 2.6 Puntos de ruptura

De 25+ a **5**:

```css
--bp-sm:  480px;   /* móvil grande */
--bp-md:  768px;   /* tableta vertical */
--bp-lg: 1024px;   /* tableta horizontal / portátil pequeño */
--bp-xl: 1280px;   /* escritorio */
--bp-2xl:1536px;   /* escritorio amplio */
```

Enfoque *mobile-first* con `min-width`, al contrario del `max-width` actual.

---

## PARTE III — Catálogo de componentes

### 3.1 Botones

| Variante | Fondo | Texto | Borde | Uso |
|---|---|---|---|---|
| **Primary** | `--brand-teal-700` | `--text-inverse` | — | Acción principal, uno por pantalla |
| **Secondary** | `--bg-surface` | `--brand-teal-700` | `--border-default` | Acciones alternativas |
| **Tertiary** | transparente | `--text-secondary` | — | Acciones de bajo peso |
| **Danger** | `--danger-500` | blanco | — | Eliminar |
| **Accent** | `--accent-coral-400` | `#3A1206` | — | Solo para "Crear con IA" |

Tamaños: `sm` 32px · `md` 40px (por defecto) · `lg` 48px. **Objetivo táctil mínimo de 44×44 px en móvil.**

Estados obligatorios en todas: `default`, `hover`, `active`, `focus-visible` (con `--elev-focus`), `disabled`, `loading` (con giro y texto "Generando…").

> **Cambio respecto al actual:** hoy el botón primario usa `#3EC6C0` como fondo, que con texto oscuro pasa pero con texto blanco no. V2 fija `--brand-teal-700` (`#177C77`), que da 5.4:1 con blanco y mantiene claramente el tono de marca.

### 3.2 Inputs

Altura 44 px · `--radius-md` · borde `--border-default` · fondo `--bg-surface`.
Estados: `focus` (borde `--border-focus` + `--elev-focus`), `error` (borde `--danger-500` + mensaje con icono), `disabled`, `readonly`.
**Etiqueta siempre visible encima** — nunca solo `placeholder`. Texto de ayuda en `--text-sm` / `--text-secondary`.

### 3.3 Cards

| Tipo | Uso | Anatomía |
|---|---|---|
| `Card.Resource` | Material en biblioteca | icono de tipo · título (`--text-h3`) · metadatos · fecha · acciones |
| `Card.Tool` | Herramienta de creación | icono · nombre · descripción · llamada a la acción |
| `Card.Activity` | Actividad STEAM | área · título · objetivo · duración · nivel |
| `Card.Stat` | Métrica del dashboard | icono · etiqueta · valor grande · contexto |
| `Card.Plan` | Plan comercial | nombre · precio · beneficios · acción |

Base común: `--bg-surface`, `--radius-lg`, `--elev-1`, `padding: --space-6`, hover a `--elev-2` con `translateY(-2px)`.

> Hoy `.plan-card` está definido **12 veces** en `index.css`. Con un componente único, esa duplicación desaparece.

### 3.4 Badges

`neutral` · `brand` · `success` · `warning` · `danger` · `info`
Formato: `--radius-full`, `padding: 4px 10px`, `--text-label`, fondo tono 50/100, texto tono 700.
Usos: tipo de material, nivel educativo, estado de generación, área curricular.

### 3.5 Alerts

Cuatro variantes (info, success, warning, danger) con icono, título opcional, cuerpo y acción opcional. Con borde izquierdo de 3 px del color semántico y fondo del tono 50.
**Sustituyen a los `window.alert` actuales** (`App.jsx`, 2 usos).

### 3.6 Modals

Base única con: fondo oscurecido `rgba(15,46,44,.55)`, panel `--radius-xl` + `--elev-4`, `max-width` por tamaño (sm 420 / md 640 / lg 880 / xl 1100).

Comportamiento obligatorio, hoy **ausente en los 5 modales**:

- Cierre con `Escape`
- Trampa de foco (`Tab` circula dentro del modal)
- Devolución del foco al elemento que lo abrió
- `aria-modal="true"` + `aria-labelledby`
- Bloqueo del scroll de fondo
- En móvil: hoja inferior a pantalla completa, no modal centrado

### 3.7 Tabs

Dos variantes: subrayado (navegación de contenido) y segmentado (conmutadores tipo primaria/secundaria).
Con `role="tablist"`, navegación por flechas y `aria-selected`. Hoy `AuthGate.jsx:207` declara `role="tablist"` pero **sin navegación por teclado**.

### 3.8 Navigation

- **Sidebar** (≥1024px): 264 px, marca, grupos con encabezado, ítem activo con barra izquierda de 3 px, pie con cuenta y plan.
- **Topbar**: migas de pan, buscador global, indicador de créditos, avatar. **Sin duplicar marca ni cierre de sesión.**
- **Bottom nav** (<768px): 5 destinos máximo, el quinto "Más" abriendo hoja inferior.

### 3.9 Tables

Solo se usa en el panel admin. V2: encabezado fijo, filas de 48 px, alineación numérica a la derecha, orden por columna, selección múltiple, paginación, y en móvil **transformación a tarjetas** en vez de scroll horizontal.

### 3.10 Tooltips

Ausentes hoy. Necesarios en: iconos sin etiqueta de la biblioteca (descargar, duplicar, eliminar — hoy solo con `title` nativo), términos pedagógicos (DUA, enfoques transversales, evidencia) y el indicador de créditos.
Con retardo de 300 ms, `role="tooltip"`, accesibles también por foco de teclado.

### 3.11 Loaders

| Situación | Patrón |
|---|---|
| Carga de página | Esqueleto con la forma real del contenido |
| Carga de lista | 3-5 tarjetas esqueleto |
| Acción en botón | Giro dentro del botón, texto cambia a gerundio |
| **Generación con IA** | **Progreso por pasos con nombre pedagógico** |

Para la generación de sesión, el patrón recomendado —dado que son 4 módulos secuenciales de 15-30 s cada uno:

```
[━━━━━━━━━━━━░░░░░░░░░░░░]  2 de 4 · ~45 s restantes

✓ Alineación curricular
◉ Secuencia didáctica          ← en curso
○ Criterios de evaluación
○ Anexos para el aula

💡 Los criterios de evaluación deben empezar con un
   verbo observable para poder verificarse en la evidencia.
```

### 3.12 Empty states

Componente único: ilustración (Kantu cuando encaje) · título · explicación · acción primaria · acción secundaria opcional.
`LibraryEmpty` (`App.jsx:3512`) ya es un buen ejemplo; se generaliza a todos los casos.

### 3.13 Skeletons

Fondo `--neutral-100` con animación de brillo de 1.5 s. **Respetando `prefers-reduced-motion`**, en cuyo caso queda estático.

### 3.14 Success states

Tras generar y guardar: confirmación con el nombre del material y las tres siguientes acciones lógicas (Descargar Word · Crear instrumento · Volver a la biblioteca). Evita el callejón sin salida actual.

### 3.15 Error states

Tres niveles: campo (bajo el input) · sección (alert en contexto) · página (con Kantu, explicación y salida).
**Siempre en lenguaje natural, nunca el mensaje técnico crudo.** Ver la tabla de mensajes en `03-UX-AUDIT.md` §8.2.

---

## PARTE IV — Plan de adopción

Sin reescribir la interfaz. Por capas, verificable en cada paso:

| Fase | Acción | Riesgo |
|---|---|---|
| **1** | Añadir el bloque `:root` con todos los tokens al inicio de `index.css`. No cambia nada visualmente. | Nulo |
| **2** | Unificar las tres paletas: `App.jsx`, `AuthGate.jsx` y `AdminPanel.jsx` leen de `var(--...)`. | Bajo |
| **3** | **Aplicar la escala tipográfica.** Sustituir los 157 tamaños ≤10px. Es el cambio de mayor impacto visible. | Medio — revisar densidad pantalla por pantalla |
| **4** | Normalizar radios (24→5) y sombras (58→5) por búsqueda y reemplazo. | Bajo |
| **5** | Extraer `Button`, `Input`, `Card`, `Badge`, `Modal` a `src/components/ui/` **(PROPUESTO — todavía no existe)**. | Medio |
| **6** | Unificar los 25+ puntos de ruptura a 5, migrando a `min-width`. | Medio |
| **7** | Añadir comportamiento accesible a los 5 modales (Escape, foco, aria). | Bajo |
| **8** | Sustituir `window.alert`/`confirm` por `Toast` y `ConfirmDialog`. | Bajo |

**La fase 3 es la que transforma la percepción del producto.** Pasar de "texto de 7 px en gris claro" a una escala legible convierte una interfaz que parece un prototipo apretado en una que parece un producto profesional — sin tocar ni un color de marca.

---

## Resumen

| Métrica | Hoy | V2 |
|---|---|---|
| Paletas independientes | 3 | 1 |
| Colores literales en CSS | 331 | ~0 (todo por token) |
| Bloques `:root` | 0 | 1 |
| Tamaños de fuente | 18 | 8 |
| Reglas con texto ≤10px | **157** | **0** |
| Radios únicos | 24 | 5 |
| Sombras únicas | 58 | 5 |
| Puntos de ruptura | 25+ | 5 |
| Modales con Escape y trampa de foco | 0 de 5 | 5 de 5 |
| Componentes reutilizables | 0 | ~15 |
| Alias de color engañosos | 3 (`violet`, `amber`, `cyan`) | 0 |
