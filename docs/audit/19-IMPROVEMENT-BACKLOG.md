# 19 — Backlog de mejoras

Backlog completo y accionable.

**Prioridad:** P0 crítico · P1 imprescindible · P2 importante · P3 mejora
**Impacto:** Muy alto · Alto · Medio · Bajo
**Esfuerzo:** XS < 2 h · S = medio día · M = 1-3 días · L = 1-2 semanas · XL > 2 semanas

Los archivos marcados **(PROPUESTO)** todavía no existen.

---

## P0 — Crítico

| ID | Área | Mejora | Prioridad | Impacto | Esfuerzo | Dependencias | Archivos probables |
|---|---|---|---|---|---|---|---|
| B-001 | Build | Eliminar el codemod: aplicarlo una última vez, commitear el resultado, `"build": "vite build"` | P0 | Muy alto | S | — | `package.json`, `App.jsx`, `index.css`, `api/generate-project-steam.js`, `apply-sciverse-v2.mjs` |
| B-002 | Build | Añadir `.gitattributes` con `* text=auto eol=lf` para que el build funcione en Windows | P0 | Alto | XS | — | `.gitattributes` **(PROPUESTO)** |
| B-003 | Datos | Añadir `'challenge'` al `CHECK` de `materiales_docente.tipo` | P0 | Muy alto | XS | — | `supabase/migrations/001_baseline.sql` **(PROPUESTO)** |
| B-004 | Datos | Consolidar los 4 SQL contradictorios en una migración autoritativa | P0 | Muy alto | S | B-003 | `supabase/migrations/001_baseline.sql` **(PROPUESTO)** |
| B-005 | Seguridad | Sacar `ADMIN_SECRET` de la query string; pasarlo por cabecera y **rotar el actual** | P0 | Muy alto | XS | — | `AdminPanel.jsx:23`, `api/list-docentes.js:11` |
| B-006 | Seguridad | Paginar `list-docentes` y limitar columnas (sin `celular` por defecto) | P0 | Muy alto | XS | — | `api/list-docentes.js:26` |
| B-007 | Seguridad | Limitación de intentos en `list-docentes` | P0 | Alto | S | — | `api/_lib/ratelimit.js` **(PROPUESTO)** |
| B-008 | IA | Fijar un modelo de Gemini válido y documentar `GEMINI_MAIN_MODEL` | P0 | Muy alto | XS | — | los 4 endpoints, `.env.example` |
| B-009 | IA | **Límite de presupuesto en Google Cloud** como red de seguridad | P0 | Muy alto | XS | — | consola de Google Cloud |
| B-010 | IA | Consumo de créditos en `generate-session` y `generate-project-steam` | P0 | Muy alto | M | B-001 | `api/generate-session.js`, `api/_lib/credits.js` **(PROPUESTO)** |
| B-011 | UX | Guardado visible con reintento (sustituir `catch{console.error}`) | P0 | Muy alto | S | — | `App.jsx:989`, `:1179` |
| B-012 | UX | Importar `CreditsIndicator` para que la docente vea sus créditos | P0 | Muy alto | XS | — | `App.jsx`, `components/CreditsIndicator.jsx` |
| B-013 | Rendimiento | Convertir los PNG de Kantu a WebP redimensionado (1,77 MB → <60 KB) | P0 | Muy alto | XS | — | `public/mascot/*` |
| B-014 | Producto | Retirar "Crucigrama" de producción hasta que genere una cuadrícula real | P0 | Alto | S | B-001 | `App.jsx` `CreateStudio` |
| B-015 | Datos | Sincronizar el perfil: escribir también en `docentes` al editar | P0 | Muy alto | S | — | `App.jsx:3547` |
| B-016 | Producto | Unificar precios en una fuente única | P0 | Alto | S | — | `src/config/plans.js` **(PROPUESTO)**, `App.jsx:2427`, `:3700`, `:3572` |
| B-017 | UX | Arreglar `onChoosePlan` para que elegir un plan lleve al pago | P0 | Alto | XS | — | `App.jsx:2601` |
| B-018 | Seguridad | `vercel.json` con cabeceras de seguridad | P0 | Alto | XS | — | `vercel.json` **(PROPUESTO)** |
| B-019 | Proceso | Eliminar un lockfile y fijar `packageManager` | P0 | Alto | XS | — | `package-lock.json` / `pnpm-lock.yaml`, `package.json` |
| B-020 | UI | Regla global `:focus-visible` | P0 | Alto | XS | — | `index.css` |

