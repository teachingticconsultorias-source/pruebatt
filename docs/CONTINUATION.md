# SCIVERSE V2 — CONTINUATION STATE

## ÚLTIMA ACTUALIZACIÓN
2026-09-04 · fin del Bloque Visual 02

## OBJETIVO ACTUAL
Bloque Visual. **Siguiente: 12 Sesiones (asistente) · 13 Herramientas (vista propia) · verificación visual en navegador.**

## RAMA
`feat/visual-overhaul`

## HEAD
`7938fb3`

## ÚLTIMO COMMIT
`7938fb3` fix(ui): enforce 12px typographic floor across legacy styles

## ESTADO GENERAL
Visual Block: **~85%**

---

## CHECKPOINTS

| Sección | Estado |
|---|---|
| 01 Design Foundations | 🟢 TERMINADO |
| 02 Brand assets | 🟢 TERMINADO |
| 03 Splash + loaders | 🟢 TERMINADO |
| 04 LANDING | 🟢 TERMINADO |
| 05 Login | 🟢 TERMINADO |
| 06 Registro | 🟢 TERMINADO |
| 07 Confirmación | 🟢 TERMINADO |
| 08 Recuperar contraseña | 🟢 TERMINADO |
| 09 APP SHELL | 🟢 TERMINADO |
| 10 DASHBOARD | 🟢 TERMINADO |
| 11 CREAR | 🟢 TERMINADO |
| 12 Sesiones | 🟡 PARCIAL — falta el asistente de 3 pasos |
| 13 Herramientas | 🟡 PARCIAL — `ToolGrid` listo y usado en Crear; falta vista propia |
| 14 BIBLIOTECA | 🟢 TERMINADO |
| 15 Mi cuenta | 🟢 TERMINADO |
| 16 Capacitación | 🟢 TERMINADO |
| 17 Planes | 🟢 TERMINADO |
| 18 Modales/Toasts/Empty | 🟢 TERMINADO |
| 19 Responsive | 🟡 Verificado por CSS; falta comprobación en navegador |
| 20 Accessibility | 🟡 Base completa; falta pase en generadores |
| 21 Consistencia | 🟡 Suelo de 12px aplicado; falta migrar `index.css` a tokens |
| BUILD GUARD | 🟢 TERMINADO |

---

## SIGUIENTE ACCIÓN EXACTA

1. **SESIONES — asistente** (`SteamGenerator` en `App.jsx`, ~línea 1000).
   Agrupar los campos en bloques lógicos (Contexto · Propósito · Competencia ·
   Revisión) con `wizard-card`. Aplicar la barra `.studio__sticky` que ya
   existe en `components/create/create.css` para el botón "Crear con Kantu".
   **NO tocar** `handleGenerate`, prompts ni créditos.

2. **HERRAMIENTAS — vista propia.** Añadir `activeSection === "herramientas"`
   en `App.jsx` que renderice `<ToolGrid>` con el mismo catálogo, más una
   entrada en `NAV_GROUPS` de `components/layout/AppShell.jsx`.

3. **VERIFICACIÓN VISUAL EN NAVEGADOR** (importante, ver bugs P2 abajo):
   `npm run preview` y revisar 375 / 768 / 1024 / 1440, con especial atención
   al catálogo de actividades y a los asistentes de generación, cuyos estilos
   heredados subieron de 7-9px a 12px y pueden quedar apretados.

4. Migrar `index.css` a tokens (última fuente de literales de color).

---

## CONTEXTO CRÍTICO HEREDADO — NO ROMPER

