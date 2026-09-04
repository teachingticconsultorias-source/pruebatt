# 02 — Inventario de pantallas

Inventario completo. Ninguna pantalla queda sin analizar.

**Advertencia metodológica.** El build ejecuta `apply-sciverse-v2.mjs`, que reemplaza por completo `CreateStudio` y el dashboard. Por eso hay dos conjuntos de pantallas:

- **REPO** — lo que se lee en `App.jsx` en GitHub.
- **PROD** — lo que el docente ve realmente tras el build.

Cuando difieren, se indica. Se verificó ejecutando el codemod sobre una copia aislada del blob de Git.

### Leyenda de estados

| Estado | Significado |
|---|---|
| 🟢 Excelente | Cumple su función con buena UX; ajustes menores |
| 🔵 Funcional pero mejorable | Funciona; problemas de UX/UI o de robustez |
| 🟡 Incompleta | Falta funcionalidad prometida o esperada |
| 🟠 Problemática | Funciona pero con defectos serios de datos, seguridad o confianza |
| 🔴 Rota | No hace lo que dice hacer |
| ⚫ Código legado | Existe en el repositorio, ya reemplazada |
| ⚪ No utilizada | Inalcanzable desde cualquier interacción del usuario |

---

## A. Pantallas públicas (sin sesión)

| # | Pantalla | Ruta / trigger | Archivo | Estado | Problemas | Prioridad |
|---|---|---|---|---|---|---|
| A1 | **Landing** | `/` con `view="landing"` | `App.jsx:2481` `ImprovedLanding` | 🔵 Funcional pero mejorable | Sin `<meta description>`, Open Graph ni canonical (`index.html`). Precios ocultos tras modal → invisibles para SEO. `choosePlan` (`:2505`) está definido pero nunca se usa: `PlansModal` recibe `onChoosePlan={onRegister}` (`:2601`), así que elegir un plan de pago lleva al registro en vez de a WhatsApp. Prop `onForgotPassword` declarada y nunca usada; `AuthGate` tampoco la pasa. Testimonios con nombre y foto-inicial presentados como reales. | **P1** |
| A2 | **Registro** | Botón "Acceder gratis" → `view="register"` | `AuthGate.jsx:180-260` | 🔵 Funcional pero mejorable | 8 campos en una sola pantalla, sin pasos ni barra de progreso. Sin medidor de fortaleza de contraseña ni botón de mostrar/ocultar. Los enlaces de términos y privacidad del checkbox **no son enlaces**: es texto plano (`AuthGate.jsx:249`), mientras que `LegalModal` sí existe en la landing. Sin captcha ni límite de intentos. | **P1** |
| A3 | **Confirmación de correo** | Tras registro sin sesión → `view="confirmation"` | `AuthGate.jsx:215-221` | 🟡 Incompleta | **Sin opción de reenviar el correo.** Si no llega, el docente queda bloqueado sin salida. El único botón es "Ya confirmé mi cuenta", que lleva a login sin verificar nada. Sin indicación de revisar spam. | **P0** |
| A4 | **Login** | Pestaña "Iniciar sesión" | `AuthGate.jsx:180-260` | 🔵 Funcional pero mejorable | Sin "recordarme", sin mostrar/ocultar contraseña, sin bloqueo tras N intentos fallidos. Errores genéricos correctos por seguridad, pero sin distinguir "cuenta no confirmada" de forma accionable. | **P2** |
| A5 | **Recuperar contraseña** | "¿Olvidaste tu contraseña?" → `view="recovery"` | `AuthGate.jsx:141-153` | 🔵 Funcional pero mejorable | `redirectTo` apunta a `/?restablecer=1`, pero **ningún código lee el parámetro `restablecer`**. Funciona por casualidad: el evento `PASSWORD_RECOVERY` de `onAuthStateChange` (`AuthGate.jsx:61`) es lo que dispara la vista. El parámetro es residuo muerto. | **P2** |
| A6 | **Nueva contraseña** | Evento `PASSWORD_RECOVERY` → `view="new-password"` | `AuthGate.jsx:155-167` | 🔵 Funcional pero mejorable | Sin medidor de fortaleza. Tras guardar hace `signOut()` y obliga a iniciar sesión de nuevo — correcto por seguridad, pero sin explicárselo al usuario. | **P3** |
| A7 | **Modal legal** | Enlaces del pie de la landing | `App.jsx:2606` `LegalModal` | 🔵 Funcional pero mejorable | 4 vistas (términos, privacidad, IA, reclamaciones). Sin cierre con `Escape`, sin trampa de foco, sin devolución de foco al cerrar. El "Libro de Reclamaciones" es una obligación legal en Perú y debería ser una página con URL propia, no un modal sin enlace permanente. | **P1** |
| A8 | **Modal de planes** | "Planes" en nav o pie | `App.jsx:2822` `PlansModal` | 🟠 Problemática | Su `handleChoosePlan` sí abre WhatsApp, pero la landing lo neutraliza pasando `onChoosePlan={onRegister}` (`:2601`). **Precios contradictorios en tres lugares**: `PLANS` dice "Mensual S/20"; el banner del dashboard dice "desde S/10" (`App.jsx:3700`); los beneficios del plan gratuito prometen "5 + 5 + 5 semanales" mientras la base de datos da un único cupo de 5 (`supabase-freemium.sql`). | **P0** |
| A9 | **Panel de administración** | `/?admin=1` | `AdminPanel.jsx` | 🟠 Problemática | Secreto por query string. Ver bloque D. | **P0** |

