# 21 — Quick wins

> ⚠️ **Una afirmación de este documento es incorrecta.** Lo que se dice aquí sobre el modelo `gemini-3.6-flash` (que no existiría y rompería la IA) es **falso**: es un modelo válido y estable de la API de Gemini. El resto del documento se mantiene. Detalle en [`25-AUDIT-CORRECTIONS.md`](25-AUDIT-CORRECTIONS.md) §C-1.

> ⚠️ **Una afirmación de este documento es incorrecta.** Lo que se dice aquí sobre `onChoosePlan` (que elegir un plan de pago llevaría al registro) es **falso**: `PlansModal` ya abre WhatsApp correctamente. El resto del documento se mantiene. Detalle en [`25-AUDIT-CORRECTIONS.md`](25-AUDIT-CORRECTIONS.md) §C-2.


Cambios pequeños con gran impacto.

> ⚠️ **NO IMPLEMENTAR.** Este documento es parte de la fase de análisis. La aplicación debe quedar exactamente igual.

Todos los elementos son de esfuerzo **XS (< 2 h)** o **S (medio día)**, sin dependencias entre sí salvo donde se indique.

---

## Tabla resumen

| # | Quick win | Esfuerzo | Impacto | Riesgo |
|---|---|---|---|---|
| QW-01 | Límite de presupuesto en Google Cloud | XS | Muy alto | Nulo |
| QW-02 | Optimizar los PNG de Kantu | XS | Muy alto | Nulo |
| QW-03 | Añadir `'challenge'` al `CHECK` de `tipo` | XS | Muy alto | Bajo |
| QW-04 | Secreto admin fuera de la URL | XS | Muy alto | Bajo |
| QW-05 | Paginar y limitar columnas en `list-docentes` | XS | Muy alto | Bajo |
| QW-06 | Fijar un modelo de Gemini válido | XS | Muy alto | Bajo |
| QW-07 | Importar `CreditsIndicator` | XS | Alto | Bajo |
| QW-08 | Quitar `contenido` del listado de biblioteca | XS | Alto | Bajo |
| QW-09 | Regla global `:focus-visible` | XS | Alto | Nulo |
| QW-10 | Arreglar `onChoosePlan` | XS | Alto | Nulo |
| QW-11 | Metadatos y Open Graph | XS | Alto | Nulo |
| QW-12 | Eliminar el `@import` de fuentes duplicado | XS | Medio | Nulo |
| QW-13 | Eliminar un lockfile | XS | Alto | Bajo |
| QW-14 | Añadir `.gitattributes` | XS | Alto | Nulo |
| QW-15 | Actualizar `.env.example` | XS | Medio | Nulo |
| QW-16 | `React.lazy` para `AdminPanel` | XS | Medio | Nulo |
| QW-17 | `useMemo` en el filtrado de biblioteca | XS | Medio | Nulo |
| QW-18 | Enlazar términos desde el registro | XS | Medio | Nulo |
| QW-19 | Leer `profile.plan` en la barra lateral | XS | Medio | Nulo |
| QW-20 | Corregir la estadística duplicada del dashboard | XS | Bajo | Nulo |
| QW-21 | Guardado visible con reintento | S | Muy alto | Bajo |
| QW-22 | Retirar "Crucigrama" del catálogo | S | Alto | Bajo |
| QW-23 | Mensajes de error en español | S | Alto | Bajo |
| QW-24 | Autoguardado de formularios | S | Muy alto | Bajo |
| QW-25 | Reenviar el correo de confirmación | S | Muy alto | Bajo |
| QW-26 | Añadir "Sesión" al catálogo de creación | XS | Alto | Bajo |
| QW-27 | Exponer "Guía de observación" y "Cuestionario" | S | Alto | Bajo |
| QW-28 | Diccionario único de tipos de material | S | Alto | Bajo |
| QW-29 | Pasar el contexto del reto al crear instrumento | S | Medio | Bajo |
| QW-30 | Eliminar código muerto de `App.jsx` | S | Medio | Bajo |

---

## Detalle

### QW-01 · Límite de presupuesto en Google Cloud

**Dónde.** Consola de Google Cloud, no el código.

**Por qué.** `/api/generate-session` no consume créditos y hace 4 llamadas por sesión. No hay ningún techo de gasto — ni en la aplicación ni en la plataforma.

**Qué hacer.** Presupuesto mensual con alertas al 50 %, 80 % y 100 %.

**Es la única medida que acota el riesgo económico sin tocar código.** Debería hacerse el mismo día.

---

### QW-02 · Optimizar los PNG de Kantu

**Dónde.** `public/mascot/kantu-material.png` (891 KB) y `kantu-session.png` (875 KB).

