# 26 — Auditoría de backend, Supabase, Auth y errores

**Fecha:** 2026-09-04 · **Rama:** `main` · **HEAD:** `e7385a0`
**Naturaleza de este documento:** auditoría de **código y SQL versionado**.

---

## 0. ALCANCE REAL — LÉEME PRIMERO

Este bloque pedía auditar el estado **real de producción**. No fue posible, y
es importante que quede explícito antes que cualquier hallazgo:

| Acceso | Estado en este entorno |
|---|---|
| Supabase (dashboard / SQL / service_role) | **NO disponible** |
| Vercel (Environment Variables, logs) | **NO disponible** — `vercel whoami`: sin credenciales |
| Cuenta de correo del proyecto | **NO disponible** |
| Supabase CLI | no instalado |
| `.env.local` | contiene **solo los valores ficticios de QA** (`VITE_SUPABASE_URL` apunta a `example`) |

Tú tienes ese acceso; este entorno no lo hereda. Por tanto **todo lo que sigue
está deducido del repositorio**: el código de la aplicación, los endpoints y
los cinco ficheros SQL versionados.

Consecuencia que conviene entender bien:

> El repositorio describe la **intención**. No demuestra qué hay aplicado hoy
> en la base de datos real. Los ficheros SQL son scripts sueltos que se
> ejecutaron a mano, en un orden que el repositorio **no registra**, y algunos
> se contradicen entre sí.

Cada sección marca su grado de certeza:

- ✅ **VERIFICADO** — comprobado leyendo el código de este repositorio.
- ⚠️ **DEDUCIDO** — se sigue del SQL versionado, *si* producción coincide con él.
- 🔒 **REQUIERE ACCESO** — no se puede saber desde aquí.

---

## 1. RESUMEN EJECUTIVO

Tres hallazgos dominan el resto.

**El sistema de créditos es evitable desde el navegador, por dos vías
independientes.** Cualquier docente autenticado puede darse créditos
ilimitados sin tocar nada más que la API pública de Supabase. Esto es un
problema económico directo: cada crédito evitado es una llamada a Gemini
pagada por el proyecto. ⚠️ DEDUCIDO — depende de que producción coincida con
`supabase-freemium.sql` y `supabase-schema.sql`.

**No se puede saber qué tipos de material acepta hoy la base de datos.** Tres
ficheros SQL redefinen el mismo CHECK con listas distintas, y el que se
ejecutó de último decide. La aplicación escribe al menos un tipo
(`challenge`) que **ninguno** de los tres contempla. Cuando eso ocurre, el
crédito ya se consumió y el material se pierde. 🔒 REQUIERE ACCESO para saber
cuál está vigente.

**La capa de errores de Auth está mejor de lo esperado.** Al contrario que el
resto, `AuthGate.jsx` ya traduce los errores de Supabase a castellano claro y
no filtra texto técnico. No es el área que necesita trabajo urgente. ✅
VERIFICADO.

---

## 2. ARQUITECTURA REAL ✅ VERIFICADO

```
Navegador (React 18 + Vite, SPA sin router)
   │
   ├── supabase-js ──────────────► Supabase Auth  (sesión, JWT)
   │                          └──► PostgREST      (docentes, materiales_docente, RPC)
   │
   └── fetch /api/* ─────────────► Funciones serverless de Vercel
                                      │
                                      ├── _lib/supabase.js  (valida el JWT del usuario)
                                      ├── _lib/credits.js   (RPC consume/refund)
                                      ├── _lib/gemini.js    (REST de Google)
                                      ├── _lib/rate-limit.js
                                      └── _lib/errors.js
```

**Punto clave de diseño, y origen de casi todos los P0:** el navegador habla
con Postgres **directamente** por PostgREST, no solo a través de `/api`.
Cualquier cosa que RLS y los GRANT permitan, el docente puede hacerla desde la
consola del navegador. Las funciones serverless no son una frontera de
seguridad; son una comodidad.

---

## 3. TABLAS ⚠️ DEDUCIDO

Del SQL versionado se deducen **dos** tablas de aplicación. No hay más.

| TABLA | PROPÓSITO | COLUMNAS | PK | FK | RLS | FILAS |
|---|---|---|---|---|---|---|
| `public.docentes` | Perfil del docente **y contador de créditos** | `id`, `user_id`, `nombres`, `apellidos`, `ie`, `celular`, `nivel`, `correo`, `plan`, `activo`, `created_at`, `ai_weekly_limit`, `ai_week_used`, `ai_week_start` | `id` uuid | `user_id → auth.users.id` ON DELETE CASCADE | Activada | 🔒 |
| `public.materiales_docente` | Biblioteca de materiales generados | `id`, `user_id`, `tipo`, `titulo`, `nivel`, `grado`, `area`, `tema`, `contenido` jsonb, `created_at`, `updated_at` | `id` uuid | `user_id → auth.users.id` ON DELETE CASCADE | Activada | 🔒 |