---

## P1 — Imprescindible

### Limpieza y proceso

| ID | Área | Mejora | Prioridad | Impacto | Esfuerzo | Dependencias | Archivos probables |
|---|---|---|---|---|---|---|---|
| B-021 | Código | Eliminar `src/` completo (2.100 líneas muertas) | P1 | Alto | XS | B-001 | `src/**`, `tailwind.config.js:3` |
| B-022 | Código | Rescatar `CreditsIndicator`; eliminar el resto de `components/` | P1 | Medio | S | B-012 | `components/**` |
| B-023 | Código | Eliminar `RegistrationGate`, `LoginModal`, `PasswordRecoveryModal`, `ResetPasswordPage` | P1 | Medio | S | B-001 | `App.jsx:2617-3298` |
| B-024 | Código | Eliminar el código inalcanzable tras `return` | P1 | Medio | XS | B-001 | `App.jsx:3078-3290` |
| B-025 | Código | Eliminar ZIP, `.txt`, `package-fallback.json`, `AnimalCellLab.jsx` | P1 | Bajo | XS | — | raíz, `docs/legacy/` **(PROPUESTO)** |
| B-026 | Proceso | Añadir ESLint + Prettier; formateo en commit aislado | P1 | Alto | S | B-001 | `.eslintrc.json`, `.prettierrc` **(PROPUESTO)** |
| B-027 | Proceso | Crear proyecto Supabase de staging | P1 | Alto | S | — | infraestructura |
| B-028 | Rendimiento | Eliminar el `@import` de fuentes duplicado y bloqueante | P1 | Medio | XS | — | `App.jsx:3643` |
| B-029 | Rendimiento | Quitar `contenido` del listado de biblioteca (1-3 MB por carga) | P1 | Alto | XS | — | `App.jsx:3606` |
| B-030 | Seguridad | Añadir respaldo `SUPABASE_URL` en `generate-session.js` | P1 | Medio | XS | — | `api/generate-session.js:198` |

### Backend y seguridad

| ID | Área | Mejora | Prioridad | Impacto | Esfuerzo | Dependencias | Archivos probables |
|---|---|---|---|---|---|---|---|
| B-031 | Backend | `api/_lib/` compartido: auth, gemini, errores, logger | P1 | Alto | M | B-001 | `api/_lib/*` **(PROPUESTO)** |
| B-032 | Backend | Limitación de tasa en todos los endpoints | P1 | Alto | M | B-031 | `api/_lib/ratelimit.js` **(PROPUESTO)** |
| B-033 | Backend | Validación por esquema de todas las entradas | P1 | Alto | M | B-031 | `api/_lib/schemas/` **(PROPUESTO)** |
| B-034 | Backend | Timeout y reintento hacia Gemini | P1 | Alto | S | B-031 | `api/_lib/gemini.js` **(PROPUESTO)** |
| B-035 | Backend | Registro estructurado con `request_id` y `user_id` | P1 | Alto | S | B-031 | `api/_lib/logger.js` **(PROPUESTO)** |
| B-036 | Seguridad | Captcha en el registro | P1 | Alto | S | — | `AuthGate.jsx`, configuración de Supabase |
| B-037 | Seguridad | Comprobar `docentes.activo` al iniciar sesión y en la API | P1 | Alto | S | B-015 | `AuthGate.jsx`, `api/_lib/auth.js` |
| B-038 | Seguridad | Delimitar la entrada del usuario dentro de los prompts | P1 | Alto | S | B-031 | `api/_lib/prompts/` **(PROPUESTO)** |
| B-039 | Seguridad | Mensajes de error sin detalles técnicos | P1 | Alto | S | — | `App.jsx:3503`, `api/_lib/errors.js` **(PROPUESTO)** |