**Por qué.** Se muestran entre 52 y 140 px. **1,77 MB** para imágenes de 100 píxeles. En 3G son más de 9 segundos, y son datos del bolsillo de la docente.

**Qué hacer.** Convertir a WebP con calidad 85 y redimensionar a 300 px de ancho.

**Resultado esperado:** 1,77 MB → menos de 60 KB. **El mayor ahorro de rendimiento del proyecto, en minutos.**

---

### QW-03 · Añadir `'challenge'` al `CHECK` de `tipo`

**Dónde.** Restricción `materiales_docente_tipo_check`; `App.jsx:3503` escribe ese valor.

**Por qué.** Ninguno de los cuatro archivos SQL lo permite. **Todo reto generado con IA falla al guardarse**, el crédito ya se gastó y la docente ve un error crudo de Postgres.

**Qué hacer.** Migración que redefina el `CHECK` con los 10 valores (los 9 de `supabase-session-flow-v2.sql` más `challenge`).

**Ojo:** también resuelve la contradicción entre `supabase-session-resources.sql` y `supabase-session-flow-v2.sql`, que hoy hace que `reading` funcione o no según el orden de ejecución.

---

### QW-04 · Secreto admin fuera de la URL

**Dónde.** `AdminPanel.jsx:23`, `api/list-docentes.js:11`.

**Por qué.** `?secret=...` queda en los logs de Vercel, el historial del navegador y posiblemente la cabecera `Referer`.

**Qué hacer.** Enviarlo por cabecera `Authorization`, comparar con `crypto.timingSafeEqual`, y **rotar el secreto actual** — que ya está en los logs históricos.

---

### QW-05 · Paginar y limitar columnas en `list-docentes`

**Dónde.** `api/list-docentes.js:26` — `select("*")` sin paginación.

**Por qué.** Devuelve nombre, correo, celular e institución de **todos** los docentes en una respuesta.

**Qué hacer.** Columnas explícitas (sin `celular` por defecto) y `range(page*limit, ...)`.

---

### QW-06 · Fijar un modelo de Gemini válido

**Dónde.** Los cuatro endpoints: `process.env.GEMINI_MAIN_MODEL || "gemini-3.6-flash"`.

**Por qué.** `gemini-3.6-flash` no corresponde a ningún modelo publicado. Todo depende de que la variable esté bien puesta en Vercel — y **no está documentada en `.env.example`**. Un despliegue nuevo nace con la IA rota.

**Qué hacer.** Poner un identificador válido como valor por defecto y documentar la variable.

---

### QW-07 · Importar `CreditsIndicator`

**Dónde.** `components/CreditsIndicator.jsx` existe y funciona; nadie lo importa.

**Por qué.** Es el único consumidor de `/api/credits`. Sin él, **la docente no sabe cuántas generaciones le quedan**, y Mi cuenta muestra "0 / 1" con números inventados (`App.jsx:3572`).

**Qué hacer.** Importarlo en la barra superior.

**El endpoint, la función RPC y el componente ya están escritos. Solo falta conectarlos.**

---

### QW-08 · Quitar `contenido` del listado de biblioteca

**Dónde.** `App.jsx:3606`.

**Por qué.** Trae el `jsonb` completo de 100 materiales solo para pintar tarjetas de resumen. Una sesión puede pesar 15-30 KB: la consulta puede devolver **1-3 MB** para mostrar título, tipo y fecha.

**Qué hacer.** Quitar `contenido` del `select` y cargarlo solo al abrir un material.

**Quitar una palabra ahorra megabytes por carga.**

---

### QW-09 · Regla global `:focus-visible`

**Dónde.** `index.css` — solo 3 reglas `:focus` en 99 KB.

**Por qué.** Navegar con `Tab` es prácticamente a ciegas.

**Qué hacer.**

```css
:focus-visible {
  outline: 2px solid #1F9E98;
  outline-offset: 2px;
}
```

**Una regla resuelve el mayor bloqueo de accesibilidad por teclado.**

---

### QW-10 · Arreglar `onChoosePlan`

**Dónde.** `App.jsx:2601` pasa `onChoosePlan={onRegister}`, anulando el `choosePlan` con la lógica de WhatsApp definido en `:2505` y nunca usado.

**Por qué.** Pulsar "Elegir plan mensual" lleva al registro en vez de al pago. **Se pierde la conversión en el punto de máxima intención.**

**Qué hacer.** Pasar `choosePlan` en lugar de `onRegister`.

**Un solo argumento.**

---

### QW-11 · Metadatos y Open Graph

**Dónde.** `index.html` — solo tiene `charset`, `viewport` y `title`.

