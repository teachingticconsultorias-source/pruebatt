# 01 — Arquitectura actual

Estado del sistema tal como está en el commit `e49c68c`. Todo lo descrito aquí se verificó leyendo el código, no se asume.

---

## 1. Stack

| Capa | Tecnología | Versión declarada | Notas |
|---|---|---|---|
| UI | React | `^18.2.0` | Sin router, sin gestor de estado, sin librería de UI |
| Bundler | Vite | `^5.2.0` | `vite.config.js` es la configuración por defecto: solo el plugin de React |
| Estilos | Tailwind CSS + CSS plano | `^3.4.3` | Uso mixto; ver sección 6 |
| Iconos | lucide-react | `^0.383.0` | Importación nombrada, ~90 iconos |
| Documentos | docx | `^9.7.1` | Generación de `.docx` en el navegador |
| Auth + BD | @supabase/supabase-js | `^2.45.4` | Auth por email/contraseña, Postgres con RLS |
| IA | Google Gemini REST | — | `v1beta/models/{model}:generateContent`, sin SDK |
| Hosting | Vercel | — | Estático + funciones serverless en `/api` |

No hay TypeScript, ESLint, Prettier, Vitest, Jest, Playwright ni Husky. No hay `vercel.json`, `.editorconfig`, `.nvmrc`, `.gitattributes` ni workflows de CI.

---

## 2. Estructura de archivos

```
pruebatt/
├── index.html                     ← carga /main.jsx (RAÍZ, no src/)
├── main.jsx                       ← punto de entrada REAL
├── App.jsx                        ← 3.776 líneas / 277 KB — toda la app
├── AuthGate.jsx                   ← autenticación REAL (318 líneas)
├── AdminPanel.jsx                 ← panel admin (103 líneas)
├── AnimalCellLab.jsx              ← 398 líneas · MUERTO, nunca importado
├── supabaseClient.js              ← cliente Supabase
├── steamGuideActivities.js        ← 17 actividades STEAM (datos)
├── index.css                      ← 99 KB · Tailwind + ~330 colores literales
├── library.css                    ← 10 KB · importado por App.jsx
├── credit-widget.css              ← MUERTO · ningún archivo lo importa
├── session-next-flow.css          ← MUERTO (lo importa un componente muerto)
├── session-resources.css          ← MUERTO (lo importa un componente muerto)
├── apply-sciverse-v2.mjs          ← 89 KB · CODEMOD DE BUILD (ver sección 4)
│
├── api/                           ← funciones serverless de Vercel
│   ├── generate-session.js        ← generador principal · SIN cuota
│   ├── generate-session-resource.js ← recursos V2 · CON cuota
│   ├── generate-linked-worksheet.js ← ficha vinculada · CON cuota
│   ├── generate-with-quota.js     ← wrapper de cuota · HUÉRFANO
│   ├── credits.js                 ← estado de créditos · HUÉRFANO
│   ├── list-docentes.js           ← listado admin · service_role
│   └── (generate-project-steam.js)← NO EXISTE · lo crea el build
│
├── components/                    ← DIRECTORIO COMPLETO MUERTO (1.563 líneas)
│   ├── CreditsIndicator.jsx
│   ├── SessionNextFlow.jsx
│   └── SessionResourcesPanel.jsx
│
├── src/                           ← DIRECTORIO COMPLETO MUERTO (versión antigua)
│   ├── App.jsx  (1.897 líneas)
│   ├── AdminPanel.jsx  (idéntico al de la raíz)
│   ├── main.jsx · supabaseClient.js · index.css
│
├── public/mascot/                 ← kantu-material.png, kantu-session.png
│
├── *.sql                          ← 4 archivos, con contradicciones entre sí
├── *.zip                          ← 3 snapshots de versiones antiguas (223 KB)
├── *.txt                          ← 6 archivos de instrucciones manuales
├── package.json · package-fallback.json
└── package-lock.json + pnpm-lock.yaml + pnpm-workspace.yaml   ← 2 lockfiles
```

