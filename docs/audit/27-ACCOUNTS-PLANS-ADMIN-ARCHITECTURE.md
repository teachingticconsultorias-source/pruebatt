# 27 — Arquitectura de cuentas, planes y administración

**Fecha:** 2026-09-06 · **Estado:** DISEÑO. Sin SQL ejecutado, sin migraciones
escritas, sin UI. · **Base:** `supabase/production-full-schema.sql` y el
diseño de `002_secure_ai_credits.sql`.

---

## 0. TRES HECHOS DE PRODUCCIÓN QUE CONDICIONAN EL DISEÑO

Verificados en el dump, no supuestos:

1. **`service_role` NO puede leer `auth.users`.** Los grants son a `postgres`
   y `dashboard_user`. Cualquier dato de Auth que el panel necesite
   —`email_confirmed_at`, `last_sign_in_at`— hay que exponerlo con una
   función `SECURITY DEFINER` propiedad de `postgres`, o pedirlo a la Admin
   API de Supabase por HTTP. **No se puede hacer un JOIN normal.**

2. **`auth.users` ya guarda `last_sign_in_at` y `email_confirmed_at`.** No hay
   que construir seguimiento de login: sería duplicar algo que la plataforma
   ya mantiene mejor.

3. **`docentes.nivel` no tiene CHECK en producción.** El esquema del
   repositorio lo declaraba; nunca se aplicó. Hoy admite cualquier cadena.

Y uno más, heredado del bloque anterior y que gobierna todo lo que sigue:
`ALTER DEFAULT PRIVILEGES … IN SCHEMA public GRANT ALL … TO anon, authenticated`
está activo. **Toda tabla nueva en `public` nace legible y escribible por
`anon`.** Por eso lo que no deba ver el navegador va a `sciverse_private`.

---

## 1. ARQUITECTURA PROPUESTA

Cuatro dominios, deliberadamente separados:

```
IDENTIDAD            auth.users                    (Supabase · no lo tocamos)
      │
PERFIL               public.docentes               quién es, qué enseña
      │
ESTADO COMERCIAL     public.plans                  catálogo
                     public.subscriptions          qué plan tiene y hasta cuándo
                     public.payments               qué pagó y quién lo verificó
      │
USO Y MEDICIÓN       sciverse_private.ai_generations    una fila por generación
                     public.ai_usage_counters           contador de la semana
                     sciverse_private.activity_events   qué hace en la plataforma
      │
ADMINISTRACIÓN       sciverse_private.admin_users       quién es admin y con qué rol
                     sciverse_private.admin_audit_log   qué hizo cada admin
```

Dos reglas que ordenan el resto:

> **El cliente puede leer lo que le pertenece. Nunca puede escribir nada que
> determine su derecho a algo.**

> **Lo que el docente no debe ver, no vive en `public`.** No basta con RLS:
> los privilegios por defecto del proyecto conceden a `anon` sobre cada tabla
> nueva de ese esquema.

---

## 2. TABLAS

### 2.1 `public.docentes` — perfil (existe, se poda)

| Aspecto | Detalle |
|---|---|
| Propósito | Quién es la docente y qué enseña. Nada comercial. |
| PK | `id uuid` |
| FK | `user_id → auth.users(id) ON DELETE CASCADE` |
| UNIQUE | `user_id`, `correo` |
| Índices | los actuales |

Columnas que **se quedan**: `id`, `user_id`, `nombres`, `apellidos`, `ie`,
`celular`, `nivel`, `correo`, `activo`, `created_at`, y se añade `updated_at`.

Se añade el CHECK que nunca llegó: `nivel in ('primaria','secundaria')`,
previa comprobación de que no hay filas con otro valor.

### 2.2 `public.plans` — catálogo

| Aspecto | Detalle |
|---|---|
| Propósito | Qué planes existen, cuánto cuestan y qué límites imponen. |
| PK | `id text` — slug estable (`free`, `mensual`, `institucional`) |
| Columnas | `name`, `description`, `price_cents integer`, `currency char(3) default 'PEN'`, `billing_period_months integer`, `ai_weekly_limit integer`, `max_materials integer null`, `features jsonb default '{}'`, `benefits text[]`, `is_public boolean default true`, `sort_order integer`, `active boolean default true`, `created_at`, `updated_at` |
| CHECK | `price_cents >= 0`, `ai_weekly_limit >= 0`, `billing_period_months > 0 or billing_period_months is null` |
| Índices | `(active, sort_order)` para el listado público |

`id` es texto y no uuid a propósito: aparece en URLs, en mensajes de WhatsApp
y en el código. Un slug estable es más legible y no cambia.