### Datos

| ID | Área | Mejora | Prioridad | Impacto | Esfuerzo | Dependencias | Archivos probables |
|---|---|---|---|---|---|---|---|
| B-040 | Datos | Crear `material_types` y sustituir el `CHECK` por FK | P1 | Alto | S | B-004 | `migrations/002_material_types.sql` **(PROPUESTO)** |
| B-041 | Datos | Crear `plans` y enlazarla al perfil | P1 | Alto | S | B-016 | `migrations/003_plans.sql` **(PROPUESTO)** |
| B-042 | Datos | Crear `ai_generations` y `ai_usage` | P1 | Alto | M | B-031 | `migrations/005_ai_generations.sql` **(PROPUESTO)** |
| B-043 | Datos | Crear `favorites` y migrar `localStorage` | P1 | Alto | S | — | `migrations/006_favorites.sql` **(PROPUESTO)**, `App.jsx:3602` |
| B-044 | Datos | Política de DELETE en `docentes` para permitir borrar la cuenta | P1 | Alto | XS | — | `migrations/004_profiles.sql` **(PROPUESTO)** |
| B-045 | Datos | Trigger `updated_at` en `materiales_docente` | P1 | Medio | XS | B-004 | migración **(PROPUESTO)** |

### Frontend y arquitectura

| ID | Área | Mejora | Prioridad | Impacto | Esfuerzo | Dependencias | Archivos probables |
|---|---|---|---|---|---|---|---|
| B-046 | Frontend | Introducir `react-router-dom` con URLs por sección y recurso | P1 | Muy alto | M | B-001, B-018 | `src/routes/` **(PROPUESTO)**, `vercel.json` |
| B-047 | Frontend | Dividir `App.jsx` en `config/`, `data/`, `lib/`, `features/` | P1 | Muy alto | L | B-001, B-026 | `src/**` **(PROPUESTO)** |
| B-048 | Frontend | Hook `useGenerator` que unifique los 9 generadores | P1 | Alto | M | B-047 | `src/hooks/useGenerator.js` **(PROPUESTO)** |
| B-049 | Frontend | Unificar las 3 paletas en `config/theme.js` | P1 | Alto | S | B-047 | `App.jsx:69`, `AuthGate.jsx:5`, `AdminPanel.jsx:4` |
| B-050 | Frontend | `ErrorBoundary` en raíz y por sección | P1 | Alto | S | — | `src/components/ui/ErrorBoundary.jsx` **(PROPUESTO)** |
| B-051 | Frontend | División de código con `React.lazy` por ruta y generador | P1 | Alto | M | B-046, B-047 | `src/routes/` |
| B-052 | Frontend | Importación dinámica de `docx` al descargar | P1 | Alto | S | B-047 | `src/lib/docx/` **(PROPUESTO)** |
| B-053 | Frontend | Descentralizar los 20 `useState` de `SciVerseApp` | P1 | Alto | M | B-046 | `App.jsx:3585` |

### UX y producto

