# SCIVERSE V2 — CONTINUATION STATE

## ÚLTIMA ACTUALIZACIÓN

2026-09-04 · Bloque Visual 03 cerrado y revalidado + rama publicada en Vercel Preview.

Esta revalidación se ejecutó sobre un `dist` reconstruido desde el HEAD actual.
Antes de empezar había un proceso `vite preview` huérfano (PID en el puerto
4173) sirviendo un build antiguo: se terminó y se reconstruyó, porque cualquier
auditoría contra ese proceso habría medido código que ya no existe. Conviene
repetir ese paso al inicio de cada sesión de QA.

## ESTADO ACTUAL

- Rama: `feat/visual-overhaul`
- Bloque Visual: **100% terminado**
- Working tree limpio.
- Rama publicada en `origin` y desplegada como **Vercel Preview** (ver el bloque
  de despliegue al final).
- No se hizo merge a `main`, ni deploy a producción, ni cambios en Supabase.

## BLOQUE VISUAL — CIERRE

| Área | Estado |
|---|---|
| Landing | 🟢 |
| Auth | 🟢 |
| App Shell | 🟢 |
| Dashboard | 🟢 |
| Crear | 🟢 |
| Sesiones | 🟢 |
| Herramientas | 🟢 |
| Biblioteca | 🟢 |
| Cuenta | 🟢 |
| Capacitación | 🟢 |
| Planes | 🟢 |
| Responsive | 🟢 |
| Accessibility | 🟢 |
| Visual QA | 🟢 |

## QUÉ SE TERMINÓ

1. Contraste WCAG AA corregido en Actividades STEAM y Retos grupales.
2. Consolidación local de colores preservada y completada para los roles
   visuales tocados; no se revirtió.
3. La sección Sesiones quedó terminada como asistente de tres pasos:
   - Datos básicos.
   - Propósito y contexto.
   - Revisión.
   - Barra de acciones sticky que se eleva sobre la navegación móvil y respeta
     `env(safe-area-inset-bottom)`.
   - Etiquetas explícitas `htmlFor`/`id` en los campos con sugerencias de Kantu.
   - `handleGenerate`, prompts y créditos intactos.
4. Sección Herramientas terminada con el catálogo compartido `ToolGrid` y
   `config/tools.js`; navegación desktop y móvil. No se construyó un catálogo
   paralelo. Unidad de aprendizaje sigue como Próximamente. El crucigrama no
   volvió al catálogo.
5. Responsive final revisado en `375`, `430`, `768`, `1024`, `1280`, `1440`,
   `1920` y `844x390`.
6. Accessibility final:
   - Texto mínimo de 12 px.
   - Objetivos táctiles comprobados.
   - Foco visible comprobado por teclado.
   - Contraste medido sobre el render real, no leído del CSS.
7. Pase de consistencia visual completado en Landing, Auth, Shell, Dashboard,
   Crear, Sesiones, Herramientas, Biblioteca, Actividades, Retos y Cuenta.
8. CTA final de Landing centrado mediante el contenedor completo:
   - `max-width: var(--content-max)`.
   - `margin-inline: auto` explícito.
   - ancho con gutters simétricos y padding simétrico.
   - sin `left`, sin `transform`, sin márgenes laterales arbitrarios.

## QA VISUAL REAL — REVALIDADO

```bash
node scripts/visual-qa.mjs docs/qa
```

```text
vistas auditadas:                  88
problemas de layout:                0
errores/warnings propios:           0
vistas que no llegaron al destino:  0
```

El script verifica también que Landing, Login, Registro y las secciones
autenticadas realmente alcanzan su destino, en lugar de asumirlo: una versión
anterior hacía clic sobre elementos ocultos del sidebar y auditaba el
dashboard creyendo auditar otra vista. La excepción de WCAG 2.5.8 para los
botones legales en línea del consentimiento está documentada en el script.

## ACCESIBILIDAD — REVALIDADO

```bash
node scripts/a11y-qa.mjs
```

```text
landing:         0 fallos      landing-movil:  0 fallos
panel:           0 fallos      panel-movil:    0 fallos
actividades:     0 fallos      retos:          0 fallos
biblioteca:      0 fallos      herramientas:   0 fallos

contraste (WCAG AA):  0 fallos
foco visible:         0 fallos
teclado:              0 fallos  ·  185 paradas en 8 vistas
TOTAL:                0 problemas de accesibilidad
```

Los textos secundarios usan `neutral-600`; los terciarios, `neutral-550`.
Las etiquetas de nivel conservan sus fondos e intención visual y usan
`amber-700` para Primaria y `teal-800` para Secundaria.

