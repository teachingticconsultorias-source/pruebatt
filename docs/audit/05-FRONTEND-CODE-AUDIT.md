# 05 — Auditoría de código frontend

Arquitectura y calidad del frontend, con rutas y líneas reales.

---

## 1. Panorama

| Métrica | Valor |
|---|---|
| Líneas JSX versionadas | ~8.900 |
| Líneas que nunca se ejecutan | **~4.000 (45 %)** |
| Archivo mayor | `App.jsx` — 3.776 líneas / 277 KB |
| Componentes en `App.jsx` | 43 |
| `useState` en un solo componente | 20 (`SciVerseApp`) |
| Estilos en línea | 167 |
| CSS global | 109 KB (`index.css` + `library.css`) |
| Linter / formateador | Ninguno |
| Pruebas | Ninguna |
| TypeScript / PropTypes | Ninguno |

---

## 2. El problema estructural: el build reescribe el código

**Qué pasa.** `package.json:8` define `"build": "node apply-sciverse-v2.mjs && vite build"`. El script (89 KB) hace 11 reemplazos de cadena sobre `App.jsx`, los escribe en disco (`apply-sciverse-v2.mjs:116`), añade CSS a `index.css` (`:143`) y **crea `api/generate-project-steam.js`** (`:150`).

**Dónde.** `apply-sciverse-v2.mjs`, `package.json:8`.

**Por qué es un problema.**

1. **El repositorio no es la verdad.** `App.jsx` pasa de 3.776 a 4.221 líneas en el build. `CreateStudio` y el dashboard son totalmente distintos. Nadie puede razonar sobre producción leyendo el repositorio.
2. **No es idempotente.** Verificado: la segunda ejecución falla con `Error: No pude aplicar el cambio: iconos del dashboard`.
3. **Frágil por diseño.** `mustReplace` (`apply-sciverse-v2.mjs:7-11`) lanza excepción si el ancla no aparece. Cualquier edición sobre una de las 9 anclas rompe el despliegue. `PASOS.txt` documenta que ya ocurrió.
4. **Contamina el árbol de trabajo.** Los tres archivos modificados no están en `.gitignore`.
5. **Imposible construir en local en Windows.** El árbol tiene CRLF (`core.autocrlf=true`, sin `.gitattributes`); las anclas usan LF. El blob de Git sí es LF, por eso Vercel construye y el desarrollador no.

**Impacto en la docente.** Indirecto pero severo: es la razón por la que las correcciones tardan y por la que un despliegue puede dejar el sitio caído.

**Solución.**

1. Ejecutar el codemod una última vez sobre el blob de Git (con LF).
2. Commitear el resultado como el nuevo `App.jsx` e `index.css`.
3. Commitear `api/generate-project-steam.js`.
4. `"build": "vite build"` (ya existe como referencia en `package-fallback.json`).
5. Archivar `apply-sciverse-v2.mjs` en `docs/legacy/`.
6. Añadir `.gitattributes` **(PROPUESTO — todavía no existe)** con `* text=auto eol=lf`.

**Prioridad P0 · Esfuerzo S · Dependencias:** ninguna. **Es el primer trabajo del roadmap.**

---

## 3. Código muerto

### 3.1 Directorio `src/` completo — ~2.100 líneas

`index.html:11` carga `/main.jsx` de la raíz. Todo `src/` es una versión anterior que nunca se compila.

| Archivo | Líneas | Nota |
|---|---|---|
| `src/App.jsx` | 1.897 | Versión antigua. Contiene `supabase.from("docentes").insert([form])` (`:1243`), que hoy fallaría por RLS |
| `src/AdminPanel.jsx` | 103 | Byte a byte idéntico al de la raíz |
| `src/main.jsx` | 12 | Duplicado |
| `src/supabaseClient.js` | 5 | Versión sin soporte de `PUBLISHABLE_KEY` |
| `src/index.css` | 3 | Solo las directivas de Tailwind |

**Riesgo añadido:** `tailwind.config.js:3` incluye `"./src/**/*.{js,jsx}"` en `content`, así que Tailwind **escanea estos archivos muertos** y genera CSS para clases que nadie usa.

