# 06 — Auditoría de backend y APIs

Siete funciones serverless en Vercel. Seis versionadas en `api/`, una generada durante el build.

---

## 1. Tabla resumen

| Endpoint | Archivo | Auth | Riesgo | Problema | Mejora |
|---|---|---|---|---|---|
| `POST /api/generate-session` | `api/generate-session.js` | Bearer + verificación en Supabase | **P0** | **No consume créditos.** El frontend hace 4 llamadas por sesión (`App.jsx:949`). Límite semanal completamente eludido | Enrutar por `consume_ai_credit`; contar la sesión como **1** generación, no 4 |
| `POST /api/generate-project-steam` | *generado en build* | Bearer + verificación | **P0** | **No consume créditos** ni valida tamaño de entrada. No está versionado: solo existe tras el codemod | Versionar el archivo y añadir consumo de crédito |
| `POST /api/generate-session-resource` | `api/generate-session-resource.js` | Bearer + verificación | **P1** | Consume crédito correctamente. Sin límite de longitud en `req.body`; sin timeout hacia Gemini | Validar tamaño de entrada; `AbortSignal.timeout(45000)` |
| `POST /api/generate-linked-worksheet` | `api/generate-linked-worksheet.js` | Bearer + verificación | **P1** | Consume crédito. Mismo par de carencias | Igual que el anterior |
| `POST /api/generate-with-quota` | `api/generate-with-quota.js` | Bearer | **P1** | **Huérfano: ningún archivo lo invoca.** Envuelve `generate-session` con consumo y devolución de crédito — exactamente lo que falta en P0 | Usarlo, o portar su lógica a `generate-session` |
| `GET /api/credits` | `api/credits.js` | Bearer | **P1** | **Huérfano.** Su único consumidor (`components/CreditsIndicator.jsx`) nunca se importa. La docente jamás ve sus créditos | Importar el componente; mostrar el saldo en la barra superior |
| `GET /api/list-docentes` | `api/list-docentes.js` | `?secret=` en query string | **P0** | Secreto en la URL → queda en logs de Vercel, historial e incluso cabecera `Referer`. `select("*")` sin paginación devuelve **PII de todos los docentes**. Sin límite de intentos | Mover a cabecera `Authorization`; comparación en tiempo constante; columnas explícitas; paginación; limitación de tasa |

---

## 2. Análisis endpoint por endpoint

### 2.1 `POST /api/generate-session` — el más usado y el menos protegido

**Archivo:** `api/generate-session.js` (329 líneas)

| Aspecto | Estado |
|---|---|
| Método | `POST` únicamente (`:189`) ✅ |
| Autenticación | Bearer + `GET /auth/v1/user` contra Supabase (`:204-210`) ✅ |
| Autorización | Ninguna más allá de "está autenticado" |
| **Cuota** | ❌ **Ninguna** |
| Validación de entrada | Parcial: valida `field` contra lista blanca (`:220`) y `module` contra `MODULE_SCHEMAS` (`:224`) ✅. **No valida `form` ni `messages`** ❌ |
| Salida | JSON estructurado por `responseSchema` ✅ |
| Manejo de errores | Genérico, sin filtrar detalles internos (`:326`) ✅ |
| Timeout | ❌ Ninguno |
| Reintentos | ❌ Ninguno |

**Los cinco modos que soporta:** `suggestion`, `instrument`, `challenge`, `module`, y el modo por defecto con `messages`.

#### Problema 1 — Elusión total del límite semanal (P0)

El frontend llama a este endpoint cuatro veces por sesión (`App.jsx:949`), más una vez por cada sugerencia de campo (`:931`), más una por instrumento (`:1174`), más una por reto (`:3503`). **Ninguna consume crédito.**

Una docente puede generar sesiones sin límite. El sistema de créditos existe, funciona, y no protege la ruta que más gasta.

**Coste estimado.** Con `maxOutputTokens` de 4.500-8.192 por módulo y 4 módulos, una sesión consume del orden de 25-30k tokens de salida. Sin tope, el gasto crece de forma lineal con el uso y sin techo.

**Solución.** Envolver con `consume_ai_credit`, pero **contando la sesión completa como una unidad**: consumir un crédito al iniciar el flujo de 4 módulos, no uno por módulo. Requiere un identificador de flujo o mover la orquestación de los 4 módulos al servidor.