El modal comprobado sobre render real: atrapa el foco (0 fugas en 30
tabulaciones), bloquea el scroll del body, cierra con Escape y devuelve el
foco al disparador.

## CTA LANDING — REVALIDADO

Medición del contenedor `.lp-final` sobre el render de producción:

| Viewport | Margen izquierdo | Margen derecho | Diferencia | Ancho |
|---:|---:|---:|---:|---:|
| 375 | 24 px | 24 px | 0 px | 327 px |
| 1024 | 24 px | 24 px | 0 px | 976 px |
| 1280 | 40 px | 40 px | 0 px | 1200 px |
| 1440 | 120 px | 120 px | 0 px | 1200 px |
| 1920 | 360 px | 360 px | 0 px | 1200 px |

Computado en 1440: `margin-inline: 120px/120px`, `padding: 24px/24px`,
`transform: none`, `position: static`, `left/right: auto`.

## TESTS Y BUILD — REVALIDADO

```text
npm test        22/22 ✓
npm run build   ✓  (build 1)
npm run build   ✓  (build 2)
```

Los dos builds consecutivos producen artefactos **byte-idénticos**:

```text
JS   sha256[0:16] = 7a2fde0e7a1b2f23   (idéntico en ambos builds)
CSS  sha256[0:16] = 764d984272f3f13b   (idéntico en ambos builds)
```

Mutación de fuentes tras dos builds: **ninguna** (`git status --porcelain`
vacío). El codemod sigue fuera del build y no debe reintroducirse.

Aviso conocido y no bloqueante: Vite informa que el bundle JS principal supera
500 kB. La división del bundle pertenece al siguiente bloque técnico.

## CONTEXTO CRÍTICO — NO ROMPER

- `api/_lib/*` y el backend de créditos permanecen intactos.
- Una sesión consume un crédito y conserva el refund mediante `withCredit`.
- `useMaterialSave`, `SaveStatus`, `describeSaveError`, descargas y guardado
  permanecen activos.
- `resendConfirmation()` continúa siendo real; no mockear.
- Perfil, autorización admin y modelo Gemini no fueron modificados.
- `gemini-3.6-flash` es un modelo válido; no "corregirlo" (ver
  `docs/audit/25-AUDIT-CORRECTIONS.md`, C-1).
- No ejecutar todavía `supabase/migrations/001_material_types.sql`.
- No rotar ni tocar secretos desde este bloque.
- El QA no ejecuta Gemini ni consume créditos: usa una sesión falsa en
  `localStorage` y nunca dispara generación.

## PENDIENTES FUERA DEL BLOQUE VISUAL

1. Supabase real y credenciales: flujo de auth y persistencia contra un
   proyecto real antes de producción.
2. Validar contra producción y sólo después ejecutar
   `supabase/migrations/001_material_types.sql`.
3. Rotar `ADMIN_SECRET` en Vercel cuando se autorice.
4. Pruebas funcionales conectadas (guardado, créditos, refund, admin) contra
   backend real.
5. Backend restante y Bloque Técnico C: retirar código muerto de `App.jsx`
   de forma incremental y verificable (`ImprovedLanding`, `RegistrationGate`,
   `Usage`, `CrosswordGenerator` — este último ya es inalcanzable, definido y
   nunca referenciado), y dividir el bundle empezando por Admin y la
   exportación DOCX, sin cambiar comportamiento.

## BLOQUE DEPLOY VISUAL A VERCEL — 2026-09-04

### Publicación

| Concepto | Valor |
|---|---|
| Rama subida | `feat/visual-overhaul` → `origin` (rama nueva, sin force) |
| Commit desplegado | `5792552` |
| Remote | `github.com/teachingticconsultorias-source/pruebatt` |
| Integración | GitHub → Vercel, activa y automática |
| Deployment | **Preview** (no producción) |
| Estado del build | **success** |
| URL de Preview | https://pruebatt-qxduw84vy-teaching-tic.vercel.app |
| Inspector | https://vercel.com/teaching-tic/pruebatt/8wW2H2wN5XWFV32mdZgqTuvf5oJZ |
| Merge a `main` | NO realizado |

### Un primer deploy falló y por qué

El push inicial (`6f4d6c8`) **falló** en Vercel. El siguiente (`5792552`),
con el mismo código de aplicación, compiló. La única diferencia es la
retirada de `pnpm-lock.yaml`:

- Coexistían `package-lock.json` y `pnpm-lock.yaml`, y Vercel prioriza pnpm
  cuando encuentra su lockfile.
- `pnpm-lock.yaml` no se actualizaba desde las subidas iniciales, así que le
  faltaba `vitest`, añadido a `package.json` en `8580bc6` junto con las
  pruebas P0. El desajuste lo introdujo este trabajo.