**Acción:** eliminar `src/` y quitarlo de `tailwind.config.js`. **P1 · XS**

### 3.2 Directorio `components/` completo — 1.563 líneas

Ninguno se importa en `App.jsx`, `main.jsx` ni en el codemod (verificado por búsqueda en los tres).

| Archivo | Líneas | Qué era |
|---|---|---|
| `components/SessionResourcesPanel.jsx` | 1.181 | Panel de recursos con exportadores Word propios |
| `components/SessionNextFlow.jsx` | 248 | Flujo Sesión→Instrumento→Material con 7 tipos |
| `components/CreditsIndicator.jsx` | 134 | **Único consumidor de `/api/credits`** |

**Consecuencia grave:** al no importarse `CreditsIndicator`, `/api/credits` queda huérfano y **la docente nunca ve sus créditos** (ver `03-UX-AUDIT.md` §8.3).

**Riesgo silencioso:** `tailwind.config.js` **no incluye** `./components/**`. Si se reviven, sus clases de Tailwind se purgarán y quedarán sin estilo.

**Acción:** rescatar `CreditsIndicator` (importarlo de verdad); evaluar `SessionNextFlow` frente a la implementación en línea del codemod y quedarse con una sola; eliminar el resto. **P1 · S**

### 3.3 Código muerto dentro de `App.jsx` — ~440 líneas

| Qué | Líneas | Motivo |
|---|---|---|
| `RegistrationGate` | 2855-3298 | Sustituido por `AuthGate.jsx`. `SciVerseDocentes` (`:3531`) usa `AuthGate` |
| **Código tras `return`** | **3078-3290** | Hay un `return (<ImprovedLanding/>)` en `:3078` y después `const FEATURES = [...]` con un segundo `return`. **Inalcanzable por definición.** |
| `LoginModal` | 2695-2760 | Nunca renderizado |
| `PasswordRecoveryModal` | 2761-2821 | Solo usado por `RegistrationGate` |
| `ResetPasswordPage` | 2617-2694 | Solo usado por `RegistrationGate` |

El bloque 3078-3290 es especialmente revelador: **210 líneas de una landing anterior que ningún linter detectó porque no hay linter.** ESLint con `no-unreachable` lo habría marcado de inmediato.

**Acción:** eliminar. **P1 · S**

### 3.4 Otros archivos muertos

| Archivo | Tamaño | Estado |
|---|---|---|
| `AnimalCellLab.jsx` | 398 líneas | Nunca importado |
| `credit-widget.css` | 1.9 KB | Ningún archivo lo importa |
| `session-next-flow.css` | 6.2 KB | Solo lo importa un componente muerto |
| `session-resources.css` | 6.9 KB | Solo lo importa un componente muerto |
| `sciverse-dashboard-lateral-v8.zip` | 74 KB | Copia de la versión v8 |
| `sciverse-login-registro-v5 (1).zip` | 71 KB | Copia de la versión v5 |
| `sciverse-mi-cuenta-capacitacion-v9.zip` | 78 KB | Copia de la versión v9 |
| `package-fallback.json` | 560 B | Copia de `package.json` sin codemod |
| 6 archivos `.txt` | ~11 KB | Instrucciones de aplicación manual |

Los ZIP no se sirven (están fuera de `public/`) pero versionan 223 KB y hacen más lento cada clon.

**Acción:** eliminar todo; mover los `.txt` con valor histórico a `docs/legacy/`. **P2 · XS**

---

## 4. `App.jsx`: un archivo, todas las responsabilidades

3.776 líneas con al menos ocho responsabilidades distintas:

| Responsabilidad | Líneas | Aprox. |
|---|---|---|
| Constantes de marca y CNEB | 69-291 | 220 |
| Datos (actividades, retos, plantillas, planes) | 292-884 | 590 |
| Generación de Word (`docx`) | 96-291 | 195 |
| Generadores con IA (9 componentes) | 885-2333 | 1.450 |
| Estudio de creación | 2334-2434 | 100 |
| Landing y modales públicos | 2435-2854 | 420 |
| Auth muerta | 2855-3298 | 440 |
| Aplicación (dashboard, catálogo, biblioteca) | 3299-3776 | 480 |

