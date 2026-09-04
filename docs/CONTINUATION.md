# SCIVERSE V2 — CONTINUATION STATE

## ÚLTIMA ACTUALIZACIÓN
2026-09-03 · inicio del Bloque Visual 01

## OBJETIVO ACTUAL
Transformación visual completa del frontend: Design Foundations → Brand → Splash/loaders → Landing → Auth → App Shell → Dashboard → resto.

## RAMA
`feat/visual-overhaul` (creada desde `chore/stabilize-build`)

## HEAD
`de6f6d3199940c57e83e37cbe8fedc6e10bc5fed`

## ÚLTIMO COMMIT
`de6f6d3` docs: record p0 implementation notes and audit corrections

## ESTADO GENERAL
Visual Block: **0%** — acabo de empezar

## COMPLETADO
- (nada todavía en este bloque)

## EN PROGRESO
- 01 Design Foundations

## SIGUIENTE ACCIÓN EXACTA
1. Crear `src/styles/tokens.css` con tokens de color/tipografía/espaciado/sombras/radios/motion
2. Crear `components/ui/` (Button, Modal, Toast, Skeleton, EmptyState, Badge, Input)
3. Crear assets de marca en `public/brand/`
4. Splash + loaders
5. Rediseñar Landing

---

## CHECKPOINTS

| Sección | Estado |
|---|---|
| 01 Design Foundations | ⬜ NO INICIADO |
| 02 Brand assets | ⬜ NO INICIADO |
| 03 Splash + loaders | ⬜ NO INICIADO |
| 04 LANDING | ⬜ NO INICIADO |
| 05 Login | ⬜ NO INICIADO |
| 06 Registro | ⬜ NO INICIADO |
| 07 Confirmación | ⬜ NO INICIADO |
| 08 Recuperar contraseña | ⬜ NO INICIADO |
| 09 APP SHELL | ⬜ NO INICIADO |
| 10 DASHBOARD | ⬜ NO INICIADO |
| 11 Crear | ⬜ NO INICIADO |
| 12 Sesiones | ⬜ NO INICIADO |
| 13 Herramientas | ⬜ NO INICIADO |
| 14 Biblioteca | ⬜ NO INICIADO |
| 15 Mi cuenta | ⬜ NO INICIADO |
| 16 Capacitación | ⬜ NO INICIADO |
| 17 Planes | ⬜ NO INICIADO |
| 18 Modales/Toasts/Empty | ⬜ NO INICIADO |
| 19 Responsive | ⬜ NO INICIADO |
| 20 Accessibility | ⬜ NO INICIADO |

---

## CONTEXTO CRÍTICO HEREDADO — NO ROMPER

El bloque anterior (P0) implementó y probó lo siguiente. **No revertir, no mockear, no duplicar:**

| Elemento | Dónde | Qué hace |
|---|---|---|
| `api/_lib/errors.js` | backend | Errores tipados en español, sin filtrar detalle técnico |
| `api/_lib/supabase.js` | backend | `requireUser`, `callRpc`, config unificada |
| `api/_lib/gemini.js` | backend | Modelo centralizado + timeout. **NO tocar el modelo** |
| `api/_lib/credits.js` | backend | `withCredit` — 1 sesión = 1 crédito, refund automático |
| `api/_lib/rate-limit.js` | backend | Límites por instancia |
| `useMaterialSave` | `App.jsx` | Hook de guardado con estado + reintento |
| `SaveStatus` | `App.jsx` | Indicador Guardando/Guardado/Error + Reintentar + Descargar |
| `describeSaveError` | `App.jsx` | Traduce errores de Postgres a español |
| `CreditsIndicator` | `components/` | Conectado en sidebar y Mi cuenta |
| Lazy loading biblioteca | `App.jsx` | `withContent()`, `openMaterial()`, `downloadMaterial()` |
| Resend confirmación | `AuthGate.jsx` | **YA IMPLEMENTADO Y FUNCIONAL** con cuenta atrás de 60s |
| Admin `Authorization` | `AdminPanel.jsx` + `api/list-docentes.js` | Bearer, no query string |

> ⚠️ El prompt visual sugiere mockear "reenviar correo" — **NO hacerlo**: ya funciona de verdad desde el bloque P0.

### Pendientes de backend (NO resolver en este bloque)
1. `supabase/migrations/001_material_types.sql` — no ejecutada. Mientras tanto, **los retos grupales no se guardan**.
2. `ADMIN_SECRET` — pendiente de rotar en Vercel.

---

## LANDING
estado: ⬜ NO INICIADO
archivos: `App.jsx` (`ImprovedLanding`)
pendiente: todo

## AUTH
estado: ⬜ NO INICIADO
archivos: `AuthGate.jsx`
pendiente: todo. **Conservar `resendConfirmation()` funcional**

## APP SHELL
estado: ⬜ NO INICIADO
archivos: `App.jsx` (`SciVerseApp`)
pendiente: todo

## DASHBOARD
estado: ⬜ NO INICIADO
pendiente: todo

## CREAR
estado: ⬜ NO INICIADO
pendiente: todo

## SESIONES
estado: ⬜ NO INICIADO
pendiente: todo

## BIBLIOTECA
estado: ⬜ NO INICIADO
pendiente: todo. **Conservar carga perezosa**

## CUENTA
estado: ⬜ NO INICIADO
pendiente: todo

## CAPACITACIÓN
estado: ⬜ NO INICIADO
pendiente: todo

## PLANES
estado: ⬜ NO INICIADO
pendiente: sección `#planes` visible. **No inventar precios**

## RESPONSIVE
estado: ⬜ NO INICIADO

## ACCESIBILIDAD
estado: 🟡 PARCIAL — `:focus-visible` global ya existe (bloque P0)

## ASSETS CREADOS
- `public/mascot/kantu-material.webp` (27 KB) — heredado
- `public/mascot/kantu-session.webp` (29 KB) — heredado

## COMPONENTES NUEVOS
- (ninguno todavía)

## COMPONENTES MODIFICADOS
- (ninguno todavía)

## DECISIONES DE DISEÑO
- (pendiente)

## FUNCIONES REALES PRESERVADAS
- Ver tabla "CONTEXTO CRÍTICO HEREDADO"

## FUNCIONES MOCKEADAS
- (ninguna todavía)

## BUGS ENCONTRADOS
### P0
- (ninguno nuevo)
### P1
### P2
### P3

## BUILD
último resultado: ✅ `npm run build` exit 0 (heredado)

## PRUEBAS REALIZADAS
- 22 tests P0 pasan (heredado)

## PRUEBAS PENDIENTES
- Re-ejecutar tras cada bloque visual

## GIT STATUS
```
On branch feat/visual-overhaul
nothing to commit, working tree clean
```

## ARCHIVOS SIN COMMIT
- ninguno

## NO HACER TODAVÍA
- push / merge / deploy
- SQL en producción
- refactor de Gemini o créditos
- eliminar `api/_lib/`
- reintroducir el codemod
- mega-refactor de `App.jsx`

## COMANDO / ACCIÓN PARA CONTINUAR
```bash
git switch feat/visual-overhaul
cat docs/CONTINUATION.md
```
Continuar por "SIGUIENTE ACCIÓN EXACTA".