### Grafo de importación real

Solo estos archivos llegan al bundle:

```mermaid
graph TD
  HTML["index.html"] --> MAIN["main.jsx"]
  MAIN --> CSS["index.css"]
  MAIN --> ADMIN["AdminPanel.jsx<br/>(si ?admin=1)"]
  MAIN --> APP["App.jsx<br/>3.776 líneas"]
  APP --> SUPA["supabaseClient.js"]
  APP --> GATE["AuthGate.jsx"]
  APP --> GUIDE["steamGuideActivities.js"]
  APP --> LIBCSS["library.css"]
  APP --> DOCX["docx"]
  GATE --> SUPA

  DEAD1["src/** — 2.100 líneas"]:::dead
  DEAD2["components/** — 1.563 líneas"]:::dead
  DEAD3["AnimalCellLab.jsx — 398 líneas"]:::dead
  DEAD4["credit-widget.css<br/>session-*.css"]:::dead

  classDef dead fill:#fee,stroke:#c33,stroke-dasharray: 5 3
```

**Nota clave:** `index.html:11` apunta a `/main.jsx` en la raíz. Todo `src/` es un fósil de una versión anterior. Es la fuente de confusión más común al abrir este repositorio.

---

## 3. Frontend

### 3.1 Jerarquía de componentes

```mermaid
graph TD
  ROOT["SciVerseDocentes()<br/>App.jsx:3531"] --> AG["AuthGate<br/>AuthGate.jsx"]
  AG -->|sin sesión, view=landing| LAND["ImprovedLanding<br/>App.jsx:2481"]
  AG -->|sin sesión, view=register/login/<br/>recovery/new-password/confirmation| FORMS["Formularios de auth<br/>(dentro de AuthGate)"]
  AG -->|con sesión| APP["SciVerseApp<br/>App.jsx:3583"]

  APP --> SEC{"activeSection<br/>(useState)"}
  SEC -->|inicio| DASH["Dashboard"]
  SEC -->|actividades| ACT["Catálogo STEAM"]
  SEC -->|crear| CS["CreateStudio"]
  SEC -->|retos| RET["Retos grupales"]
  SEC -->|biblioteca| BIB["Mi biblioteca"]

  CS --> GEN["Generadores<br/>(session, project, rubric,<br/>checklist, wordsearch, ...)"]
  APP --> MOD["Modales: ActivityModal ·<br/>RetoModal · MaterialViewerModal ·<br/>TeacherAccountModal"]
```

### 3.2 Gestión de estado

No hay Redux, Zustand, Context ni React Query. Todo es `useState` local dentro de dos componentes gigantes:

- **`SciVerseApp`** declara **20 `useState`** (`App.jsx:3585-3602`): `heroGrade`, `gradeFilter`, `subjectFilter`, `selected`, `selectedReto`, `retoView`, `modalGrade`, `accountOpen`, `activeSection`, `teacherMaterials`, `materialsLoading`, `libraryTab`, `librarySearch`, `libraryType`, `libraryLevel`, `librarySort`, `selectedMaterial`, `savedResources`…
- Cada generador declara su propio `form`, `step`, `loading`, `error`, `result` — el mismo patrón repetido 9 veces sin abstracción compartida.

**Comunicación entre componentes por evento global del navegador.** `saveTeacherMaterial` (`App.jsx:125`) emite `window.dispatchEvent(new CustomEvent("sciverse:material-created"))` y `SciVerseApp` lo escucha (`App.jsx:3613`) para recargar la biblioteca. Es un bus de eventos improvisado que reemplaza a lo que debería ser estado elevado o una capa de datos.

### 3.3 Enrutamiento

**No existe.** La única lectura de la URL en toda la aplicación viva es:

```js
// main.jsx:7
const isAdmin = new URLSearchParams(window.location.search).get("admin") === "1";
```

Todo lo demás es estado en memoria. Consecuencias en `03-UX-AUDIT.md` §2.7.

### 3.4 Rendimiento