| ID | Área | Mejora | Prioridad | Impacto | Esfuerzo | Dependencias | Archivos probables |
|---|---|---|---|---|---|---|---|
| B-054 | UX | Reenviar el correo de confirmación con cuenta atrás | P1 | Muy alto | S | — | `AuthGate.jsx:215` |
| B-055 | UX | Autoguardado de los formularios de generación | P1 | Muy alto | S | B-048 | `src/hooks/useAutosave.js` **(PROPUESTO)** |
| B-056 | UX | Reintento por módulo sin perder el progreso | P1 | Muy alto | M | B-031 | `App.jsx:948`, `api/ai/session.js` **(PROPUESTO)** |
| B-057 | UX | Dashboard con "continuar donde lo dejaste" | P1 | Muy alto | M | B-001, B-046 | `src/features/dashboard/` **(PROPUESTO)** |
| B-058 | UX | Onboarding de 3 pantallas | P1 | Muy alto | L | B-046, B-015 | `src/features/onboarding/` **(PROPUESTO)** |
| B-059 | UX | Precargar los formularios con grados, áreas y región del perfil | P1 | Alto | M | B-058 | `src/hooks/useProfile.js` **(PROPUESTO)** |
| B-060 | UX | Progreso real de generación con nombres pedagógicos y cancelar | P1 | Alto | M | B-048 | `src/components/shared/GenerationProgress.jsx` **(PROPUESTO)** |
| B-061 | UX | Diccionario único de tipos: etiquetas y filtros de biblioteca | P1 | Alto | S | B-040 | `src/config/material-types.js` **(PROPUESTO)**, `App.jsx:3619`, `:3729` |
| B-062 | UX | Enrutar la descarga de biblioteca al exportador Word correcto | P1 | Alto | S | B-047 | `App.jsx:3733` |
| B-063 | UX | Pasar el contexto del reto al crear un instrumento | P1 | Alto | S | — | `App.jsx:3737` |
| B-064 | UX | Añadir "Sesión" y "Clase completa" al catálogo de creación | P1 | Alto | XS | B-001 | `CreateStudio` |
| B-065 | UX | Eliminar cuenta y exportar datos | P1 | Alto | M | B-044 | `src/features/account/` **(PROPUESTO)** |
| B-066 | Producto | Que el plan pagado ajuste `ai_weekly_limit` | P1 | Muy alto | M | B-041 | `api/_lib/credits.js`, admin |
| B-067 | Producto | Implementar o retirar la función de referidos | P1 | Medio | M | B-046 | `App.jsx:3540` |
| B-068 | Producto | Exponer "Guía de observación" y "Cuestionario" en el catálogo | P1 | Alto | S | B-001 | `CreateStudio` |

### Landing y SEO

| ID | Área | Mejora | Prioridad | Impacto | Esfuerzo | Dependencias | Archivos probables |
|---|---|---|---|---|---|---|---|
| B-069 | Landing | Metadatos, Open Graph, canonical, favicon, `robots.txt` | P1 | Muy alto | XS | — | `index.html`, `public/` |
| B-070 | Landing | Sección de precios visible en la página | P1 | Alto | S | B-016 | `src/features/landing/` **(PROPUESTO)** |
| B-071 | Landing | Nuevo titular con palabras clave reales | P1 | Alto | S | — | `App.jsx:2534` |
| B-072 | Landing | Sección "Cómo funciona" en 3 pasos | P1 | Alto | S | — | landing |
| B-073 | Landing | Sección de alineación al CNEB (el diferenciador) | P1 | Alto | S | — | landing |
| B-074 | Landing | Resolver los testimonios (documentar o etiquetar) | P1 | Medio | S | — | `App.jsx:2430` |
| B-075 | Landing | Enlazar términos y privacidad desde el registro | P1 | Medio | XS | — | `AuthGate.jsx:249` |

### Admin

| ID | Área | Mejora | Prioridad | Impacto | Esfuerzo | Dependencias | Archivos probables |
|---|---|---|---|---|---|---|---|
| B-076 | Admin | `admin_roles` y `has_admin_role` | P1 | Alto | M | B-027 | `migrations/008_admin_roles.sql` **(PROPUESTO)** |
| B-077 | Admin | Ruta `/admin` con login normal y guardia por rol | P1 | Alto | M | B-046, B-076 | `api/admin/_guard.js`, `src/features/admin/` **(PROPUESTO)** |
| B-078 | Admin | Retirar `ADMIN_SECRET` y `?admin=1` | P1 | Alto | S | B-077 | `main.jsx:7`, `api/list-docentes.js` |
| B-079 | Admin | `audit_logs` y registro de accesos a PII | P1 | Alto | M | B-076 | `migrations/` **(PROPUESTO)** |
| B-080 | Admin | Activar/desactivar cuenta, cambiar plan, ajustar créditos | P1 | Alto | M | B-077, B-066 | `api/admin/teacher/[id].js` **(PROPUESTO)** |
| B-081 | Admin | Panel de consumo de IA | P1 | Alto | M | B-042, B-077 | `api/admin/ai-usage.js` **(PROPUESTO)** |

