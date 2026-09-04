# 15 — Auditoría de rendimiento

> **Nota metodológica.** `node_modules/` no está instalado y no se ejecutó ningún build (la auditoría es de solo lectura). Las cifras de bundle son **estimaciones** basadas en tamaños de fuente y tamaños publicados de las dependencias. Las de assets son **medidas reales**.

---

## 1. Resumen

| Área | Estado | Hallazgo principal |
|---|---|---|
| **Imágenes** | 🔴 Crítico | **1,77 MB en dos PNG** mostrados a ~100 px |
| **Bundle JS** | 🟠 Alto | Bundle único: sin `lazy`, `Suspense` ni división por rutas |
| **CSS** | 🟠 Alto | 109 KB sin dividir; Tailwind escanea archivos muertos |
| **Renderizado** | 🟠 Alto | 0 `useMemo`, 0 `React.memo`, 20 `useState` en un componente |
| **Fuentes** | 🟡 Medio | Cargadas dos veces, la segunda con `@import` bloqueante |
| **Consultas Supabase** | 🟡 Medio | `limit(100)` con filtrado en cliente |
| **Peticiones a la API** | 🟠 Alto | 4 llamadas secuenciales + 4 verificaciones de token redundantes |

---

## 2. 🔴 Imágenes — el mayor problema, y el más fácil de arreglar

### Medición real

```
public/mascot/kantu-material.png    912.892 bytes  (891 KB)
public/mascot/kantu-session.png     896.292 bytes  (875 KB)
                                  ─────────────────────────
                                  1.809.184 bytes  (1,77 MB)
```

### Dónde se muestran

`kantu-material.png` aparece **6 veces** en `App.jsx` y **3 más** en el código que inyecta el codemod:

| Ubicación | Tamaño mostrado |
|---|---|
| Banner "Crear clase completa" | ~105 px |
| Tarjeta de ayuda del dashboard | ~52 px |
| Introducción de `CreateStudio` | ~80 px |
| Estado vacío de la biblioteca | ~120 px |
| Pantalla de generación en curso | ~140 px |

**Se descarga una imagen de 891 KB para mostrarla a 52 píxeles.**

### Impacto real

El público objetivo son docentes peruanos, muchos con datos móviles o conexiones escolares limitadas.

| Conexión | Tiempo de descarga de 1,77 MB |
|---|---|
| Fibra (20 Mbps) | ~0,7 s |
| 4G medio (5 Mbps) | ~2,8 s |
| 3G (1,5 Mbps) | **~9,4 s** |
| Conexión escolar saturada | **más de 15 s** |

Y no es solo tiempo: **es consumo de datos del bolsillo de la docente**, cada visita si la caché no acompaña.

### Solución

| Acción | Ahorro estimado |
|---|---|
| Convertir a WebP con calidad 85 | ~85 % (891 KB → ~130 KB) |
| Redimensionar a 3 tamaños (150/300/600 px) y usar `srcset` | ~95 % en el caso más común |
| `loading="lazy"` en las que no están en el primer pantallazo | Descarga diferida |
| **Convertir a SVG** si el diseño lo permite | ~98 % (a ~15 KB), y escala perfecto |

**Con WebP más redimensionado, 1,77 MB pasan a menos de 60 KB.** Es el cambio de mayor impacto de todo el documento y no requiere tocar una línea de lógica.

**P0 · Esfuerzo XS**

> **Nota adicional.** `kantu-session.png` se usa una sola vez, en la pantalla de generación en curso (`App.jsx:1051`), elegida condicionalmente frente a `kantu-material.png`. Casi 900 KB para una imagen que la mayoría de docentes ve unos segundos.

---

## 3. Bundle de JavaScript

### Entradas al bundle

| Archivo | Tamaño fuente |
|---|---|
| `App.jsx` | 277,5 KB |
| `steamGuideActivities.js` | 30,4 KB |
| `AuthGate.jsx` | 16,1 KB |
| `AdminPanel.jsx` | 4,3 KB |
| `supabaseClient.js` + `main.jsx` | 1,0 KB |
| **Código propio** | **~329 KB** |

Más las dependencias:

| Paquete | Estimación minificada |
|---|---|
| `react` + `react-dom` | ~140 KB |
| `@supabase/supabase-js` | ~120 KB |
| `docx` | ~300 KB+ |
| `lucide-react` (con *tree-shaking*, ~90 iconos) | ~40 KB |

**Estimación total: 700-900 KB minificados**, del orden de **200-280 KB comprimidos con gzip**, en **un solo archivo** que se descarga entero antes de pintar nada.

### 3.1 🟠 Sin división de código

**Cero usos** de `React.lazy` y `Suspense`.

Consecuencias concretas:

| Qué se descarga | Quién lo necesita |
|---|---|
| `docx` (~300 KB) | Solo quien descarga un Word — **no el visitante de la landing** |
| `AdminPanel.jsx` | Solo el administrador — **importado estáticamente en `main.jsx:4`** |
| Los 9 generadores | Solo el que se abre |
| Catálogo de 17 actividades (30 KB) | Solo quien entra a Actividades |
| `RegistrationGate` muerto (~440 líneas) | **Nadie** |
| Los 5 generadores simulados | **Nadie en producción** (4 de ellos) |

**Un visitante anónimo que solo mira la landing descarga la librería de generación de documentos Word y el panel de administración.**

**Solución.**

```js
// PROPUESTO — todavía no existe
const AdminPanel = lazy(() => import("./AdminPanel.jsx"));
const CreateStudio = lazy(() => import("./features/create/CreateStudio.jsx"));
// y la importación dinámica de docx en el momento de descargar:
const { Document, Packer } = await import("docx");
```

**Ahorro estimado en la carga inicial: 40-50 %.**

**P1 · Esfuerzo M**

### 3.2 🟡 Código muerto en el bundle

| Qué | Líneas | ¿Se elimina en el build? |
|---|---|---|
| `RegistrationGate` | ~440 | ❌ Es una función exportable en el ámbito del módulo |
| Código tras `return` (`App.jsx:3078-3290`) | ~210 | ⚠️ Parcialmente, según el minificador |
| `LoginModal`, `PasswordRecoveryModal`, `ResetPasswordPage` | ~200 | ❌ |
| Generadores simulados inalcanzables en producción | ~300 | ❌ |

Rollup elimina exportaciones no usadas entre módulos, pero **dentro de un solo archivo de 3.776 líneas casi todo queda incluido**. Es otro coste de tener un archivo monolítico.

**Solución.** Eliminar el código muerto (`05-` §3) y dividir en módulos, que es lo que permite el *tree-shaking* real.

**P1 · Esfuerzo S**

---

## 4. CSS

| Archivo | Tamaño |
|---|---|
| `index.css` | 99,5 KB |
| `library.css` | 10,1 KB |
| **Total** | **109,6 KB** |

Sin dividir, sin CSS crítico en línea, cargado íntegro antes de pintar.

### 4.1 Tailwind escanea archivos muertos

```js
// tailwind.config.js:3
content: ["./index.html", "./*.{js,jsx}", "./src/**/*.{js,jsx}"]
```

Incluye `src/` (2.100 líneas muertas), así que **se genera CSS para clases que ningún componente vivo usa**.

Y excluye `./components/**`, con lo que si esos componentes se revivieran, sus clases se purgarían.

**P2 · Esfuerzo XS**

### 4.2 El codemod añade CSS en cada build

`apply-sciverse-v2.mjs:121-143` añade dos bloques grandes a `index.css`. Está protegido por marcador (idempotente), pero significa que el CSS de producción es mayor que el del repositorio y que **su tamaño real no se puede medir sin ejecutar el build**.

### 4.3 Duplicación de selectores

`.plan-card` aparece **12 veces**, `.faq-item` 6, `.primary-btn` 4. Cada duplicado añade bytes y obliga al navegador a resolver la cascada.

**Solución.** Consolidar al extraer componentes (`04-` §3).

---

## 5. Fuentes

### Cargadas dos veces

```html
<!-- index.html:8 — correcto -->
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet" />
```