#### Problema 2 — Sin validación de tamaño (P1)

```js
const { messages, mode, field, form = {}, instrumentType, module, previous = {} } = req.body || {};
```

`form` y `previous` se interpolan directamente en el prompt (`:167-172`, `:229-250`) sin límite de longitud. `previous` puede ser especialmente grande porque acumula el resultado de los módulos anteriores.

Un cliente modificado puede enviar campos enormes e inflar el prompt hasta el límite del modelo, multiplicando el coste por petición.

**Solución.** Validar con un esquema (Zod o comprobaciones manuales): longitud máxima por campo, tamaño total del `body`, y `mode` contra lista blanca explícita.

#### Problema 3 — Prompt construido por concatenación (P1)

```js
// api/generate-session.js:167
return `Nivel: ${form.nivel}. Grado: ${form.grado}. Área: ${form.area}. Región: ${form.region}. ...`;
```

Todo lo que escribe la docente entra sin marcadores en el prompt. No es inyección clásica —hay `responseSchema` que fuerza la forma del JSON de salida— pero sí permite desviar el contenido: un `tema` con instrucciones puede alterar el tono o el enfoque del resultado.

**Solución.** Delimitar la entrada del usuario con marcadores explícitos y reforzar en `systemInstruction` que el contenido entre delimitadores son datos, no instrucciones.

#### Problema 4 — Verificación de token redundante (P2)

Cada llamada hace `GET /auth/v1/user` contra Supabase (`:204`). Para una sesión completa son **4 viajes extra** verificando el mismo token.

**Solución.** Verificar el JWT localmente con la clave pública del proyecto, o cachear el resultado durante la vida útil del token.

#### Problema 5 — Sin timeout ni reintentos (P1)

`fetch` a Gemini sin `AbortSignal`. Si Gemini tarda, la función serverless llega a su límite de tiempo y devuelve un error de plataforma, no un mensaje útil.

**Solución.** `AbortSignal.timeout(45000)` y un reintento con espera exponencial ante errores 5xx o 429 de Gemini.

---

### 2.2 `POST /api/generate-project-steam` — el endpoint que no está en el repositorio

**Origen:** creado por `apply-sciverse-v2.mjs:150` a partir de una cadena de 101 líneas.

Este es el problema estructural más raro del backend: **existe un endpoint en producción cuyo código fuente solo está como texto dentro de un script de build.** No aparece en `api/`, no se puede revisar en un pull request y no se puede probar sin ejecutar el codemod.

| Aspecto | Estado |
|---|---|
| Autenticación | `authUser()` — Bearer + verificación ✅ |
| **Cuota** | ❌ **Ninguna** |
| Validación | Mínima: comprueba que existan `areasSTEAM`, `tema` y `situacion` |
| Esquema de salida | `PROJECT_SCHEMA` ✅ |
| `maxOutputTokens` | 7.500 — de los más altos del sistema |

**Riesgo combinado:** el endpoint más caro por llamada, sin cuota, y sin revisión de código posible.

**Solución.** Versionarlo en `api/generate-project-steam.js` como parte de la eliminación del codemod (ver `05-FRONTEND-CODE-AUDIT.md` §2) y añadirle consumo de crédito.

---

### 2.3 `POST /api/generate-session-resource` — el mejor construido

**Archivo:** `api/generate-session-resource.js` (341 líneas)

Es el modelo a seguir. Hace bien lo que los demás omiten:

```js
if(!SCHEMAS[type]) return res.status(400).json({error:"Tipo de recurso no válido"});   // lista blanca ✅
const quota = await rpc("consume_ai_credit", token, supabaseUrl, supabaseKey);          // consume ✅
if(!quota?.ok) return res.status(429).json({...});                                       // 429 correcto ✅
// ...
catch(e){
  if(consumed) await rpc("refund_ai_credit", ...).catch(()=>{});                         // devuelve ✅
}
```

Soporta seis tipos (`rubric`, `checklist`, `observation_guide`, `rating_scale`, `worksheet`, `reading`) con esquema propio cada uno.

**Problemas pendientes:**