- `pnpm install` en CI usa `--frozen-lockfile` y aborta con
  `ERR_PNPM_OUTDATED_LOCKFILE` antes de llegar al guard de entorno.

Se retiró el lockfile obsoleto en lugar de regenerarlo: el proyecto se
mantiene con npm, `package-lock.json` está sincronizado con las once
dependencias declaradas y `npm ci --dry-run` resuelve sin conflictos.
No cambió ninguna versión instalada.

**Lección para el próximo despliegue:** no reintroducir un segundo lockfile.

### Variables de entorno

No hay credenciales de Vercel en este entorno (`vercel whoami` → sin
credenciales), así que no se pudo leer ni modificar la configuración. No se
inventó ningún valor y no se puso ninguna variable dummy.

Aun así, el resultado del build permite una inferencia sólida:

| Variable | Estado |
|---|---|
| `VITE_SUPABASE_URL` | **Presente** en el scope Preview |
| `VITE_SUPABASE_PUBLISHABLE_KEY` o `VITE_SUPABASE_ANON_KEY` | **Presente** (al menos una) |

El motivo: `npm run build` ejecuta `scripts/check-env.mjs` antes de Vite y
aborta si falta cualquiera de las dos. El build terminó en success, luego
ambas están definidas. Única salvedad no descartable sin acceso: que en
Vercel esté puesto `SCIVERSE_SKIP_ENV_CHECK=1`, que saltaría la comprobación.

Ningún valor fue impreso. Secretos (`GEMINI_API_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET`) no consultados ni tocados.

### QA visual online — BLOQUEADO POR ACCESO

La preview está detrás de **Vercel Deployment Protection (SSO)**: responde
302 hacia `vercel.com/sso-api` y termina en `vercel.com/login`. Sin sesión
del equipo `teaching-tic` no es alcanzable, y no se intentó sortearlo.

Por tanto **no se pudo ejecutar el QA online en 375/768/1440**. No es un
fallo del rediseño: el build es correcto y el frontend no llegó a evaluarse
en remoto.

Ojo con revisar la URL equivocada: el alias público `pruebatt.vercel.app`
responde 200 pero sirve `index-DGkFS7QB.js`, el bundle de `main`, anterior
al rediseño. El commit desplegado genera `index-CMRTgi7D.js`.

Para desbloquear, cualquiera de estas dos:

1. Abrir la URL de Preview con la sesión de Vercel del equipo (lo más
   directo, no cambia nada en el proyecto).
2. Vercel → Settings → Deployment Protection → Vercel Authentication:
   desactivarla para Preview.

### Backend

Sin cambios: Supabase no tocado, ninguna migración ejecutada, Gemini
intacto, créditos intactos, `ADMIN_SECRET` no rotado.

### Siguiente acción exacta

Revisar la Preview visualmente y decidir el merge a `main`. El merge sigue
sin hacerse a propósito: producción continúa sirviendo el código anterior.

## MERGE A MAIN Y DEPLOY DE PRODUCCIÓN — 2026-09-04

| Concepto | Valor |
|---|---|
| main anterior | `e49c68c` |
| main final | `1f70a59` (merge `--no-ff` de `feat/visual-overhaul`) |
| Conflictos | ninguno: `origin/main` era ancestro estricto de la rama |
| Push | `e49c68c..1f70a59`, sin force, sin reescribir historial |
| Validación previa | tests 22/22 · build OK · `git diff --check` limpio · sin mutación de fuentes |
| Deployment de producción | **success** para `1f70a59` |
| URL del deployment | https://pruebatt-na8i5e912-teaching-tic.vercel.app |
| Inspector | https://vercel.com/teaching-tic/pruebatt/2Qmhj3eQJER1Vw2iHwbg6uX4drgb |

### El dominio público todavía no sirve el rediseño

`pruebatt.vercel.app` responde 200 pero sigue entregando `index-DGkFS7QB.js`,
el bundle anterior. No es caché del edge: el asset del build nuevo,
`/assets/index-CMRTgi7D.js`, devuelve **404** en ese dominio, mientras el
antiguo devuelve 200. Un alias apuntando al deployment nuevo serviría el
asset nuevo.

Conclusión: **`pruebatt.vercel.app` no es el alias de producción de este
proyecto**. Apunta a otro proyecto de Vercel o está fijado a un deployment
antiguo. Hay que revisarlo en Vercel → Settings → Domains.

El deployment correcto de `main` sí existe y compiló, pero su URL está
detrás de Deployment Protection (302 → `vercel.com/login`), así que no se
pudo verificar su contenido desde aquí.

### Qué falta para ver el rediseño en el dominio principal

