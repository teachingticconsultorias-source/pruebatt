# SCIVERSE V2 — CONTINUATION STATE

## ÚLTIMA ACTUALIZACIÓN
2026-09-03 · tras completar Landing y Auth

## OBJETIVO ACTUAL
Bloque Visual 01. Siguiente: **App Shell + Dashboard**.

## RAMA
`feat/visual-overhaul`

## HEAD
`9ca94d8`

## ÚLTIMO COMMIT
`9ca94d8` feat(auth): redesign authentication experience

## ESTADO GENERAL
Visual Block: **~35%**

---

## CHECKPOINTS

| Sección | Estado |
|---|---|
| 01 Design Foundations | 🟢 TERMINADO |
| 02 Brand assets | 🟢 TERMINADO |
| 03 Splash + loaders | 🟢 TERMINADO (Splash y GenerationProgress creados; GenerationProgress **aún sin conectar**) |
| 04 LANDING | 🟢 TERMINADO |
| 05 Login | 🟢 TERMINADO |
| 06 Registro | 🟢 TERMINADO |
| 07 Confirmación | 🟢 TERMINADO |
| 08 Recuperar contraseña | 🟢 TERMINADO |
| 09 APP SHELL | ⬜ NO INICIADO ← **SIGUIENTE** |
| 10 DASHBOARD | ⬜ NO INICIADO |
| 11 Crear | ⬜ NO INICIADO |
| 12 Sesiones | ⬜ NO INICIADO |
| 13 Herramientas | ⬜ NO INICIADO |
| 14 Biblioteca | ⬜ NO INICIADO |
| 15 Mi cuenta | ⬜ NO INICIADO |
| 16 Capacitación | ⬜ NO INICIADO |
| 17 Planes | 🟢 TERMINADO (sección #planes en landing) |
| 18 Modales/Toasts/Empty | 🟡 Componentes listos; falta aplicarlos dentro de la app |
| 19 Responsive | 🟡 Landing y Auth sí; app pendiente |
| 20 Accessibility | 🟡 focus-visible, Modal accesible, aria en landing/auth |

---

## SIGUIENTE ACCIÓN EXACTA

1. Crear `components/layout/AppShell.jsx` + `appshell.css`: sidebar de escritorio
   (grupos Inicio / CREAR / ORGANIZAR / APRENDER / CUENTA), topbar con migas y
   `CreditsIndicator`, y navegación inferior en móvil con pestaña "Más".
2. Sustituir en `App.jsx` el bloque `<aside className="teacher-sidebar">` +
   `<nav className="teacher-topbar">` + `<nav className="teacher-mobile-nav">`
   (están dentro de `SciVerseApp`, buscar por esas clases) por `<AppShell>`.
3. Rediseñar el dashboard (`activeSection === "inicio"`): saludo, **continuar
   donde lo dejaste** usando `teacherMaterials[0]`, acciones rápidas,
   materiales recientes y créditos. La consulta ya existe: `loadTeacherMaterials`.
4. Conectar `GenerationProgress` en `SteamGenerator` usando el estado REAL que
   ya existe (`activeModule`, `completedModules`, `moduleLabels`).
5. `npm test && npm run build` y commit.

---

## CONTEXTO CRÍTICO HEREDADO — NO ROMPER

| Elemento | Dónde | Estado |
|---|---|---|
| `api/_lib/*` (errors, supabase, gemini, credits, rate-limit) | backend | intacto |
| `withCredit` — 1 sesión = 1 crédito + refund | `api/_lib/credits.js` | intacto |
| `useMaterialSave` / `SaveStatus` / `describeSaveError` | `App.jsx` | intacto |
| `CreditsIndicator` | `components/CreditsIndicator.jsx` | conectado en sidebar y Mi cuenta |
| Lazy loading biblioteca (`withContent`, `openMaterial`, `downloadMaterial`) | `App.jsx` | intacto |
| `resendConfirmation()` con cuenta atrás | `AuthGate.jsx` | **FUNCIONA DE VERDAD — no mockear** |
| Admin `Authorization: Bearer` | `AdminPanel.jsx`, `api/list-docentes.js` | intacto |
| Modelo Gemini centralizado | `api/_lib/gemini.js` | **no tocar** |

### Pendientes de backend (NO resolver en el bloque visual)
1. `supabase/migrations/001_material_types.sql` sin ejecutar → los retos grupales no se guardan.
2. `ADMIN_SECRET` pendiente de rotar en Vercel.

---

## LANDING
estado: 🟢 TERMINADO
archivos: `components/landing/Landing.jsx`, `components/landing/landing.css`, `config/plans.js`
pendiente: nada crítico. Opcional: demo interactiva real.

## AUTH
estado: 🟢 TERMINADO
archivos: `AuthGate.jsx`, `components/auth/auth.css`
pendiente: nada. Lógica preservada íntegra.

## APP SHELL
estado: ⬜ NO INICIADO
archivos objetivo: `components/layout/AppShell.jsx` (**PROPUESTO**)
pendiente: todo. En `App.jsx` buscar `teacher-sidebar`, `teacher-topbar`, `teacher-mobile-nav`.

## DASHBOARD
estado: ⬜ NO INICIADO
pendiente: `activeSection === "inicio"` dentro de `SciVerseApp`. Falta "continuar donde lo dejaste".

## CREAR
estado: ⬜ NO INICIADO
nota: el catálogo vive en `CreateStudio` (objeto `catalog`, 4 categorías). El crucigrama ya fue retirado.

## SESIONES
estado: ⬜ NO INICIADO
nota: `SteamGenerator`. Conectar `GenerationProgress` con `activeModule`/`completedModules`.

## BIBLIOTECA
estado: ⬜ NO INICIADO
nota: **conservar** `withContent` / `openMaterial` / `downloadMaterial`.

## CUENTA · CAPACITACIÓN
estado: ⬜ NO INICIADO
nota: en `TeacherAccountModal`. Ya usa `CreditsIndicator` real.

## PLANES
estado: 🟢 TERMINADO en landing. Fuente única en `config/plans.js` con TODO de precio comercial.

## RESPONSIVE
estado: 🟡 Landing y Auth verificados en CSS mobile-first (breakpoints 640/768/1024/1280). App pendiente.

## ACCESIBILIDAD
estado: 🟡
hecho: `:focus-visible` global, Modal con Escape + trampa de foco + devolución,
`aria-expanded` en FAQ y menú, `aria-pressed` en nivel, `role="alert"` en errores,
`prefers-reduced-motion` en tokens, objetivos táctiles de 44px en nav móvil.
pendiente: pase completo sobre la app autenticada.

---

## ASSETS CREADOS
| Archivo | Uso |
|---|---|
| `public/brand/isotipo.svg` (921 b) | Marca, nav, splash |
| `public/brand/favicon.svg` (551 b) | Pestaña del navegador |
| `public/brand/logo.svg` (923 b) | Lockup horizontal |
| `public/brand/isotipo-white.svg` (346 b) | Fondos oscuros (auth) |
| `public/brand/og-image.svg` (1,3 KB) | Previsualización al compartir |
| `public/illustrations/empty-library.svg` (1,0 KB) | Biblioteca vacía |
| `public/illustrations/empty-search.svg` (574 b) | Sin resultados |
| `public/illustrations/mail-sent.svg` (718 b) | Confirmación de correo |
| `public/illustrations/empty-generic.svg` (695 b) | Estado vacío genérico |
| `public/backgrounds/mesh-soft.svg` (922 b) | Fondo suave |
| `public/mascot/kantu-*.webp` (56 KB) | Heredado del bloque P0 |

## COMPONENTES NUEVOS
| Archivo | Responsabilidad |
|---|---|
| `styles/tokens.css` | Tokens: color, tipografía, espaciado, radios, sombras, motion, z-index |
| `components/ui/Button.jsx` | 7 variantes × 3 tamaños, con estado loading |
| `components/ui/Modal.jsx` | Modal accesible: Escape, trampa de foco, devolución, hoja inferior en móvil |
| `components/ui/UIProvider.jsx` | Toasts + `openComingSoon()` + `confirm()` centralizados |
| `components/ui/Feedback.jsx` | Skeleton, SkeletonGrid, Spinner, EmptyState, Badge, Alert |
| `components/ui/Splash.jsx` | Pantalla inicial sin retardo artificial |
| `components/ui/GenerationProgress.jsx` | Pasos reales de generación (**sin conectar todavía**) |
| `components/ui/ui.css` | Estilos del sistema |
| `components/landing/Landing.jsx` + `.css` | Landing completa |
| `components/auth/auth.css` | Estilos de autenticación |
| `config/plans.js` | Fuente única de planes y contacto |

## COMPONENTES MODIFICADOS
- `main.jsx` — importa tokens + ui.css, envuelve en `UIProvider`
- `index.html` — metadatos, Open Graph, favicon, preconnect
- `App.jsx` — monta `Landing`, importa `config/plans.js`, retirado `PLANS` duplicado (36 líneas)
- `AuthGate.jsx` — render nuevo, lógica intacta

## DECISIONES DE DISEÑO
- **teal-400 es color de marca, no de texto** (2.1:1 sobre blanco). Texto y botones sólidos usan teal-700 (5.4:1).
- **Mínimo tipográfico 12px.** Antes había 157 reglas con texto de 7-10px.
- **Coral y ámbar solo como acento**, nunca dominantes.
- **Testimonios inventados retirados** de la landing (riesgo de veracidad). Sustituidos por herramientas y ejemplo de salida verificables.
- **Vista previa del producto dibujada en el DOM**, no captura: la interfaz está cambiando.
- **Precios visibles en la página**, no en modal, por SEO y conversión.
- Modal en móvil como hoja inferior.

## FUNCIONES REALES PRESERVADAS
Todas las de la tabla "CONTEXTO CRÍTICO HEREDADO". Verificado: `AuthGate.jsx`
mantiene las 8 llamadas a `supabase.auth.*` y los 22 tests P0 pasan.

## FUNCIONES MOCKEADAS
| Función | Por qué | Comportamiento actual | Backend pendiente |
|---|---|---|---|
| Términos y condiciones | Sin página propia con URL | `openComingSoon()` + ofrecer el documento por WhatsApp | Página legal con ruta |
| Política de privacidad | ídem | ídem | ídem |
| Política de uso de IA | ídem | ídem | ídem |
| Libro de Reclamaciones | Obligación legal peruana, sin página | `openComingSoon()` explicando que se habilitará | Página con enlace permanente |

Ninguna función que ya existía ha sido sustituida por un mock.

## BUGS ENCONTRADOS
### P0
- ninguno nuevo
### P1
- **Build sin variables de entorno elimina toda la lógica de Supabase.**
  `supabaseClient.js` resuelve a `null` en tiempo de compilación y Rollup borra
  como código muerto todo lo protegido por `if (!supabase)`. La app se pinta
  pero no autentica, sin aviso. Verificado sin/con `.env.local`.
  Preexistente, no introducido en este bloque.
### P2
- `ImprovedLanding` (landing anterior) queda como código muerto en `App.jsx`.
  Retirar en el Bloque C junto al resto de código muerto.
- El componente `Usage` quedó sin uso al conectar los créditos reales.
### P3
- `credit-widget.css` conserva estilos propios que aún no usan los tokens.

## BUILD
`npm run build` exit 0 · reejecutable · no muta el código fuente.
Bundle: ~781 KB JS · ~184 KB CSS (sin dividir todavía; code splitting es Bloque C).

## PRUEBAS REALIZADAS
- 22 tests P0: **pasan** tras cada cambio.
- Build limpio tras Foundations, Landing y Auth.
- Verificación de cadenas clave en el bundle compilado.

## PRUEBAS PENDIENTES
- Recorrido visual real en navegador (no hay automatización disponible).
- Responsive medido en dispositivos reales.
- Flujo completo de auth contra Supabase (requiere entorno conectado).

## GIT STATUS
```
On branch feat/visual-overhaul
nothing to commit, working tree clean
```

## ARCHIVOS SIN COMMIT
- ninguno

## NO HACER TODAVÍA
- push / merge / deploy
- SQL en producción · rotar ADMIN_SECRET
- refactor de Gemini, créditos o auth backend
- eliminar `api/_lib/`
- reintroducir el codemod
- mega-refactor de `App.jsx` (solo extracción progresiva)

## COMANDO / ACCIÓN PARA CONTINUAR
```bash
git switch feat/visual-overhaul
cat docs/CONTINUATION.md
npm test && npm run build
```
Continuar por **SIGUIENTE ACCIÓN EXACTA**.