**Por qué es un problema.** Ningún desarrollador puede tener el archivo entero en la cabeza. Un cambio de estilos en la landing obliga a abrir el mismo archivo que contiene la lógica de generación de Word. Es la causa raíz de que los duplicados no se detecten.

**Estructura propuesta** (movimiento, no reescritura):

```
src/
├── main.jsx
├── App.jsx                    ← solo composición y rutas (~80 líneas)
├── config/
│   ├── theme.js               ← objeto C unificado
│   ├── cneb.js                ← CNEB, GENERATOR_*, DIDACTIC_PROCESSES
│   └── plans.js               ← PLANS (fuente única)
├── data/
│   ├── activities.js · challenges.js · templates.js · testimonials.js
├── lib/
│   ├── supabase.js
│   ├── api.js                 ← cliente con token, errores y reintentos
│   ├── materials.js           ← saveTeacherMaterial y consultas
│   └── docx/                  ← session.js · rubric.js · checklist.js · activity.js
├── hooks/
│   ├── useAuth.js · useMaterials.js · useCredits.js
│   ├── useGenerator.js        ← ⭐ elimina la duplicación de los 9 generadores
│   └── useAutosave.js
├── components/
│   ├── ui/                    ← Button · Input · Card · Modal · Badge · Toast…
│   ├── layout/                ← Sidebar · Topbar · MobileNav
│   └── shared/                ← WizardStep · EmptyState · GenerationProgress
├── features/
│   ├── auth/ · landing/ · dashboard/ · activities/
│   ├── challenges/ · library/ · account/ · admin/
│   └── create/
│       ├── CreateStudio.jsx
│       └── generators/        ← un archivo por generador
└── styles/
    ├── tokens.css · base.css
```

**Prioridad P1 · Esfuerzo L · Depende de:** eliminar el codemod primero (§2). Mientras el build reescriba `App.jsx`, dividirlo es imposible.

---

## 5. Duplicación de lógica

### 5.1 Los nueve generadores repiten el mismo esqueleto

`SteamGenerator`, `EvaluationInstrumentGenerator`, `WordSearchGenerator`, `CrosswordGenerator`, `LearningUnitGenerator`, `WorksheetGenerator`, `ReadingGenerator`, `EvaluationSheetGenerator`, `ChallengeCreator` — todos declaran:

```js
const [form, setForm]       = useState({...});
const [step, setStep]       = useState(1);
const [loading, setLoading] = useState(false);
const [error, setError]     = useState(null);
const [result, setResult]   = useState(null);
```

y repiten el mismo patrón de obtención de token:

```js
const { data: sessionData } = await supabase.auth.getSession();
const token = sessionData.session?.access_token;
if (!token) throw new Error("Tu sesión venció. Vuelve a iniciar sesión.");
```

Ese bloque aparece en `App.jsx:929`, `:945`, `:1158`, `:3503` y en los componentes muertos. **Cinco copias del mismo código.**

**Impacto real.** Cuando se decidió mostrar el progreso módulo a módulo, solo se aplicó a `SteamGenerator`. Los demás siguen con un giro genérico. Las mejoras no se propagan porque no hay nada compartido.

**Solución.** Un hook `useGenerator({ endpoint, buildBody, onSuccess })` **(PROPUESTO)** que encapsule token, estados, errores, autoguardado y guardado. Los nueve generadores se reducen a formulario más presentación del resultado.

**Prioridad P1 · Esfuerzo M**

### 5.2 Exportadores de Word con estructura repetida

`wordRun`/`rubricParagraph`, `wordCell`/`rubricCell`, `wordTable`/`rubricTable` (`App.jsx:100-139`) son dos juegos casi idénticos que difieren en tamaños por defecto y paleta (`WORD` vs `RUBRIC_WORD`).

**Solución.** Un módulo `lib/docx/primitives.js` parametrizado por tema. **P2 · S**

### 5.3 Tres paletas de color

`App.jsx:69` (`C`), `AuthGate.jsx:5` (`COLORS`), `AdminPanel.jsx:4` (`C_*`), con **valores divergentes** para teal, text, muted y line. Detalle en `04-UI-DESIGN-SYSTEM-AUDIT.md` §1.1.

**Solución.** `config/theme.js` único, leyendo de las variables CSS. **P1 · S**