---

## B. Pantallas de la aplicación (con sesión)

| # | Pantalla | Ruta / trigger | Archivo | Estado | Problemas | Prioridad |
|---|---|---|---|---|---|---|
| B1 | **Dashboard (REPO)** | `activeSection === "inicio"` | `App.jsx:3684-3702` | 🔵 Funcional pero mejorable | Dos tarjetas de estadística muestran **el mismo número**: "Creaciones realizadas" y "Mis materiales" son ambas `teacherMaterials.length` (`:3695`). "Mi plan" está fijo en "Gratuito" ignorando `profile.plan`. Sin "continuar donde lo dejaste". El panel de materiales recientes es lo mejor de esta versión. | **P1** |
| B2 | **Dashboard (PROD)** | `activeSection === "inicio"` | generado por `apply-sciverse-v2.mjs` §5 | 🟠 Problemática | **Regresión respecto a REPO**: elimina estadísticas, materiales recientes y el acceso a planes. Queda un título, el banner "Crear clase completa", 4 categorías y una tarjeta de ayuda. **No hay ninguna forma de retomar trabajo previo desde el inicio.** El botón "Pregúntale a Kantu" llama a `openCreate(null)`, que no abre nada útil: es un callejón sin salida. | **P0** |
| B3 | **Actividades STEAM** | `activeSection === "actividades"` | `App.jsx:3704-3710` | 🟢 Excelente | 17 actividades desde `steamGuideActivities.js`, con filtro por área y conmutador primaria/secundaria y conteos por categoría. Falta buscador por texto y no persiste el filtro al navegar. Es la pantalla mejor resuelta del producto. | **P3** |
| B4 | **Detalle de actividad** | Clic en tarjeta → `selected` | `App.jsx:3341` `ActivityModal` | 🔵 Funcional pero mejorable | Contenido pedagógico rico. Sin cierre con `Escape` ni trampa de foco. El botón Guardar escribe en `localStorage`, no en Supabase → se pierde al cambiar de dispositivo. | **P2** |
| B5 | **Retos — explorar** | `activeSection === "retos"`, `retoView === "explorar"` | `App.jsx:3712-3718` | 🔵 Funcional pero mejorable | Catálogo estático `RETOS` (`App.jsx:643`) con filtro por nivel. Sin búsqueda ni filtro por área. | **P3** |
| B6 | **Detalle de reto** | Clic en tarjeta → `selectedReto` | `App.jsx:3479` `RetoModal` | 🔵 Funcional pero mejorable | Mismos problemas de modal que B4. "Crear instrumento" cierra el modal y salta a "crear" **perdiendo todo el contexto del reto** — el docente debe volver a escribir tema, área y competencia a mano. | **P2** |
| B7 | **Crear reto con IA** | `retoView === "crear"` | `App.jsx:3496` `ChallengeCreator` | 🔴 **Rota** | Genera bien vía `/api/generate-session` con `mode:"challenge"`, pero **guarda con `tipo:"challenge"` y ningún archivo SQL permite ese valor** en el `CHECK` de `materiales_docente.tipo`. Cada reto falla al guardarse; el `catch` muestra el error crudo de Postgres. El crédito ya se gastó y el trabajo se pierde. | **P0** |
| B8 | **Estudio de creación (REPO)** | `activeSection === "crear"` | `App.jsx:2334` `CreateStudio` | 🟠 Problemática | 10 herramientas en 3 secciones, todas rotuladas "CREAR CON IA". **5 de las 10 son maquetas** (ver bloque C). "Proyecto STEAM" usa `SteamGenerator` con `documentType="project"`, que llama al mismo endpoint con `SESSION_SCHEMA` → produce una sesión, no un proyecto. | **P0** |
| B9 | **Estudio de creación (PROD)** | `activeSection === "crear"` | generado por el codemod §3 | 🔵 Funcional pero mejorable | Rediseño en 2 niveles (categoría → herramienta): Fichas, Juegos, Instrumentos, Planificación. **Mejora real.** Pero "Sesión de aprendizaje" y "Clase completa" **no aparecen en el catálogo**: solo se alcanzan desde el dashboard vía `initialCreation`. La función más importante del producto no está en el menú de creación. | **P1** |
| B10 | **Generador de sesión** | `creation === "session"` | `App.jsx:885` `SteamGenerator` | 🟠 Problemática | El motor del producto y está bien construido pedagógicamente. Pero: **4 llamadas a Gemini sin consumir créditos** (`:949`); si falla el módulo 3 de 4 se pierde todo, sin reintento ni reanudación; el guardado falla en silencio (`:989`, `catch{console.error}`); sin `AbortController`; asistente de 3 pasos sin autoguardado. | **P0** |
| B11 | **Proyecto STEAM (PROD)** | `creation === "project-v2"` | codemod → `ProjectSteamGenerator` | 🔵 Funcional pero mejorable | Endpoint dedicado con `PROJECT_SCHEMA` propio, ruta semanal y sesiones. **Sin consumo de créditos** (`api/generate-project-steam.js` solo valida el token). | **P0** |
| B12 | **Ficha de trabajo (PROD)** | `creation === "worksheet-v2"` | codemod → `ResourceFromAI` | 🔵 Funcional pero mejorable | Usa `/api/generate-session-resource`, **sí consume crédito**. El guardado va en `try/catch` con `console.error` → pérdida silenciosa. | **P1** |
| B13 | **Ficha de lectura (PROD)** | `creation === "reading-v2"` | codemod → `ResourceFromAI` | 🟠 Problemática | Igual que B12, pero guarda con `tipo:"reading"`, permitido **solo** por `supabase-session-flow-v2.sql`. Si `supabase-session-resources.sql` se ejecutó de último, este tipo está prohibido y todo guardado falla. Depende del orden de migración. | **P0** |
| B14 | **Escala de valoración (PROD)** | `creation === "rating-scale"` | codemod → `ValuationScaleGenerator` | 🔵 Funcional pero mejorable | Consume crédito correctamente. Mismo guardado silencioso. | **P1** |
| B15 | **Rúbrica / Lista de cotejo** | `creation === "rubric"` \| `"checklist"` | `App.jsx:1139` `EvaluationInstrumentGenerator` | 🔵 Funcional pero mejorable | Exportación a Word de alta calidad (`downloadRubricWord`, `downloadChecklistWord`). Vía `/api/generate-session` → **sin consumo de créditos**. Guardado silencioso (`:1179`). | **P1** |
| B16 | **Sopa de letras** | `creation === "wordsearch"` | `App.jsx:1640` `WordSearchGenerator` | 🟢 Excelente | Único generador con algoritmo real propio: `generateWordSearchGrid` (`:1209`) coloca palabras en 8 direcciones, y `generateWordSearchImage` (`:1298`) dibuja en canvas versión estudiante y solucionario. No usa IA y no la necesita. Sin coste. | **P3** |
| B17 | **Crucigrama** | `creation === "crossword"` | `App.jsx:1950` `CrosswordGenerator` | 🔴 **Rota — en producción** | `setTimeout(1200)` y devuelve las pistas que el docente pegó. **No construye ninguna cuadrícula.** El `.docx` es el título más la lista de pistas. Etiquetada "CREAR CON KANTU" en la categoría Juegos. Presente y accesible en producción. | **P0** |
| B18 | **Clase completa (PROD)** | `creation === "complete"` desde el banner | codemod → `CompleteClassFlow` | 🟡 Incompleta | Encadena Sesión → Instrumento → Material. Es la mejor idea de producto del proyecto. Pero solo se alcanza desde el banner del dashboard, hereda todos los problemas de B10, y **consume 4 llamadas sin cuota más 1-2 con cuota**: contabilidad de créditos incoherente dentro de un mismo flujo. | **P1** |
| B19 | **Biblioteca — Mis creaciones** | `activeSection === "biblioteca"`, `libraryTab === "creaciones"` | `App.jsx:3728-3733` | 🟠 Problemática | Buscador, 3 filtros y ordenación: es la mejor pantalla de gestión. Pero `materialTypeLabel` (`:3619`) solo mapea 5 tipos, mientras la base admite hasta 9 → los materiales V2 aparecen como "Material" genérico. El desplegable de tipos tampoco incluye `worksheet`, `reading` ni `rating_scale`: **son invisibles al filtrar**. El filtrado y la ordenación se recalculan en cada render sin `useMemo` (`:3622`). "Descargar" usa `materialContentText`, un volcado de texto plano, no el exportador Word bueno. | **P1** |
| B20 | **Biblioteca — Guardados** | `libraryTab === "guardados"` | `App.jsx:3735` | 🟠 Problemática | Solo `localStorage` (`sciverse-saved-resources`). No se sincroniza con Supabase: cambiar de navegador o limpiar datos borra todos los favoritos sin aviso ni forma de recuperarlos. | **P1** |
| B21 | **Biblioteca — Plantillas** | `libraryTab === "plantillas"` | `App.jsx:3737` | 🔵 Funcional pero mejorable | Descargas Word desde `TEMPLATE_CONTENT` (`:702`). Contenido estático sin vista previa: hay que descargar para saber qué contiene. | **P3** |
| B22 | **Visor de material** | Clic en "Abrir" → `selectedMaterial` | `App.jsx:3521` `MaterialViewerModal` | 🟡 Incompleta | Solo lectura. **No se puede editar nada.** Un docente que quiera cambiar una palabra debe regenerar (gastando otro crédito) o editar el Word descargado. `MaterialContentView` renderiza JSON de forma recursiva y genérica, sin formato por tipo. | **P1** |
| B23 | **Mi cuenta — Perfil** | Botón "Mi cuenta" → pestaña Perfil | `App.jsx:3535` `TeacherAccountModal` | 🟠 Problemática | Guarda solo en `user_metadata` (`:3547`), **nunca en la tabla `docentes`** → divergencia permanente con lo que ve el admin. El aviso "los cambios se verán completamente al volver a iniciar sesión" reconoce el problema en lugar de resolverlo. Sin cambio de correo, sin cambio de contraseña, **sin eliminar cuenta** (exigible por protección de datos). | **P0** |
| B24 | **Mi cuenta — Plan** | Pestaña Plan | `App.jsx:3572` | 🔴 **Rota** | Muestra `Usage` con valores **literales inventados**: `current="0" total="1"` para generaciones, `0/5` materiales, `0/5` descargas. No consulta `/api/credits` ni `get_ai_credit_status()`. El docente **no tiene forma de saber cuántas generaciones le quedan** en ninguna parte del producto. | **P0** |
| B25 | **Mi cuenta — Referidos** | Pestaña Referidos | `App.jsx:3574` | 🔴 **Rota** | Genera `?ref=` con los 8 primeros caracteres del `userId`, pero **nada lee el parámetro `ref`**. Las estadísticas están fijas en `0` y `0`. Es una función completamente simulada. | **P1** |
| B26 | **Mi cuenta — Capacitación** | Pestaña Capacitación | `App.jsx:3576` | 🟡 Incompleta | Contenido estático. "Fecha y horario por confirmar". Enlace a WhatsApp. Sin calendario, inscripción ni historial. | **P2** |
| B27 | **Mi cuenta — Integraciones** | Pestaña Integraciones | `App.jsx:3577` | 🟡 Incompleta | Google Drive y Canva con botón `disabled` y etiqueta "Próximamente". Vitrina sin funcionalidad. | **P3** |
| B28 | **Barra lateral** | Siempre visible con sesión | `App.jsx:3657-3670` | 🔵 Funcional pero mejorable | 5 secciones. "Plan actual: Gratuito" **codificado en duro** (`:3661`), ignora `profile.plan`. Sin indicador de créditos restantes. | **P1** |
| B29 | **Barra superior** | Siempre visible con sesión | `App.jsx:3672-3681` | 🟠 Problemática | **Duplica** la marca y el botón de cerrar sesión que ya están en la barra lateral. Dos salidas idénticas en la misma pantalla. | **P2** |
| B30 | **Navegación móvil** | `< 900px` | `App.jsx:3683` | 🔵 Funcional pero mejorable | 5 pestañas inferiores. Sin acceso a "Mi cuenta" ni a "Cerrar sesión" en móvil salvo por la barra superior. | **P2** |
| B31 | **Pie de la aplicación** | Siempre visible con sesión | `App.jsx:3740` | 🔵 Funcional pero mejorable | Una línea de texto. Sin enlaces legales, ayuda ni contacto — que sí existen en la landing pública. | **P3** |