- `React.lazy` / `Suspense`: **0 usos**. Todo se carga en un bundle único.
- `useMemo` / `React.memo` / `useCallback` en listas: **0 / 0 / 1**.
- `ErrorBoundary`: **0**. Un error de render en cualquier generador deja la pantalla en blanco.
- `AbortController`: **0**. Las llamadas a Gemini (60-120 s) no se cancelan al navegar.

---

## 4. Proceso de build

Este es el aspecto más inusual de la arquitectura y merece su propio diagrama.

```mermaid
sequenceDiagram
    participant Dev as Desarrollo
    participant Git as GitHub (main)
    participant V as Vercel
    participant CM as apply-sciverse-v2.mjs
    participant Vite as vite build

    Dev->>Git: Edición manual por la web de GitHub
    Git->>V: push dispara despliegue
    V->>V: install (¿npm o pnpm? 2 lockfiles)
    V->>CM: npm run build → node apply-sciverse-v2.mjs
    CM->>CM: 11× mustReplace sobre App.jsx
    Note over CM: si un ancla no coincide<br/>lanza excepción y el BUILD FALLA
    CM->>CM: append CSS V2 a index.css (con marcador)
    CM->>CM: CREA api/generate-project-steam.js
    CM->>Vite: && vite build
    Vite->>V: dist/
    V->>V: publica estático + funciones de /api
```

### Qué modifica el codemod

| # | Objetivo | Efecto |
|---|---|---|
| 1 | Iconos | Añade `Gamepad2, ListChecks, CalendarDays` al import de lucide |
| 2 | Generadores V2 | Inyecta `ProjectSteamGenerator`, `ResourceFromAI`, `ValuationScaleGenerator`, `LinkedWorksheetGenerator`, `LinkedReadingGenerator`, `LinkedRatingScaleGenerator`, `CompleteClassFlow`, `CompleteClassIntro`, `FlowChoiceCard` |
| 3 | `CreateStudio` | **Reemplazo total** por una versión con categorías |
| 4 | Estado | Añade `initialCreation` para abrir el estudio desde el dashboard |
| 5 | Dashboard | **Reemplazo total** por el "Home V2" |
| 6 / 6B | Cableado | Conecta dashboard ↔ estudio y el flujo Sesión→Instrumento→Material |
| 7 | CSS | Añade ~2 bloques grandes a `index.css` (idempotente por marcador) |
| 8 | API | **Crea `api/generate-project-steam.js`** desde una cadena de 101 líneas |

### Hechos verificados

Ejecutando el script sobre una copia aislada del blob de Git:

- **Primera pasada: correcta.** `App.jsx` pasa de 3.776 → 4.221 líneas; `index.css` de 268 → 339; se crea `api/generate-project-steam.js` (101 líneas).
- **Segunda pasada: falla.** `Error: No pude aplicar el cambio: iconos del dashboard`. No es idempotente.
- **En Windows falla siempre.** El árbol de trabajo local tiene CRLF (`core.autocrlf=true`, sin `.gitattributes`); las anclas del codemod usan LF. El blob de Git sí tiene LF, por eso Vercel (Linux) construye bien y el desarrollador local no puede construir nunca.

---

## 5. Backend — funciones serverless

Todas son funciones de Vercel con la firma `export default async function handler(req, res)`. No hay framework, middleware, validación por esquema ni capa compartida: cada archivo repite su propia lógica de auth y de errores.