### 5.4 Alias de color engañosos

```js
violet: "#FB6542",  // no es violeta: es coral
amber:  "#FFBB00",  // idéntico a yellow
cyan:   "#1F9E98",  // idéntico a tealDeep
```

`App.jsx:81-83`. Trece nombres para nueve colores. `C.violet` devuelve naranja.

**Solución.** Eliminar los alias y renombrar por rol (`--accent-primary`, `--level-primaria`, `--level-secundaria`). **P2 · S**

---

## 6. Gestión de estado

### 6.1 `SciVerseApp` con 20 `useState`

`App.jsx:3585-3602`. Un solo componente gobierna navegación, filtros de tres catálogos, cuatro modales, la biblioteca y los favoritos.

**Consecuencia medible.** Escribir una letra en el buscador de la biblioteca (`librarySearch`) **vuelve a renderizar la aplicación entera**, incluidos el catálogo de actividades y el estudio de creación, aunque estén ocultos.

**Solución.** Estado de navegación al router; estado de servidor a hooks por dominio (`useMaterials`, `useCredits`); estado de interfaz local a cada componente.

**Prioridad P1 · Esfuerzo M**

### 6.2 Bus de eventos improvisado con `window`

```js
// App.jsx:125
window.dispatchEvent(new CustomEvent("sciverse:material-created", { detail: { id } }));
// App.jsx:3613
window.addEventListener("sciverse:material-created", refresh);
```

Se usa un evento global del navegador para que la biblioteca se entere de un guardado. Es un canal invisible para las herramientas de React, no tipado, imposible de depurar y que no falla ruidosamente si el escuchador desaparece.

**Solución.** Invalidación explícita desde `useMaterials`, o React Query si se adopta. **P2 · S**

### 6.3 Sin ningún `useMemo` en listas

**Cero usos** de `useMemo` en `App.jsx`. La operación más costosa:

```js
// App.jsx:3622
const visibleMaterials = teacherMaterials
  .filter(...)   // 3 condiciones, incluida toLowerCase() por elemento
  .sort(...);    // new Date() × 2 por comparación
```

Se recalcula en **cada** render, incluidos los provocados por abrir un modal o cambiar de sección.

**Solución.** `useMemo` con dependencias explícitas. **P2 · XS**

---

## 7. Manejo de errores

### 7.1 Fallos de guardado silenciados — el defecto más dañino

```js
// App.jsx:989
try { await saveTeacherMaterial({...}); }
catch (saveError) { console.error("No se pudo guardar el material", saveError); }
```

Mismo patrón en `App.jsx:1179` y en `ResourceFromAI` (build).

**Por qué importa.** La docente ve el resultado en pantalla y asume que está guardado. Si falla —`CHECK` de `tipo`, token vencido, red— **el material no aparece nunca en su biblioteca y nadie se lo dice.**

**Solución.** Estado visible de guardado, alerta con reintento, respaldo en `localStorage`.

**Prioridad P0 · Esfuerzo S**

### 7.2 Errores técnicos expuestos

```js
// App.jsx:3503
catch(e){ setError(e.message); }
```

`e.message` puede ser el texto de una violación de `CHECK` de Postgres. Ver `03-UX-AUDIT.md` §8.2.

**Prioridad P1 · Esfuerzo S**

### 7.3 Sin `ErrorBoundary`

**Cero** en toda la aplicación. Un error de render en cualquier generador deja **la pantalla en blanco**, sin mensaje ni forma de recuperarse salvo recargar — perdiendo todo el trabajo.

**Solución.** `ErrorBoundary` en la raíz y otro por sección, con Kantu, explicación y botón de recarga.

**Prioridad P1 · Esfuerzo S**

### 7.4 Sin `AbortController`

**Cero** usos. Las llamadas a Gemini duran 15-30 s cada una, 4 por sesión. Si la docente navega a otra sección, la petición sigue viva y su `setState` se ejecuta sobre un componente desmontado.

**Prioridad P2 · Esfuerzo S**

---

## 8. Rendimiento del código