- Sin límite de tamaño en `req.body` (P1).
- Sin timeout hacia Gemini (P1).
- La devolución del crédito puede fallar en silencio (`.catch(()=>{})`, `:338`): si Gemini falla **y** la devolución también, la docente pierde el crédito sin registro. Debería al menos dejar traza (P2).
- `maxOutputTokens` fijo en 6.000 para `worksheet` y `reading`; si el modelo trunca, se lanza excepción y se devuelve el crédito — correcto, pero la docente pierde la espera sin obtener nada (P2).

---

### 2.4 `POST /api/generate-linked-worksheet`

**Archivo:** `api/generate-linked-worksheet.js` (137 líneas)

Mismo patrón correcto de cuota. Añade una validación destacable:

```js
resource.preguntas = arr(resource.preguntas).slice(0, questionCount);
if (resource.preguntas.length !== questionCount)
  throw new Error("La ficha no llegó con la cantidad solicitada de preguntas.");
```

Verifica que el modelo cumplió la cantidad pedida — **es la única validación semántica del output en todo el backend**. Buen patrón, debería extenderse.

**Problema (P2).** El `throw` dispara la devolución del crédito, pero la docente pierde 30 s y no obtiene nada. Sería mejor reintentar una vez antes de rendirse.

---

### 2.5 `POST /api/generate-with-quota` — el huérfano importante

**Archivo:** `api/generate-with-quota.js` (150 líneas)

Está bien escrito. Envuelve `generate-session` con una respuesta capturada:

```js
const innerRes = createCapturedResponse();
await generateSessionHandler(req, innerRes);
const successful = innerRes.statusCode >= 200 && innerRes.statusCode < 300 && innerRes.payload;
if (!successful) { await callRpc({ name: "refund_ai_credit", ... }); }
```

**Ningún archivo del frontend lo llama.** Se verificó buscando `/api/` en `App.jsx`, `components/*.jsx` y `apply-sciverse-v2.mjs`: aparecen `generate-session`, `generate-session-resource`, `generate-project-steam`, `generate-linked-worksheet` y `credits`. **Este no.**

Es exactamente la pieza que falta para cerrar el agujero P0 de costes, y está desconectada.

**Problema si se conecta tal cual (P1).** Consume **un crédito por llamada**. Como el frontend hace 4 llamadas por sesión, una sesión gastaría los 5 créditos semanales de golpe. Antes de conectarlo hay que decidir la unidad de cobro: lo razonable es una sesión = un crédito, lo que exige mover la orquestación de los 4 módulos al servidor.

---

### 2.6 `GET /api/credits` — el otro huérfano

**Archivo:** `api/credits.js` (46 líneas)

Correcto y simple: llama a `get_ai_credit_status()` con el token de la docente y devuelve `{plan, limit, used, remaining, week_start, next_reset, active}`.

Su único consumidor, `components/CreditsIndicator.jsx:43`, **nunca se importa**. Consecuencia directa: la docente no tiene forma de conocer su saldo en ninguna parte del producto.

**Solución.** Importar el componente y colocarlo en la barra superior. Es de los arreglos con mejor relación impacto/esfuerzo del proyecto: el trabajo ya está hecho.

---

### 2.7 `GET /api/list-docentes` — el mayor riesgo de seguridad

**Archivo:** `api/list-docentes.js` (36 líneas)

```js
const { secret } = req.query;
if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
  res.status(401).json({ error: "No autorizado" });
  return;
}
const supabaseAdmin = createClient(url, serviceKey);
const { data } = await supabaseAdmin.from("docentes").select("*").order("created_at",{ascending:false});
```

Cinco problemas en 36 líneas:

| # | Problema | Severidad |
|---|---|---|
| 1 | **Secreto en query string.** `AdminPanel.jsx:23` lo envía como `?secret=`. Queda registrado en los logs de acceso de Vercel, en el historial del navegador, y puede filtrarse por `Referer` | **P0** |
| 2 | **`select("*")` sin paginación.** Devuelve nombres, apellidos, correo, celular, institución, plan y contadores de **todos** los docentes en una sola respuesta | **P0** |
| 3 | **Sin limitación de intentos.** El endpoint acepta peticiones ilimitadas: el secreto es atacable por fuerza bruta | **P0** |
| 4 | **Comparación no constante en tiempo.** `secret !== process.env.ADMIN_SECRET` es vulnerable en teoría a ataques de temporización | **P2** |
| 5 | **Sin identidad ni auditoría.** Un secreto compartido, sin usuario, sin registro de quién consultó qué y cuándo | **P1** |