### Restricciones y detalles relevantes

- `docentes.user_id` es **nullable** y único. Permite filas de perfil sin
  usuario de Auth (herencia de instalaciones antiguas).
- Sobre `correo` hay **dos** índices únicos: `docentes_correo_key` sobre
  `lower(correo)` y `docentes_correo_exact_key` sobre `correo`. Es redundante y
  tiene una consecuencia real (ver §5, MEDIO-1).
- `nivel` CHECK `in ('primaria','secundaria')`.
- `ai_weekly_limit >= 0` y `ai_week_used >= 0`.
- `plan` es **texto libre con default `'gratuito'`**: sin CHECK, sin tabla de
  planes, sin FK. Cualquier cadena es válida.
- Índice `materiales_docente_user_created_idx (user_id, created_at desc)`,
  adecuado para el listado de la biblioteca.
- `contenido jsonb not null default '{}'` — sin límite de tamaño declarado.

### El CHECK de `tipo`: tres definiciones en conflicto

| Fichero | Tipos permitidos |
|---|---|
| `supabase-schema.sql` | session, project, rubric, checklist |
| `supabase-session-resources.sql` | + worksheet, rating_scale |
| `supabase-session-flow-v2.sql` | + observation_guide, rating_scale, worksheet, reading, questionnaire |

Tipos que el código escribe realmente (✅ verificado con grep sobre
`App.jsx`, `components/`, `hooks/`):

```
challenge · project · rating_scale · reading · worksheet
```

`challenge` **no aparece en ninguno de los tres**. Si producción tiene
cualquiera de esos tres CHECK vigentes, guardar un reto grupal falla con
`new row violates check constraint`, después de haber consumido el crédito.

---

## 4. RELACIONES ⚠️ DEDUCIDO

```
auth.users.id ──1:1──► docentes.user_id        (unique, ON DELETE CASCADE, nullable)
auth.users.id ──1:N──► materiales_docente.user_id  (ON DELETE CASCADE)
```

Observaciones:

1. **`materiales_docente` no referencia a `docentes`,** sino directamente a
   `auth.users`. Es coherente con RLS (`auth.uid()`), pero significa que no
   existe integridad referencial entre un material y el perfil de su autor.
2. **No hay tabla de planes.** `docentes.plan` es texto libre y el catálogo
   real vive en `config/plans.js`, en el frontend. Un cambio de precios o de
   nombres de plan no tiene forma de reflejarse en datos ya escritos.
3. **No hay tabla de consumo ni auditoría de créditos.** El contador vive en
   tres columnas de `docentes` y se sobrescribe. No queda traza de qué
   generación consumió qué crédito, lo que hace imposible auditar un abuso o
   reconstruir un saldo. Esto es también lo que impide atar un reembolso a un
   fallo concreto (§8, CRÍTICO-2).
4. **Columnas sin uso aparente en el frontend:** `activo` solo se lee dentro de
   `consume_ai_credit()`. No hay interfaz para desactivar a un docente.

---

## 5. RLS Y POLÍTICAS ⚠️ DEDUCIDO

Ambas tablas tienen RLS activado. Políticas versionadas:

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `docentes` | propio (`auth.uid() = user_id`) | **ninguna** | propio, `with check` propio | **ninguna** |
| `materiales_docente` | propio | propio | propio | propio |

### Respuestas a las preguntas planteadas

| ¿Un docente puede…? | Respuesta |
|---|---|
| leer datos de otro docente | **No** — SELECT restringido a su fila |
| modificar datos ajenos | **No** — `using` + `with check` por `user_id` |
| descargar materiales ajenos | **No** — misma restricción |
| acceder a datos de admin | **No** por PostgREST; el listado va por `/api/list-docentes` con `service_role` y secreto |
| **saltarse restricciones desde el frontend** | **SÍ — ver CRÍTICO-1** |

### CRÍTICO-1 · Un docente puede editar sus propios créditos y su plan

La política de UPDATE sobre `docentes` restringe **filas**, no **columnas**:

```sql
create policy "Docente actualiza su perfil"
  on public.docentes for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

RLS no distingue columnas, y el SQL versionado no revoca privilegios de
columna al rol `authenticated`. Con su propia sesión, cualquier docente puede:

```
PATCH /rest/v1/docentes?user_id=eq.<su-propio-id>
{ "ai_week_used": 0, "ai_weekly_limit": 999999, "plan": "premium" }
```

Resultado: generaciones de IA ilimitadas y plan arbitrario. No requiere
herramientas especiales; la clave publishable está en el bundle por diseño y
el JWT es el suyo.

**Clasificación: CRÍTICO** (impacto económico directo y continuado).

**Corrección recomendada** (no aplicada): restringir la política de UPDATE a
las columnas de perfil mediante `GRANT UPDATE (nombres, apellidos, ie,
celular, nivel) ON public.docentes TO authenticated` tras revocar el UPDATE
general, y mover el contador de créditos a su propia tabla sin UPDATE para
`authenticated`.

### CRÍTICO-2 · `refund_ai_credit()` es de libre invocación

```sql
grant execute on function public.refund_ai_credit() to authenticated;
```

La función decrementa `ai_week_used` **sin comprobar nada**: no recibe
identificador de generación, no verifica que hubiera un consumo previo, no
lleva registro. Cualquier docente puede llamarla en bucle:

```
POST /rest/v1/rpc/refund_ai_credit
```

Segunda vía, independiente de CRÍTICO-1, hacia generaciones ilimitadas.

**Clasificación: CRÍTICO.**

**Corrección recomendada:** que el reembolso solo sea posible desde el
servidor (rol `service_role`, revocando `authenticated`), atado a un
identificador de generación registrado en una tabla de consumo.

### ALTO-1 · `docentes` no tiene política de INSERT

El perfil se crea **exclusivamente** por el trigger `al_crear_usuario`, que es
`security definer` y por eso ignora RLS. Es un diseño correcto, pero sin red:
si el trigger falla o no está instalado en producción, el usuario queda creado
en `auth.users` **sin perfil**, y entonces `consume_ai_credit()` y
`get_ai_credit_status()` lanzan `PROFILE_NOT_FOUND`. La aplicación queda
inutilizable para esa cuenta y no hay forma de repararlo desde el frontend.

🔒 Verificar en producción que el trigger existe y está activo.

### MEDIO-1 · Doble índice de correo y fallo de registro por mayúsculas

Existen a la vez un índice único sobre `lower(correo)` y otro sobre `correo`.
El trigger resuelve conflictos con `on conflict (correo)`, que solo alcanza al
segundo. Si existe una fila antigua con `Maria@x.pe` y alguien se registra con
`maria@x.pe`, el `ON CONFLICT` no la captura pero el índice sobre
`lower(correo)` **sí se viola** → el trigger lanza excepción → falla el INSERT
en `auth.users` → el docente ve *«Database error saving new user»*.

Atenuante ✅ VERIFICADO: `AuthGate.jsx:123` normaliza con
`.trim().toLowerCase()` antes de `signUp`, así que solo puede dispararse
contra filas heredadas con mayúsculas. 🔒 Comprobar si existen.

### MEDIO-2 · Apropiación de perfil preexistente

El trigger hace `on conflict (correo) do update set user_id = excluded.user_id`.
Una fila de docente con `user_id IS NULL` (carga manual, importación) queda
**reclamada** por quien se registre con ese correo, heredando su `plan` y sus
`ai_weekly_limit`. Requiere controlar el buzón, lo que limita el alcance, pero
convierte una lista de correos precargada en cuentas con plan asignado.

---

## 6. FUNCIONES, RPC Y TRIGGERS ⚠️ DEDUCIDO

| Objeto | Tipo | Qué hace | Seguridad |
|---|---|---|---|
| `crear_perfil_docente()` | trigger fn | Crea la fila de `docentes` desde `raw_user_meta_data` | `security definer`, `search_path = ''`, nombres cualificados ✅ correcto |
| `al_crear_usuario` | trigger | `AFTER INSERT ON auth.users` | — |
| `get_ai_credit_status()` | RPC | Devuelve plan, límite, usados, restantes, reinicio | `security definer`, `search_path = public`; `authenticated` |
| `consume_ai_credit()` | RPC | Consume 1 crédito | **`FOR UPDATE`** ✅ correcto frente a concurrencia; `authenticated` |
| `refund_ai_credit()` | RPC | Devuelve 1 crédito | ⚠️ **sin control alguno** — CRÍTICO-2 |

Notas:

- Las tres RPC hacen `revoke all ... from public` antes del `grant ... to
  authenticated`. Correcto en cuanto a anónimos.
- El reinicio semanal se calcula con `date_trunc('week', timezone('America/Lima', now()))`,
  coherente con el público objetivo.
- `set search_path = public` en las RPC de crédito es más laxo que el
  `search_path = ''` del trigger, pero acotado y sin riesgo práctico aquí.
- **No hay trigger de `updated_at`** en `materiales_docente` en el esquema
  vigente: la columna existe con default `now()` pero nunca se actualiza sola.
  La migración pendiente lo añade.

---

## 7. STORAGE 🔒 REQUIERE ACCESO

No hay ninguna referencia a Supabase Storage en el repositorio: ni buckets, ni
`storage.from(...)`, ni políticas de storage en el SQL versionado. Los
materiales se guardan como `jsonb` en la tabla y los DOCX se generan **en el
navegador** con la librería `docx`, sin subirse a ningún sitio.

**Conclusión provisional: el proyecto no usa Storage.** Queda por confirmar
que no exista un bucket creado a mano y olvidado, que sería superficie de
ataque sin dueño.

---

## 8. AUTH ✅ VERIFICADO (código) · 🔒 REQUIERE ACCESO (configuración)

### Configuración del proveedor 🔒

Site URL, Redirect URLs, caducidad de sesión, rotación de refresh tokens,
CAPTCHA, rate limits y proveedores habilitados **solo son visibles en el
dashboard**. No se puede auditar desde aquí.

Lo que el código exige que esté configurado ✅:

| Necesidad | Origen en el código |
|---|---|
| `window.location.origin` en Redirect URLs | `AuthGate.jsx:126` (`emailRedirectTo`) |
| `<origin>/?restablecer=1` en Redirect URLs | `AuthGate.jsx:178` (`redirectTo`) |
| Confirmación de correo activada | El flujo asume `data.session === null` tras `signUp` |

⚠️ Al haber cambiado el dominio de despliegue, **estas URLs deben revisarse**:
si Site URL o Redirect URLs apuntan a un dominio antiguo, la confirmación y la
recuperación llevarán a la aplicación equivocada.

### Flujo de recuperación — hay dos implementaciones, una viva y una muerta ✅

| Ruta | Redirect | Manejo | Estado |
|---|---|---|---|
| `AuthGate.jsx` | `?restablecer=1` | Evento `PASSWORD_RECOVERY` de `onAuthStateChange` (`AuthGate.jsx:68`) | **VIVA y correcta** |
| `App.jsx:3616` | `?view=reset-password` | `App.jsx:3449` | **MUERTA** |

La segunda vive dentro de `RegistrationGate`, que tiene **0 usos**
(`<RegistrationGate` no aparece en ningún render). Arrastra consigo a
`ImprovedLanding`, usada solo desde ella. No es un fallo funcional, pero es
código engañoso: quien audite el reset puede corregir la rama equivocada.

Detalle a favor del diseño actual: apoyarse en el evento `PASSWORD_RECOVERY`
en vez de leer la query string es lo robusto, porque Supabase entrega el token
en el *hash*, no en la query.

---

## 9. MENSAJES DE ERROR ACTUALES ✅ VERIFICADO

Contra lo que cabía esperar, `AuthGate.jsx` **ya traduce** los errores. No se
encontró ningún punto donde se muestre `error.message` crudo de Supabase en el
flujo de autenticación.

| CASO | MENSAJE ACTUAL | VALORACIÓN |
|---|---|---|
| Credenciales incorrectas | «Correo o contraseña incorrectos.» | ✅ correcto |
| Correo sin confirmar | «Primero confirma tu correo desde el mensaje que te enviamos.» | ⚠️ no ofrece reenviar desde ahí |
| Correo ya registrado | «Este correo ya está registrado. Inicia sesión o recupera tu contraseña.» | ✅ correcto |
| SMTP no autorizado | «Supabase todavía no puede enviar correos a esta dirección. Configura un servicio SMTP…» | ❌ **mensaje de desarrollador mostrado al docente** |
| Otro error de registro | «No pudimos crear tu cuenta. Revisa los datos e inténtalo nuevamente.» | ✅ correcto |
| Contraseña corta | «La contraseña debe tener como mínimo 8 caracteres.» | ✅ correcto |
| Contraseñas distintas | «Las contraseñas no coinciden.» | ✅ correcto |
| Sin aceptar términos | «Debes aceptar los términos y la política de privacidad.» | ✅ correcto |
| Fallo al reenviar | «No pudimos reenviar el correo. Espera un momento e inténtalo otra vez.» | ✅ correcto |
| Fallo en recuperación | «No pudimos enviar el correo de recuperación.» | ⚠️ sin sugerencia de acción |
| Fallo al cambiar contraseña | «No pudimos actualizar la contraseña. Solicita otro enlace.» | ✅ correcto |
| Supabase sin configurar | «Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en Vercel…» | ❌ **texto de infraestructura visible al docente** |

Los dos ❌ son mensajes escritos para el desarrollador que llegaron a la
interfaz del usuario final. El segundo, además, revela detalles del despliegue.

### Casos sin cubrir ✅

- **Sin manejo diferenciado de red caída.** `signInWithPassword` que falla por
  `Failed to fetch` cae en el `else` genérico y se muestra como «Correo o
  contraseña incorrectos.» — un diagnóstico **falso** que hará que la docente
  dude de su contraseña cuando el problema es su conexión.
- **Sin manejo de rate limit de Supabase** (429). Mismo destino: mensaje
  incorrecto.
- **Sin manejo de sesión expirada** visible en el flujo de Auth.

---

## 10. CATÁLOGO DE ERRORES Y DICCIONARIO PROPUESTO

Propuesta de módulo único (no implementado en este bloque):
`config/messages.js`, consumido por `AuthGate`, `UIProvider` y `_lib/errors.js`.

| CÓDIGO | ERROR TÉCNICO DE ORIGEN | CAUSA | MENSAJE PROPUESTO | NIVEL |
|---|---|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | `Invalid login credentials` | correo o contraseña erróneos | «El correo o la contraseña no son correctos.» | info |
| `AUTH_EMAIL_NOT_CONFIRMED` | `Email not confirmed` | falta confirmar | «Primero confirma tu correo. Te podemos enviar otro enlace.» + botón de reenvío | acción |
| `AUTH_EMAIL_EXISTS` | `User already registered` | correo duplicado | «Ya existe una cuenta con este correo.» | info |
| `AUTH_RATE_LIMIT` | HTTP 429 | demasiados intentos | «Hiciste varios intentos. Espera un momento y vuelve a intentar.» | espera |
| `AUTH_SESSION_EXPIRED` | `JWT expired` | sesión caducada | «Tu sesión se cerró por seguridad. Vuelve a entrar.» | acción |
| `AUTH_WEAK_PASSWORD` | `Password should be at least…` | contraseña corta | «La contraseña debe tener al menos 8 caracteres.» | info |
| `NETWORK_ERROR` | `Failed to fetch`, `NetworkError` | sin conexión | «No pudimos conectarnos. Revisa tu conexión e inténtalo nuevamente.» | reintento |
| `PROFILE_MISSING` | `PROFILE_NOT_FOUND` (RPC) | usuario sin fila en `docentes` | «Tu perfil no terminó de crearse. Escríbenos y lo activamos.» | soporte |
| `CREDITS_EXHAUSTED` | `WEEKLY_LIMIT_REACHED` | sin créditos | «Ya usaste tus creaciones de esta semana. Se renuevan el {fecha}.» | info |
| `ACCOUNT_INACTIVE` | `ACCOUNT_INACTIVE` | `activo = false` | «Tu cuenta está desactivada. Escríbenos para reactivarla.» | soporte |
| `GENERATION_ERROR` | error o timeout de Gemini | fallo de IA | «No pudimos generar el contenido. Tu crédito no fue consumido.» | reintento |
| `GENERATION_TIMEOUT` | `AbortSignal` a 45 s | Gemini tardó demasiado | «La generación tardó más de lo normal. Tu crédito no fue consumido.» | reintento |
| `SAVE_ERROR` | error genérico de INSERT | fallo al guardar | «No pudimos guardar el material. Tu contenido sigue disponible aquí.» | reintento |
| `SAVE_TYPE_REJECTED` | `violates check constraint` | tipo no permitido en el CHECK | «Todavía no podemos guardar este tipo de material. Descárgalo para no perderlo.» | descarga |
| `SAVE_DENIED` | `violates row-level security` | RLS | «No pudimos guardar el material en tu cuenta. Vuelve a entrar e inténtalo.» | acción |
| `CONFIG_ERROR` | falta variable de entorno | despliegue mal configurado | «El servicio no está disponible en este momento.» (detalle solo al log) | soporte |

Regla que debería fijarse: **ningún texto originado en Postgres, PostgREST,
Supabase o Google puede llegar a la pantalla.** `_lib/errors.js` ya cumple
esto en el servidor ✅; falta el equivalente en el cliente.

---

## 11. CORREOS 🔒 REQUIERE ACCESO

No auditable desde el repositorio. Lo único deducible:

- El mensaje de error de SMTP no autorizado (§9) sugiere que en algún momento
  se usó el **SMTP por defecto de Supabase**. Si sigue así, aplican sus
  límites: envío muy restringido por hora y entrega solo a direcciones del
  equipo del proyecto, lo que **impediría el registro de docentes reales**.
- Las plantillas (Confirm signup, Reset password, Magic Link, Change email,
  Invite) no están versionadas: viven solo en el dashboard.

Lo que hay que revisar allí, y que ya se puede dejar planificado:
proveedor real, dominio verificado (SPF/DKIM/DMARC), asunto, idioma, marca
SciVerse, CTA y URL de redirección de cada plantilla.

---

## 12. VARIABLES DE VERCEL 🔒 PARCIAL

Sin credenciales no se pueden listar scopes. Sí se puede documentar el **uso
real en el código** ✅ y qué exige el guard de build:

| VARIABLE | USADA EN | OBLIGATORIA PARA | SCOPE NECESARIO |
|---|---|---|---|
| `VITE_SUPABASE_URL` | `supabaseClient.js` + guard de build | build y navegador | Production + Preview |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_ANON_KEY` | ídem (acepta cualquiera) | build y navegador | Production + Preview |
| `SUPABASE_URL` | `api/credits.js`, generadores, `api/list-docentes.js` | servidor | Production (+ Preview) |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo** `api/list-docentes.js` | panel admin | Production, secreta |
| `GEMINI_API_KEY` | `api/_lib/gemini.js` | generación | Production, secreta |
| `GEMINI_MAIN_MODEL` | `api/_lib/gemini.js` | opcional; por defecto `gemini-3.6-flash` | Production |
| `ADMIN_SECRET` | `api/list-docentes.js` | panel admin | Production, secreta |