| Técnica | Usos | Efecto |
|---|---|---|
| `React.lazy` / `Suspense` | **0** | Bundle único: la landing pública carga `docx`, los 9 generadores y el panel admin |
| `React.memo` | **0** | Tarjetas de listas se re-renderizan siempre |
| `useMemo` | **0** | Filtrado y ordenación en cada render |
| `useCallback` | 1 | Solo `loadTeacherMaterials` |

**Caso más costoso.** `AdminPanel.jsx` se importa **estáticamente** en `main.jsx:4` aunque solo se use con `?admin=1`. Cada docente descarga el panel de administración.

Igual ocurre con `docx` (la dependencia más pesada): la carga el visitante anónimo de la landing sin necesitarla jamás.

**Solución.** `React.lazy` para `AdminPanel`, para cada generador y para los exportadores Word (importación dinámica en el momento de descargar).

Detalle cuantificado en `15-PERFORMANCE-AUDIT.md`.

---

## 9. Convenciones y legibilidad

### 9.1 Dos estilos de formato mezclados

```js
// Estilo A — espaciado, legible (App.jsx:885-1000)
const [form, setForm] = useState({ nivel: initialLevel, grado: "3.º" });

// Estilo B — comprimido, sin espacios (App.jsx:3622-3626)
const visibleMaterials=teacherMaterials.filter(item=>(libraryType==="todos"||item.tipo===libraryType||(libraryType==="instrumentos"&&["rubric","checklist"].includes(item.tipo)))&&...
```

Hay **líneas de más de 500 caracteres**. `App.jsx:3512` (`LibraryEmpty`) es un componente entero en una sola línea. `App.jsx:3733` contiene toda la retícula de la biblioteca en una línea.

**Causa.** Sin Prettier y con edición mediante la web de GitHub, nada normaliza el formato.

**Solución.** Prettier con `printWidth: 100` más ESLint. **Ejecutar el formateo en un commit propio y aislado**, sin mezclarlo con cambios funcionales.

**Prioridad P1 · Esfuerzo S**

### 9.2 Idiomas mezclados

`form.nivel`, `form.grado`, `criteriosEvaluacion` conviven con `loading`, `setError`, `handleGenerate`. Los nombres de dominio en español están bien (es un producto peruano sobre el CNEB); lo que falta es una regla escrita: **dominio en español, técnica en inglés**.

**Prioridad P3 · Esfuerzo XS**

### 9.3 Sin tipos ni validación de props

Sin TypeScript ni PropTypes. Todos los componentes usan valores por defecto (`profile = {}`), lo que **oculta los errores** en lugar de revelarlos: si `profile` llega vacío, la interfaz muestra huecos en blanco sin avisar.

**Recomendación.** No migrar a TypeScript ahora — el retorno no compensa el coste con el equipo actual. Sí añadir JSDoc en los módulos compartidos (`lib/`, `hooks/`) para tener autocompletado sin cambiar de lenguaje.

**Prioridad P3 · Esfuerzo M**

---

## 10. Deuda específica notable

### 10.1 Fuentes cargadas dos veces con `@import` bloqueante