```jsx
// App.jsx:3643 — duplicado y bloqueante
<style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk...');`}</style>
```

Un `@import` dentro de un `<style>` inyectado por React **bloquea el renderizado** y añade un viaje de red que ya se hizo.

**Solución.** Eliminar el bloque de `App.jsx`. **P1 · Esfuerzo XS**

### Optimizaciones adicionales

| Acción | Beneficio |
|---|---|
| `preconnect` a `fonts.gstatic.com` (falta; solo está el de `googleapis.com`) | ~100-300 ms |
| Reducir pesos: Space Grotesk carga 3 pesos, Inter 3, JetBrains Mono 1 | ~30-50 KB |
| Autoalojar las fuentes | Elimina 2 dominios externos y mejora privacidad |
| Verificar `font-display: swap` | ✅ Ya presente en la URL |

---

## 6. Rendimiento de renderizado

### 6.1 🟠 Ninguna memoización

| Técnica | Usos |
|---|---|
| `useMemo` | **0** |
| `React.memo` | **0** |
| `useCallback` | 1 |

**El caso más caro:**

```js
// App.jsx:3622
const visibleMaterials = teacherMaterials
  .filter(item => (...3 condiciones, con toLowerCase() por elemento...))
  .sort((a,b) => ... new Date() × 2 por comparación ...);