Dato duro ✅: el despliegue de producción de `1f70a59` **compiló**, y
`npm run build` ejecuta `scripts/check-env.mjs`, que aborta si falta
`VITE_SUPABASE_URL` o ambas claves públicas. Luego esas variables **están
definidas** en el entorno que construyó. Única salvedad: que exista
`SCIVERSE_SKIP_ENV_CHECK=1`, que saltaría la comprobación.

Comprobación de fuga ✅ VERIFICADO: el bundle compilado no contiene
`service_role`, `ADMIN_SECRET`, `GEMINI_API_KEY` ni ningún JWT. Correcto.
(La clave publishable sí viaja en el bundle, y eso es lo esperado.)

---

## 13. ENDPOINTS DE API ✅ VERIFICADO

| ENDPOINT | MÉTODO | AUTH | RATE LIMIT | CRÉDITO | ERRORES |
|---|---|---|---|---|---|
| `api/credits.js` | GET | JWT de usuario | sí | lee estado | `_lib/errors` |
| `api/generate-session.js` | POST | JWT | sí | consume + refund | `_lib/errors` |
| `api/generate-session-resource.js` | POST | JWT | sí | consume + refund | `_lib/errors` |
| `api/generate-project-steam.js` | POST | JWT | sí | consume + refund | `_lib/errors` |
| `api/generate-linked-worksheet.js` | POST | JWT | sí | consume + refund | `_lib/errors` |
| `api/generate-with-quota.js` | POST | JWT | sí | consume + refund | `_lib/errors` |
| `api/list-docentes.js` | GET | `ADMIN_SECRET` por `Authorization: Bearer` | sí (`adminAuth`) | — | `_lib/errors` |