```jsx
// App.jsx:3643
<style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk...');`}</style>
```

Ya se cargan en `index.html:8`. Un `@import` dentro de un `<style>` inyectado por React **bloquea el render** y añade un viaje de red innecesario.

**Solución.** Eliminar el bloque. **P1 · XS**

### 10.2 Media queries de impresión duplicadas

Reglas `@media print` en `App.jsx:3645` (dentro del componente) y en `index.css` (añadidas por el codemod). Se solapan y pueden contradecirse.

**Solución.** Un único `styles/print.css`. **P2 · XS**

### 10.3 `updated_at` nunca se actualiza

`materiales_docente.updated_at` existe con `default now()` pero ningún código lo modifica: no hay UPDATE en toda la aplicación (los materiales no se pueden editar). Cuando exista edición, hará falta un trigger.

**P2 · XS** — anotar para cuando se implemente la edición.

### 10.4 Datos y código mezclados

`ACTIVITIES`, `RETOS`, `TEMPLATE_CONTENT`, `PLANS`, `TESTIMONIALS` viven dentro de `App.jsx` (líneas 292-884, ~590 líneas). Cambiar el precio de un plan obliga a tocar el archivo que contiene la lógica de generación de Word.

**Solución.** Mover a `src/data/` y `src/config/`. **P2 · S**

### 10.5 `tailwind.config.js` con cobertura incorrecta

```js
content: ["./index.html", "./*.{js,jsx}", "./src/**/*.{js,jsx}"]
```

Incluye `src/` (muerto) y **excluye `components/`** (donde hay 1.563 líneas que podrían revivirse).

**Solución.** Corregir tras la reorganización de carpetas. **P2 · XS**

### 10.6 Dos lockfiles simultáneos

`package-lock.json` (103 KB) y `pnpm-lock.yaml` (60 KB) más `pnpm-workspace.yaml`. Vercel prioriza pnpm cuando existe su lockfile; `package-lock.json` queda ignorado y ambos divergen con el tiempo.

**Solución.** Elegir uno, borrar el otro y fijar `packageManager` en `package.json`. **P1 · XS**

---

## 11. Resumen de deuda técnica frontend

| # | Problema | Archivos | Prioridad | Esfuerzo |
|---|---|---|---|---|
| F1 | El build reescribe el código fuente | `apply-sciverse-v2.mjs`, `package.json:8` | **P0** | S |
| F2 | Guardado que falla en silencio | `App.jsx:989`, `:1179` | **P0** | S |
| F3 | Sin `ErrorBoundary` | toda la app | **P1** | S |
| F4 | Directorio `src/` muerto (2.100 líneas) | `src/**` | **P1** | XS |
| F5 | Directorio `components/` muerto (1.563 líneas) | `components/**` | **P1** | S |
| F6 | Código muerto en `App.jsx` (440 líneas) | `App.jsx:2617-3298` | **P1** | S |
| F7 | Código inalcanzable tras `return` | `App.jsx:3078-3290` | **P1** | XS |
| F8 | `App.jsx` de 3.776 líneas | `App.jsx` | **P1** | L |
| F9 | Nueve generadores sin abstracción común | `App.jsx:885-2333` | **P1** | M |
| F10 | Tres paletas divergentes | `App.jsx:69`, `AuthGate.jsx:5`, `AdminPanel.jsx:4` | **P1** | S |
| F11 | Sin linter ni formateador | raíz | **P1** | S |
| F12 | Dos lockfiles | raíz | **P1** | XS |
| F13 | `@import` de fuentes bloqueante y duplicado | `App.jsx:3643` | **P1** | XS |
| F14 | 20 `useState` en un componente | `App.jsx:3585` | **P1** | M |
| F15 | Sin `useMemo` en listas filtradas | `App.jsx:3622` | **P2** | XS |
| F16 | Sin `AbortController` | generadores | **P2** | S |
| F17 | Alias de color engañosos | `App.jsx:81-83` | **P2** | S |
| F18 | Exportadores Word duplicados | `App.jsx:100-139` | **P2** | S |
| F19 | Bus de eventos con `window` | `App.jsx:125`, `:3613` | **P2** | S |
| F20 | ZIP y `.txt` versionados (234 KB) | raíz | **P2** | XS |
| F21 | Datos mezclados con código | `App.jsx:292-884` | **P2** | S |
| F22 | Formato inconsistente, líneas de 500+ caracteres | `App.jsx` | **P2** | S |
| F23 | `tailwind.config.js` con cobertura incorrecta | `tailwind.config.js:3` | **P2** | XS |
| F24 | `@media print` duplicada | `App.jsx:3645`, `index.css` | **P2** | XS |
| F25 | Sin tipos ni validación de props | toda la app | **P3** | M |

---

## 12. Conclusión

El frontend no es malo por ignorancia técnica: los exportadores de Word, el algoritmo de sopa de letras y el encadenamiento de módulos de IA están bien resueltos. **Es malo por el proceso.** Editar a mano en la web de GitHub, sin linter, sin entorno local y con un codemod de build produce exactamente estos síntomas: código muerto que nadie detecta, cinco copias del mismo bloque, y 210 líneas inalcanzables tras un `return`.

Arreglar el proceso —eliminar el codemod, añadir Prettier y ESLint, permitir el build local— evita que la deuda se regenere. **Ese es el trabajo de mayor retorno del proyecto, y es el que hay que hacer primero.**