1. En Vercel → Settings → Domains, comprobar a qué proyecto/deployment está
   asignado `pruebatt.vercel.app` y apuntarlo al proyecto `teaching-tic/pruebatt`.
2. O bien desactivar Deployment Protection para poder abrir la URL del
   deployment de producción directamente.

### Backend

Sin cambios: Supabase no tocado, `001_material_types.sql` sin ejecutar,
RLS/RPC/tablas intactos, Gemini y créditos intactos, `ADMIN_SECRET` no rotado,
variables de Vercel sin modificar.

## BLOQUE BACKEND — AUDITORÍA (etapa 1) · 2026-09-04

Entregable: `docs/audit/26-PRODUCTION-BACKEND-AUDIT.md`. **Solo auditoría.**
No se modificó base de datos, RLS, RPC, correos, variables ni secretos, y no
se ejecutó ninguna migración.

### Limitación que define este bloque

La auditoría pedía el estado **real de producción**. Este entorno **no tiene
acceso**: Vercel sin credenciales, Supabase CLI ausente, y `.env.local` con
los valores ficticios de QA (`VITE_SUPABASE_URL` apunta a `example`). Por eso
el documento audita el **código y el SQL versionado**, y marca cada sección
como ✅ verificado, ⚠️ deducido o 🔒 requiere acceso. El repositorio describe
la intención; no demuestra qué hay aplicado hoy.

### Hallazgos principales

| Nivel | Hallazgo |
|---|---|
| CRÍTICO | La política de UPDATE de `docentes` no restringe columnas: un docente puede ponerse `ai_week_used = 0`, subir `ai_weekly_limit` y cambiar su `plan` por PostgREST |
| CRÍTICO | `refund_ai_credit()` está concedida a `authenticated` y no comprueba nada: invocable en bucle |
| ALTO | El rate limit vive en memoria del proceso: en serverless no protege el panel admin |
| ALTO | `ADMIN_SECRET` estuvo en query string; sigue sin rotar |
| MEDIO | Tres ficheros SQL redefinen el CHECK de `tipo` con listas distintas y ninguno incluye `challenge`, que la app sí escribe: el reto se pierde con el crédito ya gastado |
| MEDIO | Dos mensajes de infraestructura visibles al docente en `AuthGate.jsx` |

Limpio y comprobado: sin `service_role` ni secretos en el bundle, sin SQL
inyectable, sin RLS ausente, sin endpoints admin abiertos.

Mejor de lo esperado: `AuthGate.jsx` ya traduce los errores de Supabase a
castellano y no filtra texto técnico. El flujo de recuperación vivo se apoya
en el evento `PASSWORD_RECOVERY`, que es lo robusto; la segunda
implementación en `App.jsx` es código muerto.

### Para completar la auditoría hace falta

1. Acceso de lectura a Supabase (cadena de conexión en solo lectura, o la
   salida de consultas a `information_schema` y `pg_policies`).
2. `vercel login` en este entorno, o la lista de variables con los valores
   tapados.
3. Auth → URL Configuration y Email Templates.
4. Auth → SMTP: proveedor y dominio, sin credenciales.

Ningún secreto debe pegarse en el chat: el sitio es `.env.local`, que está
en `.gitignore`.

## BLOQUE P0 CRÉDITOS — ETAPA DE VERIFICACIÓN · 2026-09-04

**Bloqueado por acceso.** Se revisó de nuevo al empezar: `.env.local` sigue
apuntando al proyecto ficticio `example`, no hay cadena de conexión, Vercel
sin credenciales, Supabase CLI ausente y proyecto no enlazado. Los dos
críticos de créditos **siguen siendo deducidos**; no se convierten en
verificados por repetirlos.

Entregado para desbloquear: `supabase/inspect/001_production_state.sql`,
**17 consultas de solo lectura** que responden en una pasada a políticas,
grants por tabla y por columna, permisos de EXECUTE, cuerpo real de
`refund_ai_credit()`, triggers, CHECK vigente de `tipo`, tipos ya
almacenados y si `001` está aplicada. No escribe nada y no devuelve datos
personales. Ejecutar en Supabase → SQL Editor y devolver la salida.

### Verificado en esta etapa (sobre el código, no sobre producción)

1. **Ningún UPDATE del cliente sobre `docentes`.** El privilegio que hace
   explotable CRÍTICO-1 no lo usa nadie: retirarlo no rompe la aplicación.
   La corrección es mucho menos arriesgada de lo previsto.
2. **Los cambios de perfil nunca llegan a la tabla.** `saveProfile` usa
   `supabase.auth.updateUser`, y el trigger solo actúa en INSERT. `nivel` e
   `ie` quedan congelados en `docentes` mientras la app los lee de ahí.
   Hallazgo nuevo, nivel MEDIO.