```

Se recalcula en **cada render** de `SciVerseApp`. Y como ese componente tiene 20 `useState`, se re-renderiza al: escribir una letra en el buscador, cambiar de sección, abrir cualquier modal, cargar materiales o marcar un favorito.

Con 100 materiales, escribir "ecosistema" (10 letras) dispara 10 filtrados y 10 ordenaciones completas, cada uno con ~700 llamadas a `new Date()`.

**Solución.** `useMemo` con dependencias explícitas. **P2 · Esfuerzo XS** — cinco líneas.

### 6.2 🟠 Estado excesivamente centralizado

20 `useState` en `SciVerseApp` (`App.jsx:3585-3602`). Cualquier cambio re-renderiza el árbol completo, incluidas las secciones ocultas.

**Solución.** Estado de navegación al router; estado de servidor a hooks; estado de interfaz local a su componente. (`05-` §6.1)

**P1 · Esfuerzo M**

### 6.3 🟡 Listas sin virtualizar

La biblioteca renderiza hasta 100 tarjetas a la vez, cada una con icono, título, metadatos, fecha y 4 botones.

No es crítico con 100 elementos, pero lo será si se levanta el `limit`.

**Solución.** Paginación en servidor (que además resuelve el problema funcional de `10-` §5) o virtualización.

### 6.4 🟠 Sin `ErrorBoundary`

No es rendimiento en sentido estricto, pero el efecto para la docente es el peor posible: un error de render deja **pantalla en blanco**, sin recuperación salvo recargar y perder el trabajo.

**P1 · Esfuerzo S**

---

## 7. Red y peticiones

### 7.1 🟠 Cuatro llamadas secuenciales para una sesión

```js
// App.jsx:948
for (const moduleName of ["alignment", "sequence", "assessment", "annexes"]) {
  const response = await fetch("/api/generate-session", {...});
}
```

Son **necesariamente secuenciales** porque cada módulo recibe el anterior — la decisión pedagógica es correcta.

Pero cada llamada añade además una verificación redundante del token contra Supabase (`api/generate-session.js:204`): **4 viajes extra** validando el mismo JWT.

| Optimización | Ahorro |
|---|---|
| Verificar el JWT localmente | ~200-400 ms × 4 |
| Orquestar los 4 módulos en el servidor | Elimina 3 viajes cliente↔servidor completos |
| Respuesta en streaming | Percepción de espera mucho menor |

**P1 · Esfuerzo M-L**

### 7.2 🟡 Consulta de biblioteca sin paginar

```js
// App.jsx:3606
.select("id,tipo,titulo,nivel,grado,area,tema,contenido,created_at").limit(100)
```

Trae **`contenido` completo (jsonb)** de 100 materiales solo para mostrar tarjetas de resumen. Una sesión generada puede pesar 15-30 KB de JSON: la consulta puede devolver **1-3 MB** cuando solo se necesitan título, tipo y fecha.

**Solución.** No pedir `contenido` en el listado; cargarlo solo al abrir un material.

**P1 · Esfuerzo XS** — quitar una palabra de la consulta y ahorrar megabytes.

### 7.3 🟡 Sin caché de peticiones

Cada cambio a la sección "biblioteca" recarga desde Supabase. Sin caché ni revalidación en segundo plano.

**Solución.** React Query o un hook `useMaterials` con caché.

---

## 8. Estimación de Core Web Vitals

Sin medición real, pero con las cifras conocidas:

| Métrica | Estimación | Objetivo | Causa principal |
|---|---|---|---|
| **LCP** | 3,5-6 s en 4G | < 2,5 s | Bundle único + 891 KB de mascota + fuentes duplicadas |
| **FID / INP** | 200-400 ms | < 200 ms | Sin memoización; re-renders del árbol completo |
| **CLS** | 0,1-0,25 | < 0,1 | Sin esqueletos; sin dimensiones reservadas en imágenes |
| **TTFB** | Bueno | < 800 ms | CDN de Vercel |

---

## 9. Victorias rápidas

Ordenadas por impacto sobre esfuerzo. Todas de esfuerzo XS o S.

| # | Acción | Ahorro | Esfuerzo |
|---|---|---|---|
| 1 | **Convertir los PNG de Kantu a WebP redimensionado** | **~1,7 MB** | XS |
| 2 | Quitar `contenido` del listado de biblioteca | 1-3 MB por carga | XS |
| 3 | Eliminar el `@import` de fuentes de `App.jsx:3643` | Desbloquea el render | XS |
| 4 | `React.lazy` para `AdminPanel` | ~5 KB y menos superficie | XS |
| 5 | `useMemo` en `visibleMaterials` | Elimina el retardo al escribir | XS |
| 6 | `preconnect` a `fonts.gstatic.com` | 100-300 ms | XS |
| 7 | Reducir pesos de fuentes | 30-50 KB | XS |
| 8 | Quitar `src/**` de `tailwind.config.js` | CSS más pequeño | XS |
| 9 | `loading="lazy"` en imágenes fuera del primer pantallazo | Descarga diferida | XS |
| 10 | Eliminar código muerto de `App.jsx` | ~1.150 líneas | S |

**Las tres primeras suman unos 20 minutos de trabajo y eliminan varios megabytes por sesión.**

---

## 10. Optimizaciones estructurales

| # | Acción | Beneficio | Esfuerzo | Depende de |
|---|---|---|---|---|
| E1 | División de código por ruta y generador | −40-50 % de carga inicial | M | Router (`05-` §4) |
| E2 | Importación dinámica de `docx` | −300 KB para quien no descarga | S | — |
| E3 | Orquestar los módulos de IA en el servidor | −3 viajes; permite streaming | L | `06-` §4 |
| E4 | Verificación local de JWT | −200-400 ms por llamada | M | `06-` §3.1 |
| E5 | Paginación y búsqueda en servidor | Escala más allá de 100 materiales | M | `07-` §3.8 |
| E6 | Caché de peticiones (React Query) | Elimina recargas repetidas | M | — |
| E7 | Descentralizar el estado | Menos re-renders del árbol | M | E1 |
| E8 | Extraer componentes de UI | Elimina duplicación de CSS | L | `04-` |
| E9 | Autoalojar fuentes | −2 dominios externos | S | — |
| E10 | `ErrorBoundary` | Evita pantalla en blanco | S | — |

---

## 11. Prioridades

| Prioridad | Acciones |
|---|---|
| **P0** | Optimizar los PNG de Kantu (1,77 MB → <60 KB) |
| **P1** | Quitar `contenido` del listado · Eliminar `@import` duplicado · División de código · Importación dinámica de `docx` · `ErrorBoundary` · Paginación en servidor |
| **P2** | `useMemo` · `React.lazy` para admin · Corregir `tailwind.config.js` · Reducir pesos de fuentes · `preconnect` · Descentralizar estado |
| **P3** | Autoalojar fuentes · Virtualización · Streaming de IA |

---

## Conclusión

**El mayor problema de rendimiento no es el código: son dos archivos PNG.** 1,77 MB de mascota para mostrarla a 100 píxeles supera con creces el peso de todo el JavaScript de la aplicación, y afecta directamente a docentes con datos móviles limitados.

Después vienen los problemas estructurales: bundle único sin división, `contenido` completo de 100 materiales para pintar tarjetas de resumen, y cero memoización en un componente con 20 estados.

Lo esperanzador es que **las diez victorias rápidas cuestan menos de un día en total** y eliminan varios megabytes por sesión. Ninguna requiere reestructurar nada.