```mermaid
graph LR
  FE["Frontend<br/>App.jsx"]

  FE -->|"4 llamadas por sesión"| GS["/api/generate-session<br/>❌ sin cuota"]
  FE -->|"worksheet · reading ·<br/>rating_scale"| GSR["/api/generate-session-resource<br/>✅ con cuota"]
  FE -->|"ficha vinculada"| GLW["/api/generate-linked-worksheet<br/>✅ con cuota"]
  FE -->|"proyecto STEAM"| GPS["/api/generate-project-steam<br/>❌ sin cuota · creado en build"]

  ORPH1["/api/generate-with-quota<br/>⚠️ HUÉRFANO"]:::orphan
  ORPH2["/api/credits<br/>⚠️ HUÉRFANO"]:::orphan

  ADM["AdminPanel.jsx"] -->|"?secret= en la URL"| LD["/api/list-docentes<br/>🔑 service_role"]

  GS --> GEM["Google Gemini"]
  GSR --> GEM
  GLW --> GEM
  GPS --> GEM

  GSR --> RPC["Supabase RPC<br/>consume_ai_credit /<br/>refund_ai_credit"]
  GLW --> RPC
  LD --> PG["Postgres<br/>tabla docentes"]

  classDef orphan fill:#ffe8cc,stroke:#e08a00,stroke-dasharray: 4 3
```

Patrón de autenticación (repetido en cada archivo, con variantes):

```js
const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
const auth = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` }
});
if (!auth.ok) return res.status(401).json({ error: "Tu sesión venció." });
```

Esto implica **una petición HTTP extra a Supabase por cada llamada** — para una sesión completa son 4 verificaciones redundantes del mismo token. Detalle en `06-BACKEND-API-AUDIT.md`.

---

## 6. Estilos

Coexisten **cuatro sistemas** sin frontera clara:

| Sistema | Dónde | Volumen |
|---|---|---|
| Tailwind (utilidades) | `className="flex items-center gap-2 px-6"` | ~145 elementos |
| CSS plano con clases semánticas | `index.css`, `library.css` | 99 KB + 10 KB |
| Estilos en línea con el objeto `C` | `style={{ background: C.teal }}` | 167 ocurrencias |
| `<style>` embebido en componente | `App.jsx:3643` | 1 bloque con `@import` de fuentes |

**Tres paletas independientes y divergentes:**

| Token | `App.jsx` (`C`) | `AuthGate.jsx` (`COLORS`) | `AdminPanel.jsx` (`C_*`) |
|---|---|---|---|
| teal | `#3EC6C0` | `#35B9AD` | `#3EC6C0` |
| text | `#0F2E2C` | `#102A2E` | `#0F2E2C` |
| muted | `#5B7876` | `#64777A` | `#5B7876` |
| line | `rgba(15,61,58,0.14)` | `#D7E9E7` | `rgba(15,61,58,0.14)` |

Además `index.css` contiene **331 valores de color literales distintos** y solo **6 propiedades personalizadas CSS**, sin bloque `:root`. Detalle en `04-UI-DESIGN-SYSTEM-AUDIT.md`.

---

## 7. Supabase

### Esquema

```mermaid
erDiagram
    AUTH_USERS ||--o| DOCENTES : "trigger al_crear_usuario"
    AUTH_USERS ||--o{ MATERIALES_DOCENTE : "user_id"

    AUTH_USERS {
        uuid id PK
        text email
        jsonb raw_user_meta_data "FUENTE REAL del perfil"
    }
    DOCENTES {
        uuid id PK "gen_random_uuid() — NO es el uid"
        uuid user_id FK "único, referencia auth.users"
        text nombres
        text apellidos
        text ie
        text celular
        text nivel "primaria|secundaria"
        text correo "único"
        text plan "nunca leído por la app"
        boolean activo "nunca leído por la app"
        int ai_weekly_limit "default 5"
        int ai_week_used
        date ai_week_start
    }
    MATERIALES_DOCENTE {
        uuid id PK
        uuid user_id FK
        text tipo "CHECK contradictorio entre SQL"
        text titulo
        text nivel
        text grado
        text area
        text tema
        jsonb contenido
        timestamptz created_at
        timestamptz updated_at "nunca se actualiza"
    }
```

### Flujo de datos del perfil — la divergencia