### Accesibilidad y responsive

| ID | Área | Mejora | Prioridad | Impacto | Esfuerzo | Dependencias | Archivos probables |
|---|---|---|---|---|---|---|---|
| B-082 | A11y | Escala tipográfica con mínimo de 12 px (elimina 157 reglas ≤10 px) | P1 | Muy alto | M | B-047 | `src/styles/tokens.css` **(PROPUESTO)**, `index.css` |
| B-083 | A11y | Paleta de neutrales con contraste ≥4.5:1 | P1 | Alto | M | B-049 | `src/styles/tokens.css` **(PROPUESTO)** |
| B-084 | A11y | `Modal` base con Escape, trampa y devolución de foco | P1 | Alto | M | B-047 | `src/components/ui/Modal.jsx` **(PROPUESTO)** |
| B-085 | A11y | Objetivos táctiles ≥44 px y separar "eliminar" de "duplicar" | P1 | Alto | S | — | `App.jsx:3733` |
| B-086 | A11y | `aria-label` en botones de solo icono | P1 | Medio | S | — | `App.jsx:3733` |
| B-087 | A11y | Enlace "Saltar al contenido" | P1 | Medio | XS | — | `AppShell` **(PROPUESTO)** |
| B-088 | A11y | `role="alert"` en errores de generadores | P1 | Medio | S | B-048 | generadores |
| B-089 | Responsive | Unificar a 5 puntos de ruptura con `min-width` | P1 | Alto | M | B-082 | `index.css` |
| B-090 | Responsive | Resolver la zona muerta de tablet (768-1024 px) | P1 | Alto | S | B-089 | `index.css` |
| B-091 | Responsive | Tabla del admin adaptada a móvil | P1 | Medio | S | B-077 | `src/features/admin/` |
| B-092 | Responsive | Navegación móvil con acceso a cuenta y cerrar sesión | P1 | Alto | S | B-046 | `MobileNav` **(PROPUESTO)** |

### Testing

| ID | Área | Mejora | Prioridad | Impacto | Esfuerzo | Dependencias | Archivos probables |
|---|---|---|---|---|---|---|---|
| B-093 | Testing | Configurar Vitest + Testing Library | P1 | Alto | S | B-026 | `vitest.config.js` **(PROPUESTO)** |
| B-094 | Testing | Pruebas unitarias de `lib/docx/` y validadores | P1 | Alto | M | B-093, B-047 | `tests/unit/` **(PROPUESTO)** |
| B-095 | Testing | Pruebas de componente de auth y generadores | P1 | Alto | M | B-093 | `tests/component/` **(PROPUESTO)** |
| B-096 | Testing | E2E con Playwright de los 5 flujos P0 | P1 | Muy alto | L | B-046 | `tests/e2e/` **(PROPUESTO)** |
| B-097 | Testing | CI en GitHub Actions: lint, build, test | P1 | Alto | S | B-093 | `.github/workflows/ci.yml` **(PROPUESTO)** |

---

## P2 — Importante