3. **El backend llama a las RPC como `authenticated`**, con el JWT del
   usuario y la clave publishable. Postgres no distingue navegador de
   servidor, así que un `revoke execute` a secas **rompería el reembolso
   legítimo** de los cinco generadores.
4. **`src/` es un árbol duplicado muerto** (5 ficheros); `index.html` carga
   `/main.jsx` de la raíz.

### Corrección de CRÍTICO-2: camino elegido

Descartado usar `service_role` en los generadores, porque exigiría cambiar
Vercel —prohibido en este bloque— y ampliaría el alcance de la clave más
peligrosa. Se propone **vale de un solo uso**: `consume_ai_credit()` registra
el consumo y devuelve un token; `refund_ai_credit(p_token)` solo reembolsa si
el vale existe, no se ha usado, es del propio usuario y es reciente. Crea de
paso la tabla de auditoría de créditos que ya figuraba como P2.

### No escrito a propósito

`002_secure_ai_credits.sql` **no se ha escrito**. Una migración que revoca
privilegios y cambia la firma de una función, redactada contra un esquema
supuesto, es exactamente lo que rompe producción. Se escribirá con la salida
de la inspección delante.

`001_material_types.sql` sigue **sin ejecutar**.

## PRODUCCIÓN VERIFICADA CON EL DUMP REAL · 2026-09-06

Fuente de verdad: `supabase/production-full-schema.sql`. Las deducciones
anteriores quedan resueltas en la ADENDA B de
`docs/audit/26-PRODUCTION-BACKEND-AUDIT.md`. Solo análisis: no se ejecutó
ninguna migración, ALTER, GRANT ni cambio de Auth o Vercel.

### El hallazgo principal no era el que buscábamos

**La generación con IA está caída en producción.** Los cinco endpoints llaman
a `consume_ai_credit` antes de tocar Gemini; esa función **no existe** en la
base real, PostgREST devuelve 404 y ambos helpers lanzan. En `withCredit()`
el consumo va antes de la operación, así que Gemini nunca llega a llamarse.

No es una fuga de créditos: es una caída total de la función principal del
producto. Y en dos endpoints el mensaje crudo de PostgREST llega a la
pantalla de la docente.

### Qué hay realmente en producción

Solo se aplicó `supabase-schema.sql`. Nunca llegaron `supabase-freemium.sql`,
`supabase-session-resources.sql`, `supabase-session-flow-v2.sql` ni
`001_material_types.sql`. No hay tabla de migraciones que lo registrara.

- Sin columnas ni funciones de crédito (0 coincidencias de `ai_credit`).
- CHECK de `tipo` con los 4 tipos originales: **4 de los 5 tipos que escribe
  el frontend fallarían al guardar** en cuanto se restaure la generación.
- `authenticated` y `anon` con `GRANT ALL` sobre ambas tablas, sin GRANT por
  columna: un docente puede cambiarse el `plan`.
- Trigger `al_crear_usuario` y `crear_perfil_docente()` correctos. No tocar.

### Dos conclusiones previas que estaban mal

- **MEDIO-1 retirado**: no existe índice sobre `lower(correo)` en producción,
  así que el fallo de registro por mayúsculas que describí no puede ocurrir.
- **CRÍTICO-2 reclasificado**: `refund_ai_credit()` no está desplegada. El
  fallo de diseño es real, pero no está vivo. Debe cerrarse *antes* de
  instalar los créditos, no después.

### Orden recomendado (diseñado, no ejecutado)

1. `002_secure_ai_credits.sql` — restaura la generación y cierra el agujero de
   columnas en el mismo paso. Incluye vale de un solo uso para el reembolso.
2. Verificar generación en producción.
3. `003_material_types.sql` (el actual 001, renumerado).
4. Verificar guardado de los cuatro tipos que hoy fallan.
5. `004_profile_sync.sql` — `ie` y `nivel` se desincronizan porque «Mi cuenta»
   escribe en `auth.users` y la app los lee de `docentes`.

### Sigue requiriendo dashboard

Site URL, Redirect URLs, confirmación, recuperación, duración de sesión, SMTP
y plantillas: el dump trae la estructura de `auth`, no los ajustes. Y los
buckets de Storage son filas, no esquema: un volcado `--schema-only` no puede
decir si existen.

## ARQUITECTURA DE CUENTAS, PLANES Y ADMINISTRACIÓN · 2026-09-06

Entregado: `docs/audit/27-ACCOUNTS-PLANS-ADMIN-ARCHITECTURE.md`. **Solo
diseño**: sin SQL ejecutado, sin migraciones escritas, sin UI, sin push.

### Modelo propuesto