`max_materials null` = sin límite.

### 2.3 `public.subscriptions` — qué plan tiene cada docente

| Aspecto | Detalle |
|---|---|
| Propósito | Estado comercial e historial. Sustituye a `docentes.plan`. |
| PK | `id uuid` |
| FK | `user_id → auth.users(id) ON DELETE CASCADE`, `plan_id → plans(id)`, `activated_by → auth.users(id)` (nullable), `payment_id → payments(id)` (nullable) |
| Columnas | `status text`, `starts_at timestamptz not null default now()`, `ends_at timestamptz null`, `source text`, `activation_reason text`, `ai_weekly_limit_override integer null`, `cancelled_at`, `cancel_reason`, `created_at`, `updated_at` |
| CHECK | `status in ('active','expired','suspended','cancelled')`, `source in ('signup','manual_admin','payment','promo')`, `ends_at is null or ends_at > starts_at` |
| UNIQUE | **parcial**: `unique (user_id) where status = 'active'` |
| Índices | `(user_id, starts_at desc)`, `(status, ends_at)` |

Ese índice único parcial es la pieza clave: **garantiza a nivel de base que
nadie tiene dos planes activos a la vez**, aunque dos administradores pulsen
a la vez. No depende de la aplicación.

`ends_at null` = perpetuo, que es el caso del plan gratuito.

### 2.4 `public.payments` — pagos manuales

| Aspecto | Detalle |
|---|---|
| Propósito | Registrar el cobro coordinado por WhatsApp y su verificación. |
| PK | `id uuid` |
| FK | `user_id → auth.users(id)`, `plan_id → plans(id)`, `verified_by → auth.users(id)` (nullable) |
| Columnas | `amount_cents integer not null`, `currency char(3) default 'PEN'`, `channel text`, `reference text null`, `status text`, `declared_at timestamptz`, `verified_at timestamptz null`, `rejection_reason text`, `internal_notes text`, `created_at`, `updated_at` |
| CHECK | `amount_cents > 0`, `status in ('pending','verified','rejected','cancelled')`, `channel in ('whatsapp','yape','plin','transferencia','otro')` |
| UNIQUE | `(user_id, reference) where reference is not null` — evita registrar dos veces el mismo pago |
| Índices | `(status, declared_at desc)` para la bandeja de verificación |

Los cuatro estados propuestos son los adecuados y suficientes:
`pending` (declarado, sin verificar) → `verified` o `rejected`; `cancelled`
para cuando la propia docente se echa atrás.

**Nunca se guarda**: número de tarjeta, CVV, credenciales bancarias, capturas
con datos de terceros. `reference` es el código de operación: no es un
secreto, pero sí es dato personal — solo lo leen los administradores.

### 2.5 `public.ai_usage_counters` — contador semanal

| Aspecto | Detalle |
|---|---|
| Propósito | El contador rápido que consume el crédito. Una fila por docente. |
| PK | `user_id uuid` → `auth.users(id) ON DELETE CASCADE` |
| Columnas | `period_start date not null`, `used integer not null default 0`, `updated_at timestamptz` |
| CHECK | `used >= 0` |

**Sustituye a las tres columnas que 002 pone en `docentes`.** Ver §14: la
recomendación es *no* bloquear el P0 por esto, sino mover el contador aquí en
este bloque.

El límite **no** vive aquí: se resuelve con
`coalesce(subscription.ai_weekly_limit_override, plan.ai_weekly_limit)`.
Así, cambiar el límite de un plan lo cambia para todos sin tocar ninguna fila
de docente.

### 2.6 `sciverse_private.ai_generations` — una fila por generación

Es **la misma tabla** que `002` crea como `ai_credit_consumptions`, ampliada.
No se crea una tabla nueva: se le añaden columnas.

| Aspecto | Detalle |
|---|---|
| Propósito | Vale de reembolso **y** medición de la generación. Una fila, sin duplicar nada. |
| PK | `id uuid` — es a la vez el vale y el identificador de la generación |
| FK | `user_id → auth.users(id) ON DELETE CASCADE` |
| De 002 | `week_start`, `consumed_at`, `refunded_at`, `refund_reason` |
| Se añade | `tool text`, `module text`, `model text`, `status text`, `duration_ms integer`, `input_tokens integer`, `output_tokens integer`, `error_code text`, `finished_at timestamptz` |
| CHECK | `status in ('started','completed','failed','timeout')` |
| Índices | `(user_id, consumed_at desc)`, `(status, consumed_at desc)`, `(tool, consumed_at desc)` |