Puntos fuertes ✅ (herencia del Bloque B, siguen intactos):

- `_lib/errors.js` nunca deja pasar texto de Postgres ni de Gemini al cliente.
- `list-docentes` compara el secreto en **tiempo constante** sobre hashes
  SHA-256, usa columnas explícitas, oculta `celular` salvo petición explícita
  registrada, y pagina con tope.
- `_lib/gemini.js` aplica `AbortSignal.timeout(45000)`.

### ALTO-2 · El rate limit no limita nada en producción

`_lib/rate-limit.js` mantiene una ventana deslizante **en memoria del
proceso**. En Vercel cada invocación puede caer en una instancia distinta y
las instancias se reciclan. El propio módulo lo documenta con honestidad, pero
el efecto práctico es que **la protección contra fuerza bruta del panel de
administración es aproximadamente inexistente** ante un atacante que abra
conexiones nuevas.

Mitigación real disponible: mover el contador a Postgres o a un KV, o poner el
panel detrás de autenticación real (Admin V2).

---

## 14. CRÉDITOS ✅ código · ⚠️ modelo de datos

| Pregunta | Respuesta |
|---|---|
| Dónde se almacenan | Columnas `ai_weekly_limit`, `ai_week_used`, `ai_week_start` de `docentes` |
| Tipo de dato | `integer` / `date` |
| Cómo se descuentan | RPC `consume_ai_credit()` desde el servidor |
| Cuándo | Antes de llamar a Gemini, vía `withCredit()` |
| Reembolso | `refund_ai_credit()` si Gemini o el backend fallan |
| Unidad | 1 creación entregada = 1 crédito; en una sesión encadenada **solo cobra el módulo `alignment`** (`chargesCreditForModule`) |
| Concurrencia | `SELECT … FOR UPDATE` en el consumo ✅ |