---

## C. Pantallas rotas por simulación

Cinco generadores comparten el mismo antipatrón: `setTimeout(1200)` que simula latencia y devuelve el eco del formulario. Ninguno hace una llamada de red.

| # | Componente | Línea | Devuelve | En producción |
|---|---|---|---|---|
| C1 | `CrosswordGenerator` | `App.jsx:1950` | Las pistas pegadas por el docente, sin cuadrícula | 🔴 **SÍ — accesible en "Juegos"** |
| C2 | `LearningUnitGenerator` | `App.jsx:2027` | `{titulo, duracion, sesiones: 8}` — el 8 es constante | ⚪ No (queda como código muerto) |
| C3 | `WorksheetGenerator` | `App.jsx:2107` | Eco del formulario | ⚪ No (reemplazado por `ResourceFromAI`) |
| C4 | `ReadingGenerator` | `App.jsx:2183` | `{titulo, tema, nivel}` — sin texto de lectura | ⚪ No (reemplazado por `ResourceFromAI`) |
| C5 | `EvaluationSheetGenerator` | `App.jsx:2258` | Eco del formulario | ⚪ No |

C2-C5 quedan inalcanzables tras el codemod pero **siguen compilándose en el bundle**: ~300 líneas de peso muerto enviadas a cada usuario.