Cuatro dominios separados: identidad (`auth.users`), perfil
(`public.docentes`), estado comercial (`plans`, `subscriptions`,
`payments`) y uso (`ai_usage_counters`, `ai_generations`,
`activity_events`). La administración vive entera en `sciverse_private`:
`admin_users` y `admin_audit_log`.

Dos reglas gobiernan el resto: el cliente puede leer lo suyo pero nunca
escribir nada que determine su derecho a algo; y lo que el docente no deba
ver no vive en `public`, porque los privilegios por defecto del proyecto
conceden a `anon` sobre cada tabla nueva de ese esquema.

### Tres hechos del dump que condicionaron el diseño

1. **`service_role` no puede leer `auth.users`.** Para mostrar correo
   confirmado y último acceso hace falta una función SECURITY DEFINER
   propiedad de postgres, o la Admin API por HTTP. No hay JOIN posible.
2. `auth.users.last_sign_in_at` ya existe: **no se construye seguimiento de
   login**, sería duplicar algo que la plataforma mantiene mejor.
3. `docentes.nivel` **no tiene CHECK** en producción; el del repositorio
   nunca se aplicó.

### Decisiones que conviene recordar

- `docentes.plan` sale a `subscriptions`, retirado en tres pasos.
- `activo` y `correo` se quedan, con semántica aclarada.
- Índice único parcial `(user_id) where status=active`: **la base** impide
  dos planes activos, no la aplicación.
- Plan efectivo por **evaluación perezosa**: no hay `pg_cron` y así no queda
  ninguna ventana en la que un plan vencido siga dando acceso.
- Verificar pago y activar plan son **una sola transacción**.
- `ADMIN_SECRET` desaparece: los administradores son usuarios de Auth con
  fila en `admin_users`, y cada acción queda a nombre de una persona.
- Se descarta `plan_features`: `features jsonb` más un ayudante evita un
  JOIN en cada comprobación. Se creará si aparece un caso real.
- **No** se crea `docente_preferences`: hoy no hay ninguna preferencia real.
- Nada de `enum` de Postgres para estados: `text` con CHECK.

### Contradicción explícita con 002 — pendiente de tu decisión

`002` pone las columnas de crédito en `docentes`; esta arquitectura las
lleva a `ai_usage_counters` con el límite viniendo del plan.

**Recomendación: aplicar 002 tal cual.** La generación lleva caída desde antes
de esta sesión y retener el arreglo cambiaría una avería en curso por semanas
de espera. Mover el contador después es barato por construcción: 002 deja las
tres funciones como únicos escritores de esas columnas, así que la migración
posterior toca tres cuerpos de función y nada más.

### Orden de implementación

Camino crítico: **A → C → D → E → F**.

A aplicar 002 + código del vale · B material types · C plans+subscriptions ·
D admin_users+auditoría · E panel en solo lectura · F pagos y activación ·
G acciones · H mover contador · I medición · J Mi cuenta · K retirar
ADMIN_SECRET · L profile sync.

## NÚCLEO COMERCIAL + CRÉDITOS · REORDENADO · 2026-09-06

Decisión del usuario: **no aplicar la 002 anterior.** Como no se había
ejecutado, se evita nacer con las columnas `ai_*` en `docentes` sabiendo
que habría que moverlas. Los créditos nacen ya sobre la arquitectura del
documento 27.

### Migraciones diseñadas · NINGUNA EJECUTADA

Renumeradas para que el número sea el orden real de ejecución:

| Fichero | Contenido |
|---|---|
| `002_commercial_core.sql` | `plans`, `subscriptions`, plan Free sembrado, resolución del plan efectivo, trigger de suscripción automática |
| `003_secure_ai_credits.sql` | contador y libro en `sciverse_private`, las tres RPC, lista blanca de columnas de `docentes` |
| `004_material_types.sql` | renombrada desde `001_material_types.sql`; contenido intacto |

Pruebas: `supabase/inspect/004_test_commercial_and_credits.sql`.
Se retiró `002_secure_ai_credits.sql` (sustituida por 003).

### Qué cambió respecto a la 002 anterior

1. `docentes` **no recibe ninguna columna**.
2. El **límite** sale de `plans.ai_weekly_limit` vía `effective_plan()`:
   cambiarlo en el plan lo cambia para todos sin tocar filas de docente.
3. El **contador** vive en `sciverse_private.ai_usage_counters`.
4. El libro pasa a `ai_generations` — nombre definitivo, para que el bloque
   de medición le añada modelo, tokens y duración sin renombrar nada.
5. `get_ai_credit_status()` **deja de escribir**: el indicador se consulta a
   menudo y no debe provocar contención. Una semana caducada se lee como 0.
