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