| ID | Área | Mejora | Prioridad | Impacto | Esfuerzo | Dependencias | Archivos probables |
|---|---|---|---|---|---|---|---|
| B-098 | IA | Orquestar los 4 módulos de sesión en el servidor (1 crédito) | P2 | Muy alto | L | B-031, B-010 | `api/ai/session.js` **(PROPUESTO)** |
| B-099 | IA | Validación semántica del output (minutos, procesos, cantidades) | P2 | Alto | M | B-031 | `api/_lib/validators/` **(PROPUESTO)** |
| B-100 | IA | Versionado de prompts registrado en `ai_generations` | P2 | Alto | M | B-042 | `api/_lib/prompts/` **(PROPUESTO)** |
| B-101 | IA | `systemInstruction` compartida entre endpoints | P2 | Medio | S | B-031 | `api/_lib/prompts/system.js` **(PROPUESTO)** |
| B-102 | IA | `maxOutputTokens` calculado según lo pedido | P2 | Medio | S | B-031 | `api/_lib/gemini.js` **(PROPUESTO)** |
| B-103 | IA | Registrar los fallos de devolución de crédito | P2 | Medio | XS | B-035 | endpoints con cuota |
| B-104 | IA | Verificación local de JWT en vez de llamada a Supabase | P2 | Medio | M | B-031 | `api/_lib/auth.js` **(PROPUESTO)** |
| B-105 | Producto | **Edición en línea de los materiales generados** | P2 | Muy alto | L | B-046, B-047 | `src/features/material/` **(PROPUESTO)** |
| B-106 | Producto | Historial de versiones de materiales | P2 | Alto | M | B-105 | `migrations/007_material_versions.sql` **(PROPUESTO)** |
| B-107 | Producto | Regeneración parcial por sección | P2 | Alto | M | B-105, B-098 | `api/ai/` |
| B-108 | Producto | Colecciones para organizar la biblioteca | P2 | Alto | M | B-046 | `migrations/` **(PROPUESTO)** |
| B-109 | Producto | Papelera de 30 días con deshacer | P2 | Medio | S | B-045 | `App.jsx:3624` |
| B-110 | Producto | Vincular instrumento con su sesión (`parent_id`) | P2 | Alto | S | B-004 | migración + generadores |
| B-111 | Producto | Búsqueda y paginación en servidor | P2 | Alto | M | B-046 | `api/me/materials.js` **(PROPUESTO)** |
| B-112 | Producto | Buscador global con `Cmd/Ctrl+K` | P2 | Alto | M | B-111 | `src/components/shared/` **(PROPUESTO)** |
| B-113 | Producto | Correo semanal de retorno | P2 | Alto | M | B-042 | función programada |
| B-114 | Producto | Ayuda contextual con tooltips en términos CNEB | P2 | Alto | S | B-047 | `src/components/ui/Tooltip.jsx` **(PROPUESTO)** |
| B-115 | Producto | Compartir un material con otra docente | P2 | Medio | M | B-046 | `src/features/material/` |
| B-116 | UI | Normalizar radios (24→5) y sombras (58→5) | P2 | Medio | S | B-082 | `index.css` |
| B-117 | UI | Extraer `components/ui/` (~15 componentes) | P2 | Alto | L | B-047 | `src/components/ui/` **(PROPUESTO)** |
| B-118 | UI | Sustituir `alert`/`confirm` por `Toast` y `ConfirmDialog` | P2 | Medio | S | B-117 | `App.jsx:3624` |
| B-119 | UI | Componente `EmptyState` único | P2 | Medio | S | B-117 | `src/components/ui/` |
| B-120 | UI | Esqueletos de carga | P2 | Medio | S | B-117 | `src/components/ui/Skeleton.jsx` |
| B-121 | UI | Eliminar los alias de color engañosos (`violet`, `amber`, `cyan`) | P2 | Medio | S | B-049 | `App.jsx:81-83` |
| B-122 | UI | Modales como hoja inferior en móvil | P2 | Medio | M | B-084 | `Modal` |
| B-123 | UI | Corregir barra superior duplicada | P2 | Medio | S | B-046 | `App.jsx:3672` |
| B-124 | Frontend | `useMemo` en el filtrado de biblioteca | P2 | Medio | XS | — | `App.jsx:3622` |
| B-125 | Frontend | `AbortController` en las llamadas a la IA | P2 | Medio | S | B-048 | generadores |
| B-126 | Frontend | Sustituir el bus de eventos `window` por `useMaterials` | P2 | Medio | S | B-047 | `App.jsx:125`, `:3613` |
| B-127 | Frontend | Unificar las primitivas de Word | P2 | Medio | S | B-047 | `src/lib/docx/primitives.js` **(PROPUESTO)** |
| B-128 | Frontend | Caché de peticiones (React Query o hooks propios) | P2 | Medio | M | B-047 | `src/hooks/` |
| B-129 | Rendimiento | `React.lazy` para `AdminPanel` | P2 | Medio | XS | — | `main.jsx:4` |
| B-130 | Rendimiento | Corregir `content` de `tailwind.config.js` | P2 | Bajo | XS | B-021 | `tailwind.config.js:3` |
| B-131 | Rendimiento | Reducir pesos de fuentes y añadir `preconnect` a gstatic | P2 | Medio | XS | — | `index.html` |
| B-132 | Rendimiento | `loading="lazy"` en imágenes fuera del primer pantallazo | P2 | Bajo | XS | B-013 | componentes con imagen |
| B-133 | Datos | Índices para filtros y búsqueda | P2 | Medio | S | B-111 | migración **(PROPUESTO)** |
| B-134 | Datos | Filtro explícito de `user_id` en la consulta de biblioteca | P2 | Medio | XS | — | `App.jsx:3606` |
| B-135 | Datos | `search_path = ''` en las RPC | P2 | Bajo | XS | — | migración **(PROPUESTO)** |
| B-136 | Datos | Resolver los tres índices únicos sobre `correo` | P2 | Medio | S | B-004 | migración **(PROPUESTO)** |
| B-137 | A11y | `aria-selected` en todas las pestañas | P2 | Medio | S | B-117 | `Tabs` |
| B-138 | A11y | Un solo `<h1>` por vista | P2 | Medio | S | B-047 | features |
| B-139 | A11y | `aria-hidden` en iconos decorativos | P2 | Bajo | S | — | toda la app |
| B-140 | A11y | `prefers-reduced-motion` completo | P2 | Medio | S | B-116 | `index.css` |
| B-141 | A11y | Contenedores con `overflow-x: auto` para contenido ancho | P2 | Medio | S | B-089 | `index.css` |
| B-142 | Analítica | Instrumentar eventos de producto | P2 | Alto | M | B-046 | `src/lib/analytics.js` **(PROPUESTO)** |
| B-143 | Admin | Panel de métricas de producto | P2 | Alto | L | B-142, B-077 | `api/admin/metrics.js` **(PROPUESTO)** |
| B-144 | Admin | Panel de errores | P2 | Medio | M | B-035, B-077 | `api/admin/errors.js` **(PROPUESTO)** |
| B-145 | Admin | Configuración de planes y herramientas desde el panel | P2 | Medio | M | B-041, B-077 | `api/admin/settings.js` **(PROPUESTO)** |
| B-146 | Landing | Vista previa del Word generado | P2 | Alto | M | — | landing |
| B-147 | Landing | Demo interactiva real | P2 | Alto | M | B-046 | landing |
| B-148 | Landing | Sección para instituciones | P2 | Medio | S | — | landing |
| B-149 | Landing | Páginas legales con URL propia | P2 | Medio | S | B-046 | `src/features/legal/` **(PROPUESTO)** |
| B-150 | UX | Sincronizar los favoritos con la tabla `favorites` | P2 | Alto | S | B-043 | `App.jsx:3602` |
| B-151 | UX | Confirmar al cerrar sesión con trabajo sin guardar | P2 | Medio | S | B-055 | `AuthGate.jsx:169` |
| B-152 | UX | Cuatro estadísticas reales en el dashboard | P2 | Medio | S | B-057, B-012 | dashboard |
| B-153 | UX | Leer `profile.plan` en la barra lateral | P2 | Medio | XS | B-015 | `App.jsx:3661` |
| B-154 | UX | Filtro por área en el catálogo de retos | P2 | Bajo | S | — | `App.jsx:3712` |
| B-155 | UX | Búsqueda por texto en actividades | P2 | Medio | S | — | `App.jsx:3704` |