El coste **no se guarda**: se calcula al consultar, desde
`sciverse_private.ai_model_pricing (model, input_micros_per_1k,
output_micros_per_1k, effective_from)`. Los tokens son un hecho inmutable;
los precios cambian. Guardar el coste congelaría un número que envejece mal.

### 2.7 `sciverse_private.activity_events` — actividad

| Aspecto | Detalle |
|---|---|
| Propósito | Qué usa cada docente, con el mínimo ruido posible. |
| PK | `id bigint generated always as identity` |
| FK | `user_id → auth.users(id) ON DELETE CASCADE` |
| Columnas | `event text not null`, `tool text null`, `material_id uuid null`, `metadata jsonb default '{}'`, `occurred_at timestamptz default now()` |
| Índices | `(user_id, occurred_at desc)`, `(event, occurred_at desc)` |

**No se registra el login.** `auth.users.last_sign_in_at` ya lo tiene, y
duplicarlo sería peor: la plataforma lo mantiene con más precisión.

**No se guardan prompts.** Ni completos ni truncados. Contienen nombres de
estudiantes, contextos de aula y datos de la institución. Si hiciera falta
depurar, `metadata` puede llevar longitud y área, nunca el texto.

### 2.8 `sciverse_private.admin_users` — quién administra

| Aspecto | Detalle |
|---|---|
| Propósito | Convertir el secreto compartido en identidades reales. |
| PK | `user_id uuid` → `auth.users(id) ON DELETE CASCADE` |
| Columnas | `role text not null`, `active boolean default true`, `created_at`, `created_by uuid`, `notes text` |
| CHECK | `role in ('superadmin','admin','soporte')` |

Vive en `sciverse_private` **porque PostgREST no lo expone**. Si estuviera en
`public`, los privilegios por defecto se lo entregarían a `anon` en el mismo
instante de crearlo.

Los administradores entran con Supabase Auth como todo el mundo: una sola
identidad, sin segundo sistema de contraseñas, y con nombre real en cada
línea de auditoría.

### 2.9 `sciverse_private.admin_audit_log` — qué hizo cada admin

| Aspecto | Detalle |
|---|---|
| Propósito | Historial de acciones administrativas. Solo se añade. |
| PK | `id bigint generated always as identity` |
| Columnas | `actor_user_id uuid`, `actor_role text`, `action text not null`, `entity_type text`, `entity_id uuid`, `before jsonb`, `after jsonb`, `reason text`, `metadata jsonb`, `created_at timestamptz default now()` |
| Índices | `(created_at desc)`, `(entity_type, entity_id, created_at desc)`, `(actor_user_id, created_at desc)` |

`actor_role` se guarda como **instantánea**: si mañana alguien deja de ser
admin, el registro debe seguir diciendo con qué rol actuó entonces.

Sin `UPDATE` ni `DELETE` concedidos a nadie, más un trigger que los rechace.
Un historial que se puede editar no es un historial.

`action` es texto libre con convención (`ADMIN_ACTIVATED_PLAN`,
`ADMIN_SUSPENDED_USER`, `ADMIN_VERIFIED_PAYMENT`, `ADMIN_CHANGED_LIMIT`,
`ADMIN_ADDED_NOTE`) y **no** un CHECK: cada acción nueva obligaría a una
migración. La convención se documenta y se valida en el backend.

**Nunca** guarda tokens, secretos, contraseñas ni el JWT del actor.

---

## 3. RELACIONES

```
auth.users ──1:1──► docentes                (perfil)
auth.users ──1:N──► subscriptions           (solo UNA activa · índice parcial)
auth.users ──1:N──► payments
auth.users ──1:1──► ai_usage_counters
auth.users ──1:N──► ai_generations
auth.users ──1:N──► activity_events
auth.users ──1:1──► admin_users             (solo los administradores)

plans      ──1:N──► subscriptions
plans      ──1:N──► payments
payments   ──1:1──► subscriptions           (el pago que originó la activación)
```

Todo cuelga de `auth.users`, no de `docentes.id`. Es coherente con lo que ya
hace `materiales_docente` y con RLS, que razona en `auth.uid()`. Evita un
salto extra en cada política.

---

## 4. QUÉ SE QUEDA Y QUÉ SALE DE `docentes`

### Se queda

`id`, `user_id`, `nombres`, `apellidos`, `ie`, `celular`, `nivel`,
`created_at`, `updated_at` (nueva).

`correo` — **se queda, pero deja de ser autoridad.** La fuente de verdad es
`auth.users.email`. Aquí es una copia sincronizada porque es carga real:
sostiene el `ON CONFLICT (correo)` del trigger y su UNIQUE. Quitarla es un
cambio mayor que no toca hacer ahora.