| Elemento | Dónde | Estado |
|---|---|---|
| `api/_lib/*` | backend | intacto |
| `withCredit` — 1 sesión = 1 crédito + refund | `api/_lib/credits.js` | intacto |
| `useMaterialSave` / `SaveStatus` / `describeSaveError` | `App.jsx` | intacto y en uso |
| `CreditsIndicator` | `components/CreditsIndicator.jsx` | sidebar, topbar, hoja móvil y Mi cuenta |
| `withContent` / `openMaterial` / `downloadMaterial` | `App.jsx` | intacto; el listado sigue sin `contenido` |
| `resendConfirmation()` | `AuthGate.jsx` | **FUNCIONA — no mockear** |
| `supabase.auth.updateUser` en perfil | `App.jsx` `TeacherAccountModal` | intacto |
| Admin `Authorization: Bearer` | `AdminPanel.jsx`, `api/list-docentes.js` | intacto |
| Modelo Gemini centralizado | `api/_lib/gemini.js` | **no tocar** |

### Pendientes de backend (NO resolver en el bloque visual)
1. `supabase/migrations/001_material_types.sql` sin ejecutar → los retos grupales no se guardan.
2. `ADMIN_SECRET` pendiente de rotar en Vercel.

---

## SECCIONES

## LANDING — 🟢 · `components/landing/Landing.jsx` + `.css` · `config/plans.js`
## AUTH — 🟢 · `AuthGate.jsx` + `components/auth/auth.css`
## APP SHELL — 🟢 · `components/layout/AppShell.jsx` + `.css`
## DASHBOARD — 🟢 · `components/dashboard/Dashboard.jsx` + `.css`
## CREAR — 🟢 · `components/create/ToolGrid.jsx` + `create.css` · `config/tools.js`
Catálogo plano por intención. "Sesión" y "Clase completa" YA están dentro.
## SESIONES — 🟡 · `SteamGenerator` en `App.jsx`. `GenerationProgress` conectado; falta el asistente.
## HERRAMIENTAS — 🟡 · `ToolGrid` reutilizable listo; falta la sección propia.
## BIBLIOTECA — 🟢 · `components/library/Library.jsx` + `library-v2.css`
## CUENTA / CAPACITACIÓN — 🟢 · `components/account/Account.jsx` + `account.css`
## PLANES — 🟢 · sección `#planes` + pestaña Plan. `config/plans.js` con TODO de precio comercial.

## RESPONSIVE
Breakpoints unificados: 640 · 768 · 1024 · 1280 · 1440.
Cubiertos por CSS: Landing, Auth, Shell, Dashboard, Crear, Biblioteca, Cuenta, Modales.
**Pendiente:** comprobación real en navegador y los asistentes de generación.

## ACCESIBILIDAD
hecho: `:focus-visible` global · Modal con Escape + trampa de foco + devolución ·
"Saltar al contenido" · `aria-expanded` / `aria-pressed` / `aria-current` / `aria-selected` ·
`role="alert"` y `role="status"` · `aria-live` en toasts y progreso ·
`prefers-reduced-motion` · táctiles de 40-52px · **0 `window.alert`/`confirm`** ·
**0 reglas CSS con texto <12px**.
pendiente: pase en los asistentes de generación.

---

## ASSETS
| Archivo | Peso | Uso |
|---|---|---|
| `public/brand/isotipo.svg` | 921 b | nav, shell, splash, footer |
| `public/brand/favicon.svg` | 551 b | pestaña |
| `public/brand/logo.svg` | 923 b | lockup (sin usar todavía) |
| `public/brand/isotipo-white.svg` | 346 b | panel oscuro de auth |
| `public/brand/og-image.svg` | 1,3 KB | compartir enlace |
| `public/illustrations/empty-library.svg` | 1,0 KB | biblioteca vacía · dashboard |
| `public/illustrations/empty-search.svg` | 574 b | sin resultados en biblioteca |
| `public/illustrations/mail-sent.svg` | 718 b | confirmación de correo |
| `public/illustrations/empty-generic.svg` | 695 b | guardados vacíos |
| `public/backgrounds/mesh-soft.svg` | 922 b | **SIN USAR** — evaluar o eliminar |
| `public/mascot/kantu-*.webp` | 56 KB | heredado |