---

## P3 — Mejora

| ID | Área | Mejora | Prioridad | Impacto | Esfuerzo | Dependencias | Archivos probables |
|---|---|---|---|---|---|---|---|
| B-156 | Producto | Crucigrama real con algoritmo de cuadrícula | P3 | Medio | M | B-014 | `src/features/create/generators/` |
| B-157 | Producto | Sentido de progreso con constancia descargable | P3 | Medio | M | B-142 | `src/features/account/` |
| B-158 | Producto | Plantillas a partir de materiales propios | P3 | Medio | M | B-105 | biblioteca |
| B-159 | Producto | Exportar a PDF | P3 | Bajo | S | B-052 | `src/lib/` |
| B-160 | Producto | Vista previa de plantillas | P3 | Bajo | S | — | biblioteca |
| B-161 | Producto | Retirar las integraciones "Próximamente" | P3 | Bajo | XS | — | `App.jsx:3577` |
| B-162 | Producto | Calendario e inscripción a capacitaciones | P3 | Medio | M | B-046 | `src/features/account/` |
| B-163 | UI | Modo oscuro | P3 | Bajo | M | B-117 | `tokens.css` |
| B-164 | UI | Icono de hamburguesa reconocible | P3 | Bajo | XS | — | `App.jsx:2528` |
| B-165 | UI | Vista por tipo en el visor de materiales | P3 | Medio | M | B-105 | `src/features/material/` |
| B-166 | A11y | `alt=""` en imágenes decorativas | P3 | Bajo | XS | — | toda la app |
| B-167 | A11y | Migrar a `htmlFor`/`id` explícito | P3 | Bajo | M | B-117 | formularios |
| B-168 | Código | JSDoc en `lib/` y `hooks/` | P3 | Medio | M | B-047 | `src/lib/`, `src/hooks/` |
| B-169 | Código | Convención escrita de idiomas | P3 | Bajo | XS | B-026 | `CONTRIBUTING.md` **(PROPUESTO)** |
| B-170 | Código | Eliminar `?restablecer=1` y `onForgotPassword` sin uso | P3 | Bajo | XS | B-023 | `AuthGate.jsx:148`, `App.jsx:2481` |
| B-171 | Rendimiento | Autoalojar las fuentes | P3 | Bajo | S | — | `public/fonts/` |
| B-172 | Rendimiento | Virtualización de listas largas | P3 | Bajo | M | B-111 | biblioteca |
| B-173 | Rendimiento | Streaming de la respuesta de IA | P3 | Medio | L | B-098 | `api/ai/` |
| B-174 | Seguridad | `security.txt` y escaneo de dependencias | P3 | Bajo | S | B-097 | `public/`, CI |
| B-175 | Datos | Borrado lógico generalizado | P3 | Bajo | S | B-109 | migración |