`activo` — **se queda.** Es estado de *cuenta*, no de plan: una suspensión no
depende de qué plan se tenga. Además lo consulta cada consumo de crédito;
moverlo obligaría a un JOIN en el camino caliente para leer un booleano.

### Sale

`plan` → `subscriptions`. Retirada en tres pasos, sin ventana rota:
1. Se crea `subscriptions` y se rellena desde el valor actual de `plan`.
2. La aplicación pasa a leer el plan efectivo por la vista; nadie escribe ya
   la columna.
3. Solo entonces se elimina la columna.

Las tres columnas `ai_*` de 002 → `ai_usage_counters` (§14).

### Lo que NO se crea

**No** se crea `docente_preferences`. Hoy no hay ninguna preferencia real que
guardar: `nivel` es perfil, no preferencia. Crear la tabla «por si acaso» es
exactamente la sobreingeniería que se pide evitar. Cuando exista la primera
preferencia de verdad, se decidirá entre una columna `jsonb` en `docentes` o
una tabla propia.

---

## 5. PLANES Y BENEFICIOS

### Qué va en columna y qué en configuración estructurada

La regla: **si el backend lo tiene que hacer cumplir, filtrar u ordenar, es
columna. Si solo se muestra o es una lista que crece, es JSONB.**

| En columna | Por qué |
|---|---|
| `ai_weekly_limit` | Lo aplica `consume_ai_credit` en cada generación |
| `max_materials` | Lo aplica el guardado |
| `price_cents`, `currency` | Se ordena, se suma, se compara |
| `billing_period_months` | Calcula `ends_at` |
| `active`, `is_public`, `sort_order` | Filtran el catálogo |

| En `features jsonb` | Por qué |
|---|---|
| `{"export_docx": true}` | Interruptores que crecen sin parar |
| `{"premium_tools": ["unit"]}` | Lista variable de herramientas |
| `{"priority_model": false}` | Aún no existe; que no cueste una migración |

| En `benefits text[]` | Por qué |
|---|---|
| Las viñetas de la tarjeta de precios | Texto de marketing, no lógica |

### Por qué no una tabla `plan_features`

Se consideró y **se descarta por ahora**. Una tabla clave-valor obliga a un
JOIN en cada comprobación de permiso, se lee en casi toda petición y cambia
muy poco. Con `features jsonb` más un único ayudante
`planHasFeature(plan, 'export_docx')`, añadir un beneficio es una fila
actualizada, no una migración ni veinte sitios tocados — que es justamente el
requisito. Si algún día hace falta preguntar *qué planes tienen X* de forma
eficiente, se añade la tabla entonces, con datos reales que la justifiquen.

### Nombres comerciales

No se inventan. Se migra lo que ya existe en `config/plans.js`
(`gratuito`, `mensual`, `institucional`) y `config/plans.js` pasa a leer de
la base, no a definirla.

---

## 6. SUSCRIPCIONES

### Plan efectivo — evaluación perezosa

No hay `pg_cron` en producción y no hace falta. El plan efectivo se resuelve
**al leer**:

```
plan efectivo = la suscripción con status='active' y (ends_at is null
                o ends_at > now());  si no hay ninguna → 'free'
```

Expuesto como vista `public.v_mi_plan` (filtrada por `auth.uid()`) y como
función para el backend.

Ventajas frente a un job nocturno: no hay ventana en la que un plan vencido
siga dando acceso, y no depende de que un programador externo se ejecute. Un
job posterior que marque `expired` es opcional y solo cosmético para los
listados.

### Toda docente tiene suscripción

Al registrarse se crea una fila `free` con `ends_at null`. Así **siempre** hay
exactamente una activa y desaparecen los casos especiales con `NULL`.

### Estados

`active` · `expired` · `suspended` · `cancelled`

`suspended` es de suscripción; `docentes.activo = false` es de cuenta. Una
suspensión administrativa por impago toca la suscripción; un bloqueo por
abuso toca la cuenta. Son cosas distintas y conviene no fundirlas.

### Preparado para pasarela

`source` ya distingue `manual_admin` de `payment`, y `payment_id` enlaza el
cobro. El día que haya pasarela, esta cambia `payments.status` a `verified` y
el resto del flujo es idéntico. **No hay que rehacer la base.**

---

## 7. PAGOS MANUALES

Flujo previsto: la docente escribe por WhatsApp → paga por Yape/Plin →
un administrador comprueba → registra el pago → activa el plan.

Detalle que evita disgustos: **verificar un pago y activar un plan son la
misma transacción**. Si se hacen por separado, un fallo entre medias deja a
alguien que pagó sin plan. La operación crea la suscripción, cierra la
anterior, enlaza `payment_id` y escribe la auditoría, todo o nada.