```mermaid
graph TD
    R["Registro<br/>AuthGate.register()"] -->|"signUp con options.data"| AU["auth.users.raw_user_meta_data"]
    AU -->|"trigger al_crear_usuario"| DOC["tabla docentes"]

    AU -->|"AuthGate.jsx:46-57<br/>ÚNICA lectura del perfil"| PROF["profile en React"]
    PROF --> UI["Toda la interfaz"]

    EDIT["Mi cuenta → Guardar<br/>App.jsx:3547"] -->|"auth.updateUser({data})"| AU
    EDIT -.->|"NUNCA ESCRIBE"| DOC

    DOC -->|"select *"| ADMIN["Panel admin<br/>datos congelados"]

    style DOC fill:#fee,stroke:#c33
    style ADMIN fill:#fee,stroke:#c33
```

La tabla `docentes` se escribe una vez (por el trigger) y **nunca más se actualiza**. La aplicación lee el perfil solo de `user_metadata`. El panel admin lee solo de `docentes`. Los dos divergen desde la primera edición de perfil.

### RLS y políticas

| Tabla | RLS | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|---|
| `docentes` | activo | `auth.uid() = user_id` | **ninguna** | `auth.uid() = user_id` | **ninguna** |
| `materiales_docente` | activo | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |

`docentes` no tiene política de INSERT — el trigger es `SECURITY DEFINER`, así que funciona; pero cualquier inserción desde el cliente falla. Es correcto por diseño, aunque el `src/App.jsx` muerto todavía intenta hacerlo.

### Funciones RPC

`get_ai_credit_status()`, `consume_ai_credit()`, `refund_ai_credit()` — todas `SECURITY DEFINER`, `search_path = public`, con `REVOKE ... FROM public` y `GRANT EXECUTE ... TO authenticated`. Bien construidas. `consume_ai_credit` usa `FOR UPDATE` para serializar el consumo. La semana se calcula con `date_trunc('week', timezone('America/Lima', now()))`.

---

## 8. Integración con Gemini

```mermaid
sequenceDiagram
    participant T as Docente
    participant FE as SteamGenerator
    participant API as /api/generate-session
    participant SB as Supabase Auth
    participant G as Gemini

    T->>FE: completa el asistente (3 pasos)
    T->>FE: "Generar sesión"

    loop 4 módulos: alignment → sequence → assessment → annexes
        FE->>API: POST {mode:"module", module, form, previous}
        API->>SB: GET /auth/v1/user (verificación repetida)
        SB-->>API: 200
        Note over API: ❌ no consume crédito
        API->>G: generateContent + responseSchema
        G-->>API: JSON
        API-->>FE: {result}
        Note over FE: si falla cualquier módulo →<br/>se pierde TODO el progreso
    end

    FE->>FE: compone finalResult
    FE->>SB: saveTeacherMaterial()
    Note over FE: si falla → catch{console.error}<br/>el docente NO se entera
```

Modelo por defecto: `process.env.GEMINI_MAIN_MODEL || "gemini-3.6-flash"` — idéntico en los cuatro endpoints. `gemini-3.6-flash` no corresponde a ningún identificador publicado de Gemini; si la variable de entorno no está definida en Vercel, toda generación devolvería error del proveedor. Ver `09-AI-GEMINI-AUDIT.md` §2.

---

## 9. Despliegue en Vercel

- Sin `vercel.json`: se usa la detección automática (framework Vite, `dist/` como salida, `/api/*.js` como funciones Node).
- **Dos lockfiles** (`package-lock.json` y `pnpm-lock.yaml`) más `pnpm-workspace.yaml`. Vercel prioriza `pnpm-lock.yaml` cuando existe; el `package-lock.json` queda ignorado y ambos pueden desincronizarse.
- Runtime de las funciones: no fijado (`nodejs` por defecto de la plataforma). Sin `maxDuration` declarada — riesgo real para el generador de sesiones, que encadena 4 llamadas largas.
- Sin `regions`: las funciones corren en la región por defecto, lejos de los usuarios peruanos.
- Como no hay router en el cliente, no se necesitan rewrites de SPA. Esa es la única ventaja de no tener enrutamiento.

### Variables de entorno declaradas en `.env.example`