**C1 es el hallazgo grave**: está publicado, rotulado "CREAR CON KANTU", y no genera nada.

---

## D. Panel de administración

| # | Pantalla | Ruta | Archivo | Estado | Problemas | Prioridad |
|---|---|---|---|---|---|---|
| D1 | Acceso admin | `/?admin=1` | `AdminPanel.jsx:36` | 🟠 Problemática | Formulario de una sola clave compartida, sin usuario ni rol. Sin límite de intentos → fuerza bruta viable. | **P0** |
| D2 | Listado de docentes | tras autenticar | `AdminPanel.jsx:66` | 🟠 Problemática | El secreto viaja en la **query string** (`AdminPanel.jsx:23`) → queda en logs de Vercel, historial del navegador y cabecera `Referer`. El endpoint hace `select("*")` **sin paginación** y devuelve nombre, correo, celular e institución de todos los docentes en una sola respuesta. Solo lectura: no permite desactivar cuentas, cambiar plan ni ajustar créditos. Y lee de `docentes`, tabla **desactualizada** desde el primer cambio de perfil. | **P0** |

---

## E. Pantallas muertas o legado

Existen en el repositorio y se compilan, pero ninguna interacción del usuario puede alcanzarlas.

| # | Pantalla | Archivo | Líneas | Motivo |
|---|---|---|---|---|
| E1 | `RegistrationGate` completo | `App.jsx:2855-3298` | ~440 | Sustituido por `AuthGate.jsx`. El raíz `SciVerseDocentes` (`:3531`) usa `AuthGate`, nunca este. |
| E2 | Landing antigua | `App.jsx:3078-3290` | ~210 | **Código inalcanzable tras un `return`.** Hay un `return (<ImprovedLanding .../>)` en `:3078` y después `const FEATURES = [...]` con un segundo `return` que nunca se evalúa. |
| E3 | `LoginModal` | `App.jsx:2695` | ~66 | Definido y jamás renderizado. Login vive en `AuthGate`. |
| E4 | `PasswordRecoveryModal` | `App.jsx:2761` | ~60 | Solo lo usa `RegistrationGate` (muerto). |
| E5 | `ResetPasswordPage` | `App.jsx:2617` | ~78 | Solo lo usa `RegistrationGate` (muerto). |
| E6 | `AnimalCellLab` | `AnimalCellLab.jsx` | 398 | Laboratorio 3D de célula animal. **Nunca importado en ningún archivo.** |
| E7 | `CreditsIndicator` | `components/CreditsIndicator.jsx` | 134 | Único consumidor de `/api/credits`. Al no importarse, **el endpoint queda huérfano y el docente nunca ve sus créditos.** |
| E8 | `SessionNextFlow` | `components/SessionNextFlow.jsx` | 248 | Flujo completo Sesión→Instrumento→Material con 7 tipos de recurso. El codemod reimplementó lo mismo en línea; este archivo quedó sin uso. |
| E9 | `SessionResourcesPanel` | `components/SessionResourcesPanel.jsx` | 1.181 | Panel de recursos con exportadores Word propios. Nunca importado. |
| E10 | `src/App.jsx` | `src/App.jsx` | 1.897 | Versión anterior completa. `index.html` carga `/main.jsx` de la raíz. |
| E11 | `src/AdminPanel.jsx` | `src/AdminPanel.jsx` | 103 | Byte a byte idéntico al de la raíz. |
| E12 | `src/main.jsx`, `src/supabaseClient.js`, `src/index.css` | `src/` | ~15 | Puntos de entrada de la versión muerta. |