Idempotencia: el UNIQUE `(user_id, reference)` impide registrar dos veces la
misma operación. Cuando no haya referencia, el panel avisa de que se pierde
esa protección.

---

## 8. ROLES ADMIN

Tres roles, y cada uno se gana el sitio:

| Rol | Puede |
|---|---|
| `soporte` | Leer docentes, ver consumo y actividad, añadir notas internas. **No** toca planes ni dinero |
| `admin` | Todo lo de soporte + verificar pagos, activar/cambiar plan, suspender, reactivar, ajustar límite |
| `superadmin` | Todo lo de admin + gestionar administradores y editar el catálogo de planes y precios |

La separación real está entre *leer para ayudar* y *mover dinero o
entitlements*. Con dos roles no se podría dar acceso a alguien de soporte sin
darle también la capacidad de regalar planes.

### Cómo se vincula sin mezclar

Los administradores **son** usuarios de `auth.users`; lo que los distingue es
tener fila en `sciverse_private.admin_users`. Ventajas: una sola autenticación,
identidad real en la auditoría, y revocar a alguien es poner `active = false`.

Un administrador puede además tener perfil de docente, y no pasa nada: son
tablas distintas colgando del mismo usuario.

### Cómo se comprueba el permiso

```
navegador → JWT normal de Supabase
   ↓
/api/admin/*  valida el JWT (requireUser, ya existe)
   ↓
con service_role consulta sciverse_private.admin_users
   ↓
compara el rol con lo que exige la operación
   ↓
ejecuta y escribe en admin_audit_log
```

**El frontend no decide nada.** Oculta botones por comodidad; el backend
rechaza igual si se llaman a mano.

Esto **retira `ADMIN_SECRET`**: deja de existir un secreto compartido que
rotar, y cada acción queda a nombre de una persona.

### El obstáculo del paso 0

`service_role` no puede leer `auth.users`. Para mostrar correo confirmado y
último acceso hacen falta, o bien la Admin API de Supabase por HTTP, o bien
una función `SECURITY DEFINER` propiedad de `postgres` que devuelva solo
`id, email, email_confirmed_at, last_sign_in_at` y esté concedida únicamente
a `service_role`. **Recomendación: la función.** Deja el dato disponible en
SQL para poder ordenar y filtrar el listado sin traerlo todo a memoria.

---

## 9. AUDITORÍA

Se registra toda acción que cambie dinero, entitlements o el estado de una
cuenta. No se registran las lecturas: serían ruido y no aportan.

| Acción | `before` / `after` guardan |
|---|---|
| `ADMIN_ACTIVATED_PLAN` | plan y vigencia anterior → nuevos |
| `ADMIN_CHANGED_PLAN` | ídem |
| `ADMIN_EXTENDED_PLAN` | `ends_at` anterior → nuevo |
| `ADMIN_SUSPENDED_USER` | `activo`/`status` anterior → nuevo, con motivo |
| `ADMIN_REACTIVATED_USER` | ídem |
| `ADMIN_VERIFIED_PAYMENT` | `status` del pago, importe, plan |
| `ADMIN_REJECTED_PAYMENT` | motivo obligatorio |
| `ADMIN_CHANGED_LIMIT` | límite anterior → nuevo, motivo obligatorio |
| `ADMIN_ADDED_NOTE` | solo referencia; el texto va en la entidad |
| `ADMIN_GRANTED_ROLE` / `ADMIN_REVOKED_ROLE` | rol anterior → nuevo |

`before`/`after` guardan **solo los campos afectados**, no la fila entera:
menos ruido y menos datos personales acumulados sin necesidad.

---

## 10. ACTIVIDAD Y USO

### Merece persistirse

| Evento | Para qué sirve de verdad |
|---|---|
| `generation_started` | Detectar generaciones colgadas |
| `generation_completed` | Uso real por herramienta |
| `generation_failed` | Tasa de error por herramienta y modelo |
| `material_saved` | Conversión: generar → conservar |
| `material_exported` | Qué se usa de verdad en el aula |
| `tool_used` | Qué herramientas abren y no llegan a usar |

### No merece persistirse

Vistas de página, clics de filtro, apertura de modales, scroll, cada
pulsación del asistente. Es volumen sin decisión asociada: nadie va a cambiar
el producto por saber cuántas veces se abrió un desplegable.

**El login tampoco**: `auth.users.last_sign_in_at` ya lo da.

**Los prompts nunca.**

### Retención

Eventos en crudo, 180 días. Más allá, agregados mensuales por docente y
herramienta. Sin esto la tabla crece sin freno y las consultas del panel se
degradan justo cuando hay más docentes.