6. Se conserva todo lo demás: FOR UPDATE, ventana de 30 min, vale de un solo
   uso, mismo usuario, sin negativos, idempotencia, lista blanca de columnas.

### Decisiones de diseño que conviene recordar

- **Free por defecto: trigger + fallback, los dos.** El trigger sobre
  `public.docentes` materializa la suscripción; su bloque EXCEPTION impide
  que un fallo tumbe el registro; y `effective_plan()` cae a `free` si no
  encuentra suscripción válida. Ninguno de los dos cubre solo todos los casos.
  No se tocó `crear_perfil_docente()`.
- **Vencimiento por evaluación perezosa**, no por cron: no hay `pg_cron` y un
  job dejaría una ventana con el plan vencido dando acceso.
- **Bloqueo del contador con `INSERT … ON CONFLICT DO UPDATE`**: crea la fila
  si falta y la deja bloqueada en ambos casos. Resuelve de un golpe la carrera
  del primer consumo y la de dos pestañas.
- El paso 0 de 002 **aborta** si algún docente tiene un `plan` que no sepa
  traducir, para no degradar a nadie que ya pague. Comprobarlo antes con el
  censo del inspector consolidado.

### Cambios de código indispensables (aún NO aplicados)

| Archivo | Cambio |
|---|---|
| `api/_lib/credits.js` | `refundCredit` acepta `consumptionId` y lo envía como `body:{p_consumption}`; `withCredit` se lo pasa desde `credits.consumption_id` |
| `api/generate-linked-worksheet.js` | el helper `rpc()` acepta body; guardar el `consumption_id` y pasarlo al reembolso |
| `api/generate-session-resource.js` | ídem |

`api/_lib/supabase.js` **no cambia**: `callRpc` ya acepta `body`.

### Orden de despliegue

1. Censo de planes (inspector consolidado, apartado 14).
2. `002_commercial_core.sql` → bloques A y B de las pruebas.
3. `003_secure_ai_credits.sql` → bloques A, B y C.
4. Cambios de código y despliegue **en la misma ventana** que 003.
5. Verificar una generación real.
6. `004_material_types.sql` → verificar guardado de los cuatro tipos.

## CENSO DE PLANES · PASO PREVIO · 2026-09-06

**Bloqueado: este entorno no puede conectar a producción.** Hay proyecto
enlazado en `supabase/.temp` (ref `sqsovhfzcsaxuqtftvbi`), pero la URL del
pooler **no lleva contraseña** —comprobado sin imprimir su valor: no hay campo
de credencial entre el usuario y el host—, no hay `DATABASE_URL`, el Supabase
CLI no está instalado y `.env.local` sigue apuntando al proyecto ficticio.

Entregado para desbloquear: `supabase/inspect/005_census_planes.sql`. Una
sola sentencia de solo lectura que devuelve valores de `plan`, recuentos,
normalización y un veredicto directo sobre si 002 puede ejecutarse. No expone
ningún dato personal.

### Dos defectos corregidos en las migraciones propias

Encontrados en la revisión previa, antes de ejecutar nada:

1. **`002` abortaba con cadena vacía o con espacios.** La guarda comparaba
   `lower(plan)` sin recortar, así que `''` y `' gratuito '` se contaban como
   planes desconocidos y habrían parado la migración por un problema de
   calidad de dato, no de negocio. Ahora normaliza con `btrim`: NULL, vacío y
   sólo-espacios significan gratuito.
2. **`004` dejaba `touch_updated_at()` heredando EXECUTE para `anon`.** Los
   privilegios por defecto del proyecto la habrían expuesto en el esquema de
   PostgREST. Se añade el `revoke`, igual que en 002 y 003. El riesgo
   práctico era nulo —una función de trigger no es invocable directamente—
   pero rompía el criterio aplicado en el resto.

### Nota de higiene, sin urgencia

`supabase/.temp/` está versionado en un repositorio **público**. No contiene
secretos —lo verifiqué campo por campo—, pero es estado local del CLI y no
debería estar en el repositorio. Añadir a `.gitignore` cuando toque.

### Estado de las tres migraciones

Revisadas sin ejecutar. Orden, dependencias, transacción única, grants
explícitos, RLS, SECURITY DEFINER con `search_path` vacío, índices y
constraints: correctos. Las tres terminan con permisos explícitos, que es lo
que exige el proyecto por sus privilegios por defecto.

Quedan **listas salvo el censo**: 002 no puede ejecutarse hasta saber que no
hay planes sin equivalencia.

## CENSO APROBADO · 002 LISTA PARA APLICAR · 2026-09-06