**Por qué.** Sin `og:image` ni `og:description`, un enlace compartido por WhatsApp aparece **sin previsualización** — y WhatsApp es el canal principal entre docentes peruanos.

**Qué hacer.** Añadir `description`, Open Graph, Twitter Card, canonical y favicon.

---

### QW-12 · Eliminar el `@import` de fuentes duplicado

**Dónde.** `App.jsx:3643` — un `<style>` con `@import` de las mismas fuentes que ya carga `index.html:8`.

**Por qué.** Un `@import` dentro de un `<style>` inyectado por React **bloquea el renderizado** y repite una petición ya hecha.

**Qué hacer.** Eliminar el bloque.

---

### QW-13 · Eliminar un lockfile

**Dónde.** `package-lock.json` y `pnpm-lock.yaml` coexisten, más `pnpm-workspace.yaml`.

**Por qué.** Vercel elige gestor según lo que detecte. **No hay garantía de que lo desplegado sea lo probado.**

**Qué hacer.** Elegir uno, borrar el otro, fijar `"packageManager"` en `package.json`.

---

### QW-14 · Añadir `.gitattributes`

**Dónde.** No existe.

**Por qué.** El blob de Git tiene LF, pero el árbol de trabajo en Windows tiene CRLF por `core.autocrlf=true`. Las anclas del codemod usan LF, así que **`npm run build` falla siempre en local en Windows** — verificado.

**Qué hacer.** Crear `.gitattributes` con `* text=auto eol=lf` y renormalizar.

**Sin esto, nadie puede verificar un build antes de desplegar.**

---

### QW-15 · Actualizar `.env.example`

**Dónde.** Faltan `GEMINI_MAIN_MODEL` y `VITE_SUPABASE_PUBLISHABLE_KEY`, ambas leídas por el código.

**Por qué.** Un despliegue nuevo siguiendo la documentación del propio repositorio queda mal configurado.

---

### QW-16 · `React.lazy` para `AdminPanel`

**Dónde.** `main.jsx:4` lo importa estáticamente.

**Por qué.** Cada docente descarga el panel de administración aunque nunca lo abra. Además de peso, es superficie innecesaria.

---

### QW-17 · `useMemo` en el filtrado de biblioteca

**Dónde.** `App.jsx:3622`.

**Por qué.** Filtrado y ordenación se recalculan en **cada** render. Como `SciVerseApp` tiene 20 `useState`, eso incluye abrir cualquier modal o cambiar de sección. Escribir "ecosistema" dispara 10 filtrados y 10 ordenaciones completas.

---

### QW-18 · Enlazar términos desde el registro

**Dónde.** `AuthGate.jsx:249` — el texto del checkbox es plano, no enlaces.

**Por qué.** Exigir aceptar un documento sin darlo a leer es débil legalmente. `LegalModal` ya existe.

---

### QW-19 · Leer `profile.plan` en la barra lateral

**Dónde.** `App.jsx:3661` — "Plan actual: **Gratuito**" codificado en duro.

**Por qué.** Una docente que pagó sigue viendo "Gratuito".

---

### QW-20 · Corregir la estadística duplicada

**Dónde.** `App.jsx:3695` — "Creaciones realizadas" y "Mis materiales" son ambas `teacherMaterials.length`.

**Por qué.** Dos tarjetas que ocupan la mitad del ancho para decir lo mismo.

---

### QW-21 · Guardado visible con reintento

**Dónde.** `App.jsx:989`, `:1179` — `try { ... } catch { console.error }`.

**Por qué.** La docente ve el resultado y cree que está guardado. Si falló, **no aparece nunca en su biblioteca y nadie se lo dice.**

**Qué hacer.** Estado visible ("Guardando…" → "Guardado ✓" → "No se pudo guardar ⚠") con "Reintentar" y "Descargar ahora".

**Elimina la pérdida silenciosa de trabajo, que es el defecto más dañino del producto.**

---

### QW-22 · Retirar "Crucigrama" del catálogo

**Dónde.** `CreateStudio` de producción, categoría "Juegos". El componente está en `App.jsx:1950`.

**Por qué.** `setTimeout(1200)` y devuelve las pistas que la docente pegó. **No genera cuadrícula.** Está rotulado "CREAR CON KANTU".

**Qué hacer.** Quitarlo del catálogo hasta que exista una implementación real. `WordSearchGenerator` (`App.jsx:1209`) es el modelo a seguir.

---

### QW-23 · Mensajes de error en español

**Dónde.** `App.jsx:3503` — `setError(e.message)` puede mostrar el texto de una violación de `CHECK` de Postgres.

**Qué hacer.** Mapa de códigos a mensajes con acción sugerida (tabla en `03-UX-AUDIT.md` §8.2).