**Total inalcanzable: ~4.000 líneas** sobre ~8.900 versionadas.

---

## Resumen cuantitativo

| Categoría | Cantidad |
|---|---|
| Públicas (A) | 9 |
| De aplicación (B) | 31 |
| Rotas por simulación (C) | 5 (1 en producción) |
| Administración (D) | 2 |
| **Total alcanzable** | **31** (excluyendo variantes REPO/PROD duplicadas y contando C1 dentro de B17) |
| Muertas o legado (E) | 12 |

### Por estado

| Estado | Cantidad |
|---|---|
| 🟢 Excelente | 2 (Actividades STEAM, Sopa de letras) |
| 🔵 Funcional pero mejorable | 14 |
| 🟡 Incompleta | 5 |
| 🟠 Problemática | 9 |
| 🔴 Rota | 5 (B7, B17/C1, B24, B25, + C2-C5 fuera de producción) |
| ⚫⚪ Legado / no usada | 12 |

### Pantallas que exigen atención inmediata

1. **B7 — Crear reto con IA**: ningún reto se guarda jamás (violación de `CHECK`).
2. **B17 — Crucigrama**: publicado, rotulado como IA, no genera nada.
3. **B24 — Mi cuenta / Plan**: cifras de consumo inventadas; el docente no puede saber sus créditos.
4. **B2 — Dashboard de producción**: sin forma de retomar trabajo; botón "Pregúntale a Kantu" sin destino.
5. **B23 — Mi cuenta / Perfil**: los cambios nunca llegan a la base de datos; sin eliminar cuenta.
6. **A3 — Confirmación de correo**: sin reenvío; punto muerto si el correo no llega.
7. **D1/D2 — Administración**: secreto en la URL y volcado de PII sin paginación.