| Variable | Ámbito | Uso real |
|---|---|---|
| `GEMINI_API_KEY` | servidor | Los 4 endpoints de generación |
| `GEMINI_MAIN_MODEL` | servidor | **No documentada en `.env.example`** pero leída por los 4 endpoints |
| `VITE_SUPABASE_URL` | cliente + servidor | `supabaseClient.js` y endpoints |
| `VITE_SUPABASE_ANON_KEY` | cliente | Clave pública |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | cliente | Alternativa moderna; **no está en `.env.example`** |
| `SUPABASE_URL` | servidor | Respaldo en varios endpoints |
| `SUPABASE_SERVICE_ROLE_KEY` | servidor | Solo `list-docentes.js` |
| `ADMIN_SECRET` | servidor | Solo `list-docentes.js` |

`.env.example` está desactualizado: le faltan `GEMINI_MAIN_MODEL` y `VITE_SUPABASE_PUBLISHABLE_KEY`, ambas leídas por el código.

---

## 10. Flujo de datos completo

```mermaid
graph TB
    subgraph Navegador
      L["Landing"] --> A["AuthGate"]
      A --> APP["SciVerseApp<br/>activeSection en useState"]
      APP --> G["Generadores"]
      APP --> LIB["Biblioteca"]
      G --> DOCX["docx → .docx<br/>descarga local"]
      LS["localStorage<br/>sciverse-saved-resources"] <--> APP
    end

    subgraph "Vercel — funciones"
      E1["/api/generate-*"]
      E2["/api/list-docentes"]
    end

    subgraph Supabase
      AUTH["Auth<br/>user_metadata"]
      T1["docentes"]
      T2["materiales_docente"]
      RPC["RPC de créditos"]
    end

    G -->|"Bearer token"| E1
    E1 -->|"x-goog-api-key"| GEM["Gemini"]
    E1 --> RPC
    A <--> AUTH
    LIB <-->|"RLS por user_id"| T2
    G -->|"insert"| T2
    E2 -->|"service_role"| T1

    style LS fill:#ffe8cc,stroke:#e08a00
    style T1 fill:#fee,stroke:#c33
```

Dos detalles del diagrama que importan:

- **`localStorage` guarda "Guardados" (favoritos)** con la clave `sciverse-saved-resources` (`App.jsx:3602`). No se sincroniza con Supabase: cambiar de dispositivo o limpiar el navegador borra los favoritos sin aviso.
- **La tabla `docentes` (en rojo) es un extremo muerto**: recibe una escritura del trigger y solo la lee el panel admin.

---

## 11. Dependencias

### Producción (5)

| Paquete | Declarado | Estado |
|---|---|---|
| `react` / `react-dom` | `^18.2.0` | React 19 disponible; migrar no es urgente |
| `@supabase/supabase-js` | `^2.45.4` | Rango `^2` — recibe menores automáticamente |
| `docx` | `^9.7.1` | Uso intensivo y correcto |
| `lucide-react` | `^0.383.0` | Versión de mediados de 2024; import nombrado |

### Desarrollo (5)

`@vitejs/plugin-react`, `autoprefixer`, `postcss`, `tailwindcss`, `vite`.

### Observaciones

- **Ninguna dependencia innecesaria.** Las cinco de producción se usan de verdad. Esto es positivo.
- **Faltan las herramientas básicas de calidad**: sin linter, sin formateador, sin framework de pruebas.
- `tailwind.config.js` tiene `content: ["./index.html", "./*.{js,jsx}", "./src/**/*.{js,jsx}"]` — **no incluye `./components/**`**. Si algún día se reviven esos componentes, sus clases de Tailwind se purgarán del CSS y quedarán sin estilo.
- `package-fallback.json` es una copia de `package.json` con `"build": "vite build"` (sin codemod). Es el plan de emergencia documentado en los `.txt`.

---

## 12. Resumen de la arquitectura en una frase

Una SPA monolítica de un solo archivo, sin enrutamiento ni capa de datos, cuyo código fuente se reescribe a sí mismo durante el build, con el perfil de usuario duplicado en dos almacenes que nunca se sincronizan y un sistema de control de costos correctamente implementado pero desconectado de la ruta que más gasta.