---

### QW-24 · Autoguardado de formularios

**Dónde.** Los asistentes viven solo en `useState`.

**Por qué.** Rellenar propósito, contexto y evidencia lleva varios minutos de escritura reflexiva. Un toque accidental en móvil lo borra todo.

**Qué hacer.** `localStorage` con debounce de 500 ms y aviso al volver.

---

### QW-25 · Reenviar el correo de confirmación

**Dónde.** `AuthGate.jsx:215` — solo hay "Ya confirmé mi cuenta".

**Por qué.** Si el correo no llega —van a spam con frecuencia— la docente **no tiene ninguna acción disponible**. La cuenta se pierde en silencio.

**Qué hacer.** `supabase.auth.resend()` con cuenta atrás de 60 s, opción de corregir el correo y aviso de spam.

---

### QW-26 · Añadir "Sesión de aprendizaje" al catálogo

**Dónde.** El `CreateStudio` de producción no la incluye: solo se alcanza desde el dashboard.

**Por qué.** Es la función principal del producto. Quien entra en "Crear" y no la encuentra concluye que no existe.

---

### QW-27 · Exponer "Guía de observación" y "Cuestionario"

**Dónde.** `api/generate-session-resource.js` ya tiene sus esquemas y funciona.

**Por qué.** Dos instrumentos habituales en el aula peruana, construidos y sin interfaz.

**Qué hacer.** Añadirlos al catálogo. **Depende de QW-03** (que sus tipos estén permitidos en la base).

---

### QW-28 · Diccionario único de tipos de material

**Dónde.** `App.jsx:3619` mapea 5 de 9 tipos; el filtro de `:3729` tampoco incluye los nuevos.

**Por qué.** Los materiales de las funciones más recientes aparecen como "Material" genérico y **no se pueden filtrar**.

---

### QW-29 · Pasar el contexto del reto al crear instrumento

**Dónde.** `App.jsx:3737` — cierra el modal y salta a "crear" sin transferir nada.

**Por qué.** La docente debe reescribir tema, área y competencia a mano.

**El patrón ya existe:** `SteamGenerator` pasa `initialContext` a `EvaluationInstrumentGenerator` (`App.jsx:1132`). Solo hay que reutilizarlo.

---

### QW-30 · Eliminar código muerto de `App.jsx`

**Dónde.** `RegistrationGate` (2855-3298), código inalcanzable tras `return` (3078-3290), `LoginModal` (2695), `PasswordRecoveryModal` (2761), `ResetPasswordPage` (2617).

**Por qué.** ~650 líneas que nunca se ejecutan pero se compilan y confunden a quien lea el archivo — especialmente `RegistrationGate`, que parece la autenticación real y no lo es.

> ⚠️ **Depende de eliminar antes el codemod** (`19-` B-001): borrar líneas de `App.jsx` puede invalidar una de las 9 anclas de `apply-sciverse-v2.mjs` y **romper el despliegue**.

---

## Plan de ejecución sugerido

### Día 1 — Contención (todo XS, sin dependencias)

QW-01 · QW-02 · QW-06 · QW-09 · QW-10 · QW-11 · QW-12 · QW-15 · QW-20

Cierra el riesgo de coste, elimina 1,7 MB, arregla la conversión de planes y desbloquea la navegación por teclado.

### Día 2 — Seguridad y datos

QW-03 · QW-04 · QW-05 · QW-08 · QW-13 · QW-14

Cierra las tres P0 de seguridad, repara los retos grupales y hace posible construir en local.

### Días 3-4 — Confianza del usuario

QW-07 · QW-21 · QW-22 · QW-23 · QW-25

Elimina la pérdida silenciosa de trabajo, hace visibles los créditos, retira la herramienta falsa y recupera cuentas perdidas.

### Día 5 — Pulido

QW-16 · QW-17 · QW-18 · QW-19 · QW-24 · QW-26 · QW-27 · QW-28 · QW-29

*(QW-30 queda para después de eliminar el codemod.)*

---

## Impacto acumulado

**Una semana de trabajo enfocado elimina:**

- 4 vulnerabilidades P0 de seguridad
- El riesgo de gasto descontrolado en IA
- 1,77 MB de peso por sesión
- 1-3 MB por carga de biblioteca
- 2 funciones completamente rotas (retos grupales, elección de plan)
- 1 herramienta falsa publicada como IA
- La pérdida silenciosa del trabajo de la docente
- El punto muerto del correo de confirmación
- El mayor bloqueo de accesibilidad por teclado
- La imposibilidad de construir en local

Ninguno de estos cambios reestructura nada. Todos son compatibles con el codemod actual salvo QW-30, que está explícitamente marcado.