---

## 11. MEDICIÓN DE IA

Una sola fila por generación en `ai_generations` — la misma que hace de vale
de reembolso. **Cero contadores duplicados**: el contador semanal de
`ai_usage_counters` es el camino rápido para decidir *si puede generar*; la
tabla de generaciones es la verdad histórica de *qué pasó*.

Se puede reconciliar en cualquier momento:

```
used esperado = generaciones de la semana en curso sin refunded_at
```

Si el contador y esa cuenta divergen, hay un fallo; y es comprobable con una
consulta, no con conjeturas.

Con eso, cuando llegue el bloque de optimización de Gemini, ya se puede
responder: generaciones por docente y por herramienta, tokens de entrada y
salida, modelo usado, tasa de éxito, duración y coste estimado por el precio
vigente. **Sin implementar nada de optimización ahora**: solo queda el modelo
listo para medir.

---

## 12. PANEL ADMIN

### Dashboard

Docentes totales · activos (con acceso en 30 días) · nuevos esta semana ·
reparto free/pagados · generaciones y su tasa de error · materiales creados ·
docentes con el límite agotado · **pagos pendientes de verificar** (lo
primero: es lo único con alguien esperando al otro lado) · actividad reciente.

### Listado

Búsqueda por nombre, correo o institución. Filtros: plan, estado, nivel,
rango de registro, «límite agotado», «con pago pendiente». Columnas: docente,
institución, plan, estado, registro, último acceso, consumo de la semana.
Orden y paginación en servidor. Acciones rápidas en fila.

### Detalle

Perfil · estado de cuenta y suscripción · historial de planes · pagos ·
consumo de IA con su serie temporal · actividad reciente · materiales
(recuento y tipos, **no** su contenido) · notas internas · auditoría de esa
persona.

### Acciones y confirmación

| Acción | Confirmación |
|---|---|
| Añadir nota | inline, sin modal |
| Registrar pago | modal con resumen |
| Verificar pago | modal + **motivo** + resumen del plan que activará |
| Activar / cambiar plan | modal + motivo + fecha de fin calculada a la vista |
| Extender vigencia | modal con fecha anterior y nueva |
| Ajustar límite | modal + motivo **obligatorio** |
| Volver a Free | modal + advertencia de pérdida de beneficios |
| Suspender | modal + motivo + **reconfirmación escribiendo el nombre** |
| Reactivar | modal + motivo |
| Dar/quitar rol admin | solo superadmin + reconfirmación |

Toda acción sensible dice **qué va a pasar en concreto** —«pasará al plan
Mensual hasta el 6 de octubre de 2026»— y no un genérico «¿estás seguro?».

---

## 13. MI CUENTA DEL DOCENTE

| Sección | Contenido |
|---|---|
| Perfil | Nombres, apellidos, IE, celular, nivel. Correo visible, no editable aquí |
| Mi plan | Plan actual, beneficios, vigencia o «sin vencimiento» |
| Mi consumo | Usadas / disponibles esta semana, cuándo se renuevan |
| Mejorar | Comparativa y contacto por WhatsApp con mensaje prellenado |
| Historial | Solo si hay algo que contar: activaciones y renovaciones |

### Mensajes

| Situación | Mensaje |
|---|---|
| Límite alcanzado | «Ya usaste tus 5 creaciones de esta semana. Se renuevan el lunes 13.» + mejorar plan |
| Cuenta suspendida | «Tu cuenta está suspendida. Escríbenos y lo resolvemos.» + WhatsApp |
| Generación fallida | «No pudimos generar el contenido. **No se te descontó ninguna creación.**» |
| Plan activado | «¡Listo! Tu plan Mensual está activo hasta el 6 de octubre.» |
| Plan vencido | «Tu plan venció el 6 de octubre. Sigues teniendo el plan gratuito.» |
| Guardado | Toast «Cambios guardados» |
| Error de red | «No pudimos conectarnos. Revisa tu conexión e inténtalo otra vez.» |

Ninguno menciona Postgres, Supabase, Gemini, PostgREST ni códigos HTTP.

### Qué usa cada patrón

- **Inline**: validación de campos, avisos contextuales.
- **Toast**: confirmaciones de acciones reversibles.
- **Modal**: cerrar sesión, eliminar material, cualquier cosa irreversible.
- **Reconfirmación**: nada en la cuenta del docente la necesita hoy. Reservada
  para el panel administrativo.

---

## 14. LA TENSIÓN CON 002 — Y QUÉ HACER