| Riesgo | Veredicto |
|---|---|
| Crédito negativo | **No** — `greatest(…, 0)` y CHECK `>= 0` |
| Doble cobro por doble clic | **No** — `FOR UPDATE` serializa |
| Pérdida de crédito si Gemini falla | **No** — hay refund |
| **Generación gratuita** | **SÍ — CRÍTICO-1 y CRÍTICO-2** |
| Pérdida de crédito si el material no se puede guardar | **SÍ** — el crédito se consume en la generación; si el INSERT viola el CHECK de `tipo`, no hay reembolso (§3) |

---

## 15. GEMINI ✅ VERIFICADO

| Aspecto | Estado |
|---|---|
| Modelo | `gemini-3.6-flash` por defecto, sustituible con `GEMINI_MAIN_MODEL` |
| Validez del modelo | ✅ **Es un modelo válido y estable.** Ver `25-AUDIT-CORRECTIONS.md`, C-1: una auditoría anterior lo marcó erróneamente como inexistente |
| Endpoint | REST de Google, del lado servidor; la clave nunca llega al navegador |
| Timeout | 45 s vía `AbortSignal.timeout` |
| Reintentos | **No hay** |
| Parseo | `generateJson()` con validación de JSON |
| Fallback | **No hay** modelo alternativo |
| Coste | Sin límite de gasto por cuenta más allá del contador semanal — que es evitable (§5) |