Censo ejecutado manualmente en producción: **5 docentes, todos con user_id, y
un único valor de `plan`: «gratuito»**. Ningún NULL, ningún vacío, ningún
plan de pago. La guarda del paso 0 de 002 lo reconoce
(`lower(btrim('gratuito'))` → 'gratuito'), así que **no abortará**.

### Qué debe ejecutar el usuario

1. `supabase/migrations/002_commercial_core.sql` — copiar entero al SQL Editor.
2. Inmediatamente después: `supabase/inspect/006_verify_commercial_core.sql`,
   solo lectura, un único Results.

### Resultado esperado tras 002

| Comprobación | Esperado |
|---|---|
| 00 VEREDICTO · las cuatro filas | OK |
| Catálogo | 1 plan · free · ai_weekly_limit 5 |
| Suscripciones totales / activas / free | 5 / 5 / 5 |
| Origen | free_default = 5 |
| Plan efectivo | free (con suscripción real) = 5 · ninguna por fallback |
| Cobertura | con activa 5 · sin activa 0 · dos activas 0 |
| `docentes.plan` | sigue siendo «gratuito» — 002 no lo toca |
| Permisos | plans: SELECT para anon y authenticated · subscriptions: SELECT sólo authenticated · anon sin nada |
| sciverse_private | anon y authenticated en false |

Si «04 PLAN EFECTIVO» dijera «por fallback», la siembra no cubrió a alguien:
la aplicación seguiría funcionando (resuelve free igual), pero habría que
revisarlo antes de seguir.

### Todavía NO

003 no se prepara hasta que 002 esté verificada. Los cambios de código de la
API tampoco: van con 003, en la misma ventana.

## 002 CERRADA EN PRODUCCIÓN · 003 PREPARADA · 2026-09-06

`002_commercial_core.sql` **aplicada y verificada**: las cuatro filas del
veredicto de `006` en OK. No volver a auditarla.

### Código adaptado al contrato de 003

**Fueron cuatro archivos, no tres.** El inventario anterior se dejaba
`api/generate-with-quota.js`, que tenía su propio `callRpc` y dos llamadas a
`refund_ai_credit` sin vale.

| Archivo | Cambio |
|---|---|
| `api/_lib/credits.js` | `refundCredit` exige `consumptionId` y lo envía como `body:{p_consumption}`; sin vale registra y se salta. `withCredit` lo pasa desde `credits.consumption_id` |
| `api/_lib/errors.js` | nuevo `sendGenerationError`: traduce el fallo a un mensaje para la docente y manda el detalle al log |
| `api/generate-linked-worksheet.js` | `rpc()` acepta body · guarda y pasa el vale · deja de devolver `e.message` |
| `api/generate-session-resource.js` | ídem · el 429 deja de decir «5 creaciones», que ahora sale del plan |
| `api/generate-with-quota.js` | **cobraba dos créditos**: consumía uno y llamaba a `generate-session`, que consume otro con `withCredit`. Se retira su bloque de créditos y su `callRpc`; delega en el interno, que ya devuelve `_credits` |

Ese endpoint además **no lo llama nadie** desde el frontend: cero referencias.
Queda funcional y sin el doble cobro, pero conviene decidir si se elimina.

### Pruebas

23/23. La prueba de reembolso se actualizó al contrato nuevo y se **amplió**:
ahora comprueba que el cuerpo lleva `p_consumption` con el vale, y se añade
una que verifica que **sin vale no se llama al reembolso**. Build OK.

### Verificación posterior

`supabase/inspect/007_verify_ai_credits.sql`: una sola sentencia, solo
lectura, y **no invoca consume ni refund**, así que no gasta créditos de
nadie. Ocho comprobaciones en «00 VEREDICTO».

### Despliegue coordinado

003 cambia el contrato del reembolso, y Vercel despliega desde `main`. El
orden que minimiza la ventana incompatible:

1. **003 primero, código después.** Con la RPC nueva y el código viejo, la
   generación **funciona** y sólo se pierde el reembolso automático ante un
   fallo de Gemini. Al revés —código nuevo sin RPC— la generación seguiría
   caída.
2. La ventana dura lo que tarde el build de Vercel, minutos.
3. Hoy no hay nada que perder: la generación ya está caída, así que cualquier
   estado intermedio es mejor que el actual.

## SIGUIENTE ACCIÓN EXACTA

El Bloque Visual está cerrado. La siguiente acción autorizada es el **Bloque
Deploy Visual a Vercel**. No desplegar ni hacer push hasta recibir esa
autorización expresa; `feat/visual-overhaul` se mantiene sin push.

Al reanudar cualquier QA, primero:

```bash
# terminar cualquier vite preview huérfano en 4173, reconstruir y servir
npm run build && npm run preview
node scripts/visual-qa.mjs docs/qa
node scripts/a11y-qa.mjs
```