**Mitigación inmediata** (sin rediseñar el admin):

```js
// PROPUESTO — todavía no existe
const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
const expected = process.env.ADMIN_SECRET || "";
const ok = provided.length === expected.length &&
           crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
if (!expected || !ok) return res.status(401).json({ error: "No autorizado" });

const page  = Math.max(0, Number(req.query.page) || 0);
const limit = Math.min(100, Number(req.query.limit) || 50);
const { data } = await supabaseAdmin
  .from("docentes")
  .select("id,nombres,apellidos,ie,correo,nivel,plan,activo,created_at")  // sin celular por defecto
  .order("created_at", { ascending: false })
  .range(page * limit, page * limit + limit - 1);
```

**Solución definitiva:** roles reales en Supabase. Ver `13-ADMIN-AUDIT.md`.

---

## 3. Problemas transversales del backend

### 3.1 Cinco copias de la lógica de autenticación

Cada endpoint repite su propia variante:

| Archivo | Cómo obtiene la URL de Supabase |
|---|---|
| `credits.js:10` | `VITE_SUPABASE_URL \|\| SUPABASE_URL` |
| `generate-session.js:198` | `VITE_SUPABASE_URL` **únicamente** |
| `generate-session-resource.js:293` | `VITE_SUPABASE_URL \|\| SUPABASE_URL` |
| `generate-with-quota.js:78` | `VITE_SUPABASE_URL \|\| SUPABASE_URL` |
| `generate-linked-worksheet.js` | `VITE_SUPABASE_URL \|\| SUPABASE_URL` |

**`generate-session.js` es el único sin respaldo a `SUPABASE_URL`.** Si en Vercel solo estuviera definida `SUPABASE_URL`, el generador principal devolvería 401 mientras los demás funcionarían — un fallo desconcertante y difícil de diagnosticar.

**Solución.** `api/_lib/auth.js` **(PROPUESTO — todavía no existe)** con `getSupabaseConfig()`, `requireUser(req)` y `withCredit(handler)`.

### 3.2 Ningún endpoint tiene limitación de tasa

Ninguno de los siete. Los de generación quedan protegidos parcialmente por los créditos —salvo los dos que no los usan—, pero:

- `/api/generate-session` acepta llamadas ilimitadas de cualquier usuario autenticado.
- `/api/list-docentes` acepta intentos ilimitados de adivinar el secreto.
- El registro depende únicamente de los límites por defecto de Supabase.

**Solución.** Limitación por IP y por usuario. En Vercel, con Upstash Redis o con el límite nativo de la plataforma.

### 3.3 Sin registro estructurado ni observabilidad

Solo `console.error` en tres archivos. No hay identificador de petición, ni usuario, ni duración, ni tokens consumidos, ni tasa de éxito.

**Consecuencia práctica:** ante "no me funciona el generador", no hay forma de saber si falló Gemini, si venció el token o si se agotó la cuota.

**Solución.** Registro JSON estructurado con `request_id`, `user_id`, `endpoint`, `mode`, `duration_ms`, `gemini_tokens`, `status`.

### 3.4 Sin cabeceras de seguridad ni política CORS

Sin `vercel.json`, así que no hay `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy` ni `Strict-Transport-Security`. Los endpoints no declaran CORS: funcionan por ser mismo origen, pero conviene hacerlo explícito.

**`Referrer-Policy` es especialmente relevante** dado el problema del secreto en query string: sin ella, el secreto puede filtrarse a terceros si el panel admin cargara cualquier recurso externo.

### 3.5 Sin validación por esquema en ningún endpoint

Se usa desestructuración directa de `req.body` con valores por defecto. Ninguno valida tipos, longitudes ni valores permitidos de forma sistemática.

**Solución.** Zod compartido en `api/_lib/schemas.js` **(PROPUESTO)**.

### 3.6 Modelo de Gemini por defecto inexistente

