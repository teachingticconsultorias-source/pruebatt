# SCIVERSE V2 — CONTINUATION STATE

## ÚLTIMA ACTUALIZACIÓN
2026-09-03 · fin de sesión del Bloque Visual 01

## OBJETIVO ACTUAL
Bloque Visual 01. **Siguiente: 11 Crear · 14 Biblioteca** (por ese orden).

## RAMA
`feat/visual-overhaul`

## HEAD
`d642e67`

## ÚLTIMO COMMIT
`d642e67` feat(ui): connect generation progress and replace native dialogs

## ESTADO GENERAL
Visual Block: **~55%**

---

## CHECKPOINTS

| Sección | Estado |
|---|---|
| 01 Design Foundations | 🟢 TERMINADO |
| 02 Brand assets | 🟢 TERMINADO |
| 03 Splash + loaders | 🟢 TERMINADO (Splash en AuthGate, GenerationProgress conectado) |
| 04 LANDING | 🟢 TERMINADO |
| 05 Login | 🟢 TERMINADO |
| 06 Registro | 🟢 TERMINADO |
| 07 Confirmación | 🟢 TERMINADO |
| 08 Recuperar contraseña | 🟢 TERMINADO |
| 09 APP SHELL | 🟢 TERMINADO |
| 10 DASHBOARD | 🟢 TERMINADO |
| 11 Crear | ⬜ NO INICIADO ← **SIGUIENTE** |
| 12 Sesiones | 🟡 PARCIAL (solo el progreso de generación) |
| 13 Herramientas | ⬜ NO INICIADO |
| 14 Biblioteca | ⬜ NO INICIADO ← **SEGUNDA PRIORIDAD** |
| 15 Mi cuenta | 🟡 PARCIAL (créditos reales + initialTab) |
| 16 Capacitación | ⬜ NO INICIADO |
| 17 Planes | 🟢 TERMINADO (sección #planes en landing) |
| 18 Modales/Toasts/Empty | 🟢 TERMINADO (sistema listo y aplicado; falta extenderlo a Crear/Biblioteca) |
| 19 Responsive | 🟡 Landing, Auth, Shell y Dashboard sí; secciones internas pendientes |
| 20 Accessibility | 🟡 Base sólida; falta pase en secciones internas |

---

## SIGUIENTE ACCIÓN EXACTA

1. **CREAR (`CreateStudio` en `App.jsx`, buscar `const catalog=`)**
   Rediseñar el catálogo con los componentes nuevos: `Badge` para estados
   (Disponible / Nuevo), tarjetas con la estética de `.dash__quickcard`.
   Añadir "Sesión de aprendizaje" y "Clase completa" al catálogo — hoy solo
   se alcanzan desde el dashboard vía `initialCreation`.
   Crear `components/create/create.css`.

2. **BIBLIOTECA (`activeSection === "biblioteca"` en `App.jsx`)**
   Barra de filtros con chips, `SkeletonGrid` mientras carga, `EmptyState`
   con `/illustrations/empty-search.svg` cuando no hay resultados.
   **CONSERVAR** `withContent` / `openMaterial` / `downloadMaterial`.
   Corregir `materialTypeLabel`: mapea 5 de 9 tipos; faltan worksheet,
   reading, rating_scale, observation_guide.

3. **HERRAMIENTAS + CAPACITACIÓN**: usar `EmptyState` y `openComingSoon()`.

4. Tras cada sección: `npm test && npm run build` y commit.

---

## CONTEXTO CRÍTICO HEREDADO — NO ROMPER

| Elemento | Dónde | Estado |
|---|---|---|
| `api/_lib/*` | backend | intacto |
| `withCredit` — 1 sesión = 1 crédito + refund | `api/_lib/credits.js` | intacto |
| `useMaterialSave` / `SaveStatus` / `describeSaveError` | `App.jsx` | intacto y en uso |
| `CreditsIndicator` | `components/CreditsIndicator.jsx` | en sidebar, topbar, hoja móvil y Mi cuenta |
| `withContent` / `openMaterial` / `downloadMaterial` | `App.jsx` | intacto |
| `resendConfirmation()` con cuenta atrás | `AuthGate.jsx` | **FUNCIONA — no mockear** |
| Admin `Authorization: Bearer` | `AdminPanel.jsx`, `api/list-docentes.js` | intacto |
| Modelo Gemini centralizado | `api/_lib/gemini.js` | **no tocar** |

### Pendientes de backend (NO resolver en el bloque visual)
1. `supabase/migrations/001_material_types.sql` sin ejecutar → los retos grupales no se guardan.
2. `ADMIN_SECRET` pendiente de rotar en Vercel.

---

## SECCIONES

## LANDING — 🟢
archivos: `components/landing/Landing.jsx` · `landing.css` · `config/plans.js`

## AUTH — 🟢
archivos: `AuthGate.jsx` · `components/auth/auth.css`. Lógica intacta (8 llamadas `supabase.auth.*`).

## APP SHELL — 🟢
archivos: `components/layout/AppShell.jsx` · `appshell.css`

## DASHBOARD — 🟢
archivos: `components/dashboard/Dashboard.jsx` · `dashboard.css`

## CREAR — ⬜
`CreateStudio` en `App.jsx` (~línea 2990, objeto `catalog`). 4 categorías.
Falta: estética nueva + añadir "Sesión" y "Clase completa" al catálogo.

## SESIONES — 🟡
`SteamGenerator`. `GenerationProgress` ya conectado. Falta rediseñar el asistente de 3 pasos.

## BIBLIOTECA — ⬜
`activeSection === "biblioteca"`. Falta todo el rediseño.

## CUENTA — 🟡
`TeacherAccountModal`, acepta `initialTab`. Falta rediseño de las 5 pestañas.

## CAPACITACIÓN — ⬜
Pestaña dentro de `TeacherAccountModal`.

## PLANES — 🟢
Sección `#planes` en la landing. Fuente única `config/plans.js` con TODO de precio comercial.

## RESPONSIVE — 🟡
Verificado en CSS mobile-first: 375 / 430 / 768 / 1024 / 1280 / 1440 / 1920.
Landing, Auth, Shell y Dashboard cubiertos. Pendiente: Crear, Biblioteca, Sesiones, Cuenta.

## ACCESIBILIDAD — 🟡
hecho: `:focus-visible` global · Modal con Escape + trampa de foco + devolución ·
"Saltar al contenido" · `aria-expanded` en FAQ, menú y hoja móvil · `aria-pressed`
en nivel · `aria-current` en navegación · `role="alert"` en errores ·
`prefers-reduced-motion` en tokens · táctiles de 52px en nav móvil ·
0 `window.alert`/`confirm`.
pendiente: pase en Crear, Biblioteca, Sesiones y Cuenta.

---

## ASSETS CREADOS
| Archivo | Peso | Uso |
|---|---|---|
| `public/brand/isotipo.svg` | 921 b | Marca, nav, splash, shell |
| `public/brand/favicon.svg` | 551 b | Pestaña del navegador |
| `public/brand/logo.svg` | 923 b | Lockup horizontal |
| `public/brand/isotipo-white.svg` | 346 b | Panel oscuro de auth |
| `public/brand/og-image.svg` | 1,3 KB | Previsualización al compartir |
| `public/illustrations/empty-library.svg` | 1,0 KB | Biblioteca vacía (dashboard) |
| `public/illustrations/empty-search.svg` | 574 b | Sin resultados (pendiente de usar) |
| `public/illustrations/mail-sent.svg` | 718 b | Confirmación de correo |
| `public/illustrations/empty-generic.svg` | 695 b | Genérico (pendiente de usar) |
| `public/backgrounds/mesh-soft.svg` | 922 b | Fondo suave (pendiente de usar) |

## COMPONENTES NUEVOS
| Archivo | Responsabilidad |
|---|---|
| `styles/tokens.css` | Tokens de diseño |
| `components/ui/Button.jsx` | 7 variantes × 3 tamaños, con loading |
| `components/ui/Modal.jsx` | Modal accesible completo |
| `components/ui/UIProvider.jsx` | Toasts + `openComingSoon()` + `confirm()` |
| `components/ui/Feedback.jsx` | Skeleton, SkeletonGrid, Spinner, EmptyState, Badge, Alert |
| `components/ui/Splash.jsx` | Pantalla inicial |
| `components/ui/GenerationProgress.jsx` | Pasos reales de generación |
| `components/ui/ui.css` | Estilos del sistema |
| `components/landing/Landing.jsx` + `.css` | Landing |
| `components/auth/auth.css` | Autenticación |
| `components/layout/AppShell.jsx` + `.css` | Shell |
| `components/dashboard/Dashboard.jsx` + `.css` | Home docente |
| `config/plans.js` | Fuente única de planes |

## COMPONENTES MODIFICADOS
- `main.jsx` · `index.html` · `App.jsx` · `AuthGate.jsx` · `AdminPanel.jsx` (heredado)

## DECISIONES DE DISEÑO
- teal-400 = marca, **no texto**. Texto y botones sólidos: teal-700 (5.4:1).
- Mínimo tipográfico **12px** (antes 157 reglas con 7-10px).
- Coral y ámbar solo como acento.
- Testimonios inventados **retirados** (riesgo de veracidad).
- Vista previa del producto **dibujada en el DOM**, no captura.
- Precios **en la página**, no en modal.
- Modal en móvil = hoja inferior.
- Progreso de IA con **pasos reales**, nunca porcentajes inventados.

## FUNCIONES REALES PRESERVADAS
Todas las de la tabla heredada. Verificado tras cada commit: 22/22 tests P0.

## FUNCIONES MOCKEADAS
| Función | Comportamiento | Backend pendiente |
|---|---|---|
| Términos y condiciones | `openComingSoon()` + ofrecer por WhatsApp | Página con URL |
| Política de privacidad | ídem | ídem |
| Política de uso de IA | ídem | ídem |
| Libro de Reclamaciones | `openComingSoon()` explicando que se habilitará | Página con enlace permanente |

Ninguna función existente fue sustituida por un mock.

## BUGS ENCONTRADOS
### P0
- ninguno nuevo
### P1
- **Build sin variables de entorno elimina toda la lógica de Supabase.**
  `supabaseClient.js` resuelve a `null` en compilación y Rollup borra como
  código muerto todo lo protegido por `if (!supabase)`. La app se pinta pero
  no autentica, sin aviso. Verificado sin/con `.env.local`. **Preexistente.**
  → Mitigación sugerida: fallar el build si faltan las variables, o avisar en consola.
### P2
- `ImprovedLanding` y `RegistrationGate` quedan como código muerto en `App.jsx`.
- El componente `Usage` quedó sin uso.
- `materialTypeLabel` mapea 5 de 9 tipos.
### P3
- `credit-widget.css`, `library.css` e `index.css` aún no usan los tokens.
- Bundle sin dividir (~800 KB); code splitting es Bloque C.

## BUILD
`npm run build` exit 0 · reejecutable · **no muta el código fuente**.
Bundle: ~800 KB JS · ~190 KB CSS.

## PRUEBAS REALIZADAS
- 22 tests P0 tras **cada** commit: pasan.
- Build limpio tras Foundations, Landing, Auth, Shell/Dashboard y UI.
- Verificación de cadenas clave en el bundle compilado.

## PRUEBAS PENDIENTES
- Recorrido visual en navegador real (no hay automatización disponible).
- Responsive medido en dispositivos.
- Flujo de auth contra Supabase real.

## GIT STATUS
```
On branch feat/visual-overhaul
nothing to commit, working tree clean
```

## ARCHIVOS SIN COMMIT
- ninguno

## NO HACER TODAVÍA
- push / merge / deploy · SQL en producción · rotar ADMIN_SECRET
- refactor de Gemini, créditos o auth backend · eliminar `api/_lib/`
- reintroducir el codemod · mega-refactor de `App.jsx`

## COMANDO / ACCIÓN PARA CONTINUAR
```bash
git switch feat/visual-overhaul
cat docs/CONTINUATION.md
npm test && npm run build
```
Continuar por **SIGUIENTE ACCIÓN EXACTA** (Crear → Biblioteca).