`002_secure_ai_credits.sql` pone `ai_weekly_limit`, `ai_week_used` y
`ai_week_start` **en `docentes`**, porque así se pidió cuando el objetivo era
restaurar el servicio. Esta arquitectura dice que el límite pertenece al plan
y el contador a su propia tabla. Es una contradicción real y hay que
resolverla a la vista, no dejarla enterrada.

**Recomendación: aplicar 002 tal cual está.**

La generación con IA lleva caído desde antes de esta sesión. Retener el
arreglo hasta tener toda la arquitectura de cuentas sería cambiar una avería
en curso por una espera de semanas.

Mover el contador después es barato **por construcción**: 002 deja las tres
funciones como los únicos escritores de esas columnas —el cliente ya no
puede tocarlas—, así que la migración posterior cambia el almacenamiento
dentro de tres cuerpos de función y nada más. Sin ella, el radio de cambio
sería todo el que pudiera escribir la tabla.

La alternativa —rehacer 002 ahora— también es legítima si prefieres no
desplegar algo que ya sabes que vas a mover. Cuesta un bloque más de avería.
**Es tu decisión; mi recomendación es restaurar el servicio primero.**

---

## 15. BACKEND

### Lectura directa con RLS

Barato, sin secretos, y RLS ya lo cubre: perfil propio, materiales propios,
plan y consumo propios, catálogo de planes (`is_public`, solo lectura).

### Obligatoriamente por API o RPC

Todo lo que otorgue derechos o mueva dinero: consumo y reembolso de crédito
(RPC de 002), activación de plan, verificación de pago, listados y acciones
administrativas, generación con IA.

### Servicios

```
api/_lib/admin.js          verificación de rol + escritura de auditoría
api/admin/docentes.js      listado y detalle
api/admin/actions.js       plan, suspensión, límite, notas
api/admin/payments.js      registro y verificación
api/payments/declare.js    la docente declara que pagó
api/_lib/usage.js          registro de eventos y medición de IA
```

`api/list-docentes.js` queda sustituido por `api/admin/docentes.js`, y con él
desaparece `ADMIN_SECRET`.

---

## 16. MATRIZ DE PERMISOS

| Operación | docente | soporte | admin | superadmin |
|---|:--:|:--:|:--:|:--:|
| Ver su perfil / editarlo | ✅ | — | — | — |
| Ver su plan y consumo | ✅ | — | — | — |
| Declarar un pago | ✅ | — | — | — |
| Ver ficha de otro docente | ❌ | ✅ | ✅ | ✅ |
| Ver consumo y actividad ajenos | ❌ | ✅ | ✅ | ✅ |
| Añadir nota interna | ❌ | ✅ | ✅ | ✅ |
| Verificar / rechazar pago | ❌ | ❌ | ✅ | ✅ |
| Activar o cambiar plan | ❌ | ❌ | ✅ | ✅ |
| Extender vigencia | ❌ | ❌ | ✅ | ✅ |
| Suspender / reactivar | ❌ | ❌ | ✅ | ✅ |
| Ajustar límite excepcional | ❌ | ❌ | ✅ | ✅ |
| Editar catálogo y precios | ❌ | ❌ | ❌ | ✅ |
| Gestionar administradores | ❌ | ❌ | ❌ | ✅ |
| Leer la auditoría | ❌ | ✅ | ✅ | ✅ |
| Modificar la auditoría | ❌ | ❌ | ❌ | ❌ |

Nadie modifica la auditoría. Tampoco el superadmin.

---

## 17. FLUJOS

**1 · Registro gratuito.** Alta en Auth → trigger crea perfil → se crea
suscripción `free` (`source='signup'`, `ends_at null`) y contador en cero →
confirma correo → entra.

**2 · Pago por WhatsApp.** La docente pulsa «Mejorar plan» → se abre WhatsApp
con un mensaje que ya lleva plan e importe → paga → envía la constancia.
Opcionalmente declara el pago en la app (`payments`, `pending`).

**3 · Verificación.** El admin ve el pendiente → comprueba → «Verificar pago»
→ modal con importe, plan y vigencia → confirma con motivo.

**4 · Activación.** **Una transacción**: `payments.status='verified'` +
`verified_by`/`verified_at` → cierra la suscripción vigente
(`status='cancelled'`) → crea la nueva (`active`, `source='payment'`,
`ends_at = now() + billing_period_months`) → escribe
`ADMIN_VERIFIED_PAYMENT`. El índice único parcial impide dos activas aunque
dos admins pulsen a la vez.

**5 · Vencimiento.** `ends_at` queda atrás → la evaluación perezosa deja de
verla como activa → el plan efectivo pasa a `free` **sin que nada se
ejecute** → la docente ve «Tu plan venció el …».