Sin reintentos, un fallo transitorio de Google se traduce en un fallo visible
para la docente. El crédito sí se reembolsa, así que no hay pérdida económica
para ella, pero sí fricción.

---

## 16. GUARDADO ✅ VERIFICADO

Flujo: generar → `useMaterialSave` → INSERT en `materiales_docente` →
biblioteca (`withContent()` perezoso) → abrir / descargar DOCX en el navegador.

| Escenario | Comportamiento |
|---|---|
| Guardado correcto | `SaveStatus` refleja el estado ✅ |
| Error de base de datos | `describeSaveError` traduce; no se muestra texto crudo ✅ |
| Sesión expirada | Falla el INSERT; el mensaje es genérico ⚠️ |
| RLS | No debería dispararse: el `user_id` es el propio |
| **Tipo no permitido** | ❌ **falla y el crédito ya se gastó** (§3) |
| Contenido grande | Sin límite declarado; `jsonb` sin tope 🔒 |
| Conexión caída | Mensaje genérico ⚠️ |

---

## 17. MIGRACIONES

`supabase/migrations/001_material_types.sql` — **NO EJECUTADA.**

| Aspecto | Detalle |
|---|---|
| Qué hace | Redefine el CHECK de `tipo` como **superconjunto** de las tres listas previas, añadiendo `challenge`; añade trigger de `updated_at` |
| Garantías declaradas | No borra datos · no recrea tablas · no desactiva RLS · no toca políticas |
| Seguridad | Bloque `DO $$` que **aborta** si encuentra un `tipo` no contemplado |
| Rollback | Documentado en el propio fichero |
| Riesgo | **Bajo**, precisamente por el bloque de inspección previo |
| ¿Aplicada? | 🔒 **No se puede saber sin acceso** |

**Recomendación:** ejecutar primero **solo** el bloque de INSPECCIÓN, que es
de lectura, y comparar su salida con lo esperado antes de aplicar nada. Esta
migración resuelve una pérdida real de trabajo y de créditos, así que debería
ser de lo primero del próximo bloque — pero después de verificar.

---

## 18. ADMIN ✅ VERIFICADO

Bien resuelto dentro de sus límites: cabecera `Authorization`, comparación en
tiempo constante, columnas explícitas, `celular` bajo petición registrada,
paginación con tope, rate limit (con la salvedad de ALTO-2).