## COMPONENTES NUEVOS (bloque 02)
| Archivo | Responsabilidad |
|---|---|
| `config/tools.js` | Catálogo único de herramientas con estado real |
| `components/create/ToolGrid.jsx` | Rejilla compartida Crear ↔ Herramientas |
| `components/create/create.css` | Estudio + barra sticky |
| `components/library/Library.jsx` | Biblioteca con chips derivados y `MATERIAL_TYPES` |
| `components/library/library-v2.css` | Estilos de biblioteca |
| `components/account/Account.jsx` | Cuenta con 5 pestañas |
| `components/account/account.css` | Estilos de cuenta |
| `scripts/check-env.mjs` | Guard de variables de entorno |

## DECISIONES DE DISEÑO
- Catálogo de Crear **plano por intención**, no drill-down de dos niveles.
- Un solo `ToolGrid` para Crear y Herramientas: evita dos sistemas visuales.
- Chips de biblioteca **derivados de los datos reales**, no lista fija.
- Suelo tipográfico de 12px aplicado también al CSS heredado.
- "Referidos" retirado: era una función simulada (enlace `?ref=` que nadie lee).
- Capacitación con estado vacío honesto: no se inventan cursos ni fechas.

## FUNCIONES MOCKEADAS
| Función | Comportamiento | Backend pendiente |
|---|---|---|
| Términos / Privacidad / Uso de IA | `openComingSoon()` + ofrecer por WhatsApp | Páginas con URL |
| Libro de Reclamaciones | `openComingSoon()` | Página con enlace permanente |
| Unidad de aprendizaje | `openComingSoon()` en el catálogo | Generador real |
| Cambiar contraseña desde la cuenta | `openComingSoon()`, indicando que "¿Olvidaste tu contraseña?" SÍ funciona | Flujo en cuenta |
| Descargar mis datos | `openComingSoon()` | Exportación |
| Eliminar mi cuenta | `openComingSoon()` + hacerlo por WhatsApp | Borrado en cascada |
| Integraciones Drive/Canva | Badge "Próximamente" | OAuth |

Ninguna función existente fue sustituida por un mock.

## BUGS ENCONTRADOS
### P0
- ninguno nuevo
### P1
- ~~Build sin env elimina la lógica de Supabase~~ → **RESUELTO** con `scripts/check-env.mjs`.
### P2
- **El suelo de 12px puede apretar cajas heredadas** pensadas para 7-9px, sobre
  todo en el catálogo de actividades y los asistentes. **Requiere revisión visual.**
- `ImprovedLanding`, `RegistrationGate` y `Usage` siguen como código muerto en `App.jsx`.
- `mesh-soft.svg` creado y sin usar.
### P3
- `index.css` aún no usa tokens (última fuente de literales de color).
- Bundle sin dividir (~810 KB); code splitting corresponde al Bloque C.

## BUILD
```
npm test          22/22 ✓
npm run build     falla sin env (exit 1) — correcto
npm run build     OK con env · reejecutable · no muta fuente
```

## PRUEBAS PENDIENTES
- **Revisión visual en navegador de todas las pantallas** (prioritario tras el cambio tipográfico).
- Responsive medido en dispositivos.
- Flujo de auth contra Supabase real.

## GIT STATUS
```
On branch feat/visual-overhaul
nothing to commit, working tree clean
```

## NO HACER TODAVÍA
push · merge · deploy · SQL en producción · rotar ADMIN_SECRET ·
refactor de Gemini/créditos/auth backend · eliminar `api/_lib/` ·
reintroducir el codemod · mega-refactor de `App.jsx`

## COMANDO / ACCIÓN PARA CONTINUAR
```bash
git switch feat/visual-overhaul
cat docs/CONTINUATION.md
npm test
SCIVERSE_SKIP_ENV_CHECK=1 npm run build   # solo para comprobar compilación
```
Continuar por **SIGUIENTE ACCIÓN EXACTA**.