**6 · Suspensión.** Admin → motivo → reconfirmación escribiendo el nombre →
`docentes.activo=false` + suscripción a `suspended` + auditoría. El consumo
de crédito ya lo respeta (`ACCOUNT_INACTIVE` en 002).

**7 · Reactivación.** Inversa, con motivo y auditoría. Si el plan venció
mientras estaba suspendida, vuelve a `free`: la suspensión no regala tiempo.

**8 · Límite alcanzado.** `consume_ai_credit` devuelve
`WEEKLY_LIMIT_REACHED` → 429 → mensaje con la fecha de renovación y la vía de
mejora. **No se llama a Gemini y no se descuenta nada.**

---

## 18. RIESGOS DE DISEÑO

| Riesgo | Cómo se contiene |
|---|---|
| Dos suscripciones activas | Índice único parcial en base, no en la app |
| Pago verificado sin plan activado | Una sola transacción |
| Doble registro del mismo pago | UNIQUE `(user_id, reference)` |
| Contador y ledger divergen | Consulta de reconciliación (§11) |
| `activity_events` desbocada | Lista corta de eventos + retención de 180 días |
| Tabla nueva en `public` visible a `anon` | Lo privado va a `sciverse_private` |
| Admin que se autoconcede superadmin | Solo superadmin gestiona roles, y queda auditado |
| Auditoría manipulada | Sin UPDATE/DELETE para nadie, más trigger |
| Un admin se queda fuera | Al menos dos superadmins, siempre |
| Migrar `docentes.plan` rompe lecturas | Retirada en tres pasos (§4) |
| Prompts con datos de menores en logs | No se guardan prompts, en ninguna forma |

---

## 19. QUÉ NO DEBEMOS HACER

- **No** dejar que el navegador escriba `plan`, `activo`, límites ni contadores.
- **No** poner en `public` nada que el docente no deba ver.
- **No** volver a un `ADMIN_SECRET` compartido: sin identidad no hay auditoría.
- **No** guardar tarjetas, CVV ni credenciales bancarias. Nunca.
- **No** guardar prompts.
- **No** duplicar el login: `auth.users.last_sign_in_at` ya existe.
- **No** convertir `docentes` en una tabla de cincuenta columnas.
- **No** meterlo todo en un `jsonb` gigante: lo que se filtra u ordena, columna.
- **No** usar tipos `enum` de Postgres para estados: añadir un valor es una
  migración incómoda. `text` con CHECK es igual de estricto y más flexible.
- **No** crear tablas «por si acaso» — preferencias, features — sin un caso real.
- **No** confiar en `pg_cron`: no está instalado.
- **No** permitir editar la auditoría a nadie.

---

## 20. ORDEN DE IMPLEMENTACIÓN

| # | Bloque | Depende de | Por qué ahí |
|---|---|---|---|
| **A** | Aplicar `002` + cambio de código del vale | — | **La generación está caída.** Nada de esto importa si el producto no funciona |
| **B** | `003_material_types` | A | Lo generado debe poder guardarse |
| **C** | `plans` + `subscriptions` + backfill + vista de plan efectivo | — | Cimiento de todo lo comercial. `docentes.plan` deja de escribirse |
| **D** | `admin_users` + `admin_audit_log` + `_lib/admin.js` | C | Antes de dar poder, saber quién lo ejerce y dejar rastro |
| **E** | Panel admin: listado y ficha (solo lectura) | D | Ver antes de tocar |
| **F** | `payments` + verificar y activar en una transacción | C, D, E | El primer flujo que mueve dinero |
| **G** | Acciones: plan, suspensión, límite, notas | F | Con auditoría ya en marcha |
| **H** | Mover el contador a `ai_usage_counters`; límite desde el plan | A, C | Cierra la contradicción de §14 |
| **I** | `ai_generations` ampliada + `activity_events` | A, H | Medir cuando ya hay qué medir |
| **J** | «Mi cuenta»: plan, consumo, mejora | C, H | Lo que ve la docente, ya con datos reales |
| **K** | Retirar `ADMIN_SECRET` y `api/list-docentes.js` | D, E | Solo cuando el sustituto funciona |
| **L** | `004_profile_sync` | C | Independiente; puede adelantarse si molesta |

Camino crítico: **A → C → D → E → F**. Todo lo demás puede reordenarse.

---

## 21. LO QUE SIGUE REQUIRIENDO DASHBOARD

Sin cambios respecto al documento 26: Site URL, Redirect URLs, confirmación de
correo, recuperación, duración de sesión, SMTP, plantillas y la existencia de
buckets de Storage. Este bloque no los toca ni los supone.