Limitación de fondo, ya documentada en el propio fichero: **es un secreto
compartido, sin identidad ni roles.** No hay trazabilidad de quién consultó
qué. `ADMIN_SECRET` estuvo históricamente en la query string, así que quedó
registrado en logs de acceso e historiales de navegador: **requiere rotación**
(pendiente, no ejecutada aquí).

---

## 19. SEGURIDAD — RESUMEN CLASIFICADO

| Nivel | Hallazgo | Estado |
|---|---|---|
| **CRÍTICO** | CRÍTICO-1 · UPDATE sin restricción de columnas: el docente edita sus créditos y su plan | ⚠️ deducido |
| **CRÍTICO** | CRÍTICO-2 · `refund_ai_credit()` invocable libremente y sin control | ⚠️ deducido |
| **ALTO** | ALTO-1 · Sin política de INSERT: cuenta sin perfil si falla el trigger | ⚠️ deducido |
| **ALTO** | ALTO-2 · Rate limit en memoria: inútil en serverless | ✅ verificado |
| **ALTO** | `ADMIN_SECRET` expuesto históricamente en query string, sin rotar | ✅ verificado |
| **MEDIO** | MEDIO-1 · Doble índice de correo: registro puede fallar con error crudo | ⚠️ deducido |
| **MEDIO** | MEDIO-2 · Apropiación de perfil precargado por correo | ⚠️ deducido |
| **MEDIO** | Tipos de material en conflicto: pérdida de trabajo y de crédito | ⚠️ deducido |
| **MEDIO** | Mensajes de infraestructura visibles al docente (§9) | ✅ verificado |
| **BAJO** | `plan` como texto libre sin catálogo | ✅ verificado |
| **BAJO** | Sin auditoría de consumo de créditos | ✅ verificado |
| **BAJO** | Código muerto: `RegistrationGate`, `ImprovedLanding`, `Usage`, `CrosswordGenerator` | ✅ verificado |

**No encontrados** (comprobados y limpios ✅): `service_role` en el frontend,
claves secretas en el bundle, SQL inyectable, RLS ausente, endpoints de admin
sin protección, PII expuesta sin control.

---

## 20. PRIORIDADES

### P0 — antes de abrir el registro a docentes reales

1. **Cerrar las dos vías de crédito gratis** (CRÍTICO-1 y CRÍTICO-2).
2. **Verificar en producción** el CHECK vigente de `tipo` y aplicar
   `001_material_types.sql` tras su bloque de inspección.
3. **Confirmar el proveedor de correo.** Con el SMTP por defecto de Supabase,
   el registro de docentes reales no funciona.
4. **Revisar Site URL y Redirect URLs**, que el cambio de dominio pudo dejar
   apuntando al sitio equivocado.

### P1

5. Rotar `ADMIN_SECRET`.
6. Rate limit persistente (Postgres o KV), o Admin V2 con roles.
7. Diccionario de errores centralizado (§10) y retirada de los dos mensajes de
   infraestructura.
8. Distinguir el error de red del de credenciales en el login.
9. Verificar que el trigger `al_crear_usuario` existe y está activo.

### P2

10. Tabla de consumo de créditos para auditar y para atar los reembolsos.
11. Catálogo de planes en base de datos.
12. Retirar el código muerto (`RegistrationGate`, `ImprovedLanding`, `Usage`,
    `CrosswordGenerator`).
13. Reintento con retroceso para fallos transitorios de Gemini.
14. Rediseño de plantillas de correo con marca SciVerse.

---

## 21. QUÉ NECESITO PARA COMPLETAR ESTA AUDITORÍA

Para convertir cada ⚠️ en ✅ y resolver cada 🔒:

1. **Acceso de lectura a Supabase.** Lo más limpio es el *connection string*
   del pooler en modo solo lectura, o bien la salida de un puñado de consultas
   a `information_schema` y `pg_policies` que puedo entregarte ya escritas.
2. **`vercel login`** en este entorno, o una captura de Environment Variables
   con los **valores tapados** (solo nombres y scopes).
3. **Supabase → Authentication → URL Configuration y Email Templates**: basta
   con lo que se ve en pantalla.
4. **Supabase → Project Settings → Auth → SMTP**: proveedor y dominio, sin
   credenciales.

Con lo primero puedo verificar de una sola pasada las tablas reales, las
políticas vigentes, qué CHECK está activo, si el trigger existe y si la
migración está aplicada.

**Ningún secreto debe pegarse en el chat.** El sitio correcto es `.env.local`,
que está en `.gitignore` (verificado ✅); yo lo leo sin imprimir valores.