---

## Resumen

| Prioridad | Cantidad |
|---|---|
| **P0** | **20** |
| **P1** | **77** |
| **P2** | **58** |
| **P3** | **20** |
| **Total** | **175** |

### Por área

| Área | Cantidad |
|---|---|
| UX y producto | 45 |
| Frontend y UI | 32 |
| Seguridad y backend | 24 |
| Datos | 17 |
| Accesibilidad y responsive | 17 |
| Rendimiento | 13 |
| Admin | 11 |
| Landing | 11 |
| Testing y proceso | 10 |
| IA | 10 |

### Las diez primeras a ejecutar

Máximo impacto, mínimo esfuerzo, sin dependencias:

| Orden | ID | Mejora | Esfuerzo |
|---|---|---|---|
| 1 | B-009 | Límite de presupuesto en Google Cloud | XS |
| 2 | B-013 | Optimizar los PNG de Kantu | XS |
| 3 | B-003 | Añadir `challenge` al `CHECK` | XS |
| 4 | B-005 | Secreto admin fuera de la URL y rotarlo | XS |
| 5 | B-006 | Paginar `list-docentes` | XS |
| 6 | B-008 | Fijar un modelo de Gemini válido | XS |
| 7 | B-012 | Importar `CreditsIndicator` | XS |
| 8 | B-029 | Quitar `contenido` del listado | XS |
| 9 | B-020 | Regla `:focus-visible` | XS |
| 10 | B-017 | Arreglar `onChoosePlan` | XS |

**Las diez suman menos de un día** y cierran cuatro P0 de seguridad y coste, dos de rendimiento y dos funciones rotas.

Después de esas, **B-001** (eliminar el codemod) es la que desbloquea todo el resto del backlog.