Los cuatro endpoints declaran:

```js
const GEMINI_MODEL = process.env.GEMINI_MAIN_MODEL || "gemini-3.6-flash";
```

`gemini-3.6-flash` no corresponde a ningún identificador publicado de Gemini. Si `GEMINI_MAIN_MODEL` no está definida en Vercel, **toda generación falla** con error del proveedor. Y `GEMINI_MAIN_MODEL` **no aparece en `.env.example`**, así que un despliegue nuevo hecho siguiendo la documentación del propio repositorio quedaría roto.

Detalle en `09-AI-GEMINI-AUDIT.md` §2.

**Prioridad P0 · Esfuerzo XS** — fijar un identificador válido y documentar la variable.

---

## 4. Arquitectura de backend propuesta

```
api/
├── _lib/                          ← PROPUESTO — todavía no existe
│   ├── auth.js                    ← requireUser, getSupabaseConfig, verificación local de JWT
│   ├── credits.js                 ← withCredit(handler): consume, ejecuta, devuelve si falla
│   ├── gemini.js                  ← cliente único con timeout, reintento y registro de tokens
│   ├── schemas.js                 ← validación Zod de entrada
│   ├── ratelimit.js               ← por IP y por usuario
│   ├── logger.js                  ← registro JSON estructurado
│   └── errors.js                  ← errores tipados → respuestas en español
│
├── ai/
│   ├── session.js                 ← orquesta los 4 módulos EN EL SERVIDOR · 1 crédito
│   ├── project.js                 ← versionado (hoy solo existe tras el build)
│   ├── resource.js                ← unifica session-resource y linked-worksheet
│   ├── challenge.js
│   └── suggestion.js              ← sugerencias de campo · sin crédito o coste reducido
│
├── me/
│   ├── credits.js
│   ├── profile.js                 ← PROPUESTO: lectura y escritura sincronizada
│   └── materials.js
│
└── admin/
    ├── teachers.js                ← paginado, columnas explícitas, auditado
    ├── metrics.js                 ← PROPUESTO
    └── usage.js                   ← PROPUESTO
```

**El cambio más importante es `ai/session.js`:** mover la orquestación de los 4 módulos del cliente al servidor permite cobrar **un crédito por sesión**, verificar el token una sola vez, reintentar un módulo sin rehacer todo, y guardar el resultado desde el servidor sin depender de que el navegador siga abierto.

---

## 5. Prioridades del backend

| # | Acción | Prioridad | Esfuerzo | Depende de |
|---|---|---|---|---|
| B1 | Fijar un modelo de Gemini válido y documentar `GEMINI_MAIN_MODEL` | **P0** | XS | — |
| B2 | Consumo de créditos en `generate-session` y `generate-project-steam` | **P0** | M | Decidir la unidad de cobro |
| B3 | Sacar `ADMIN_SECRET` de la query string; comparación en tiempo constante | **P0** | XS | — |
| B4 | Paginar `list-docentes` y limitar las columnas devueltas | **P0** | XS | — |
| B5 | Versionar `api/generate-project-steam.js` | **P0** | XS | Eliminar el codemod |
| B6 | Conectar `CreditsIndicator` para que `/api/credits` deje de ser huérfano | **P0** | XS | — |
| B7 | Limitación de tasa en todos los endpoints | **P1** | M | — |
| B8 | Validación por esquema de todas las entradas | **P1** | M | — |
| B9 | `_lib/` compartido: auth, gemini, errores | **P1** | M | — |
| B10 | Timeout y reintento hacia Gemini | **P1** | S | B9 |
| B11 | Registro estructurado | **P1** | S | B9 |
| B12 | Orquestar los 4 módulos en el servidor | **P1** | L | B9, B2 |
| B13 | Cabeceras de seguridad vía `vercel.json` | **P1** | XS | — |
| B14 | Añadir respaldo `SUPABASE_URL` en `generate-session.js` | **P2** | XS | — |
| B15 | Verificación local de JWT en vez de llamada a Supabase | **P2** | M | B9 |
| B16 | Registrar los fallos de devolución de crédito | **P2** | XS | B11 |
| B17 | Delimitar la entrada del usuario dentro de los prompts | **P2** | S | — |
