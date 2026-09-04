# 00 — Resumen ejecutivo

**Proyecto:** SciVerse para Docentes (Teaching TIC Consultorías S.A.C.)
**Fecha de auditoría:** 3 de septiembre de 2026
**Commit auditado:** `e49c68c` (rama `main`)
**Alcance:** repositorio completo — frontend, API serverless, SQL de Supabase, build, assets, documentación.
**Naturaleza:** análisis únicamente. No se modificó, ejecutó ni desplegó ningún archivo de la aplicación.

---

## 1. Estado del producto

SciVerse es una **SPA de React 18 + Vite**, desplegada en Vercel, con Supabase Auth/Postgres y Google Gemini como motor de generación. Está dirigida a docentes peruanos y produce sesiones de aprendizaje, instrumentos de evaluación y materiales alineados al CNEB, descargables en Word.

**El producto funciona y tiene valor pedagógico real.** El generador de sesiones en 4 módulos (alineación → secuencia → evaluación → anexos) es genuinamente bueno: los prompts conocen procesos didácticos por área curricular, respetan competencias y capacidades CNEB literales, y la exportación a Word produce documentos formateados con tablas listos para entregar. Eso es el corazón del producto y está bien hecho.

Pero el proyecto **no está construido como un producto**: está construido como una serie de parches acumulados. La evidencia está en el propio repositorio — `LEEME_PRIMERO.txt`, `PASOS.txt`, `INSTRUCCIONES_SCIVERSE_V2.txt` describen un flujo de trabajo donde las mejoras llegan en ZIP y se aplican **editando archivos a mano en la interfaz web de GitHub**, sin entorno local, sin `npm install`, sin pruebas.

Ese modelo de entrega explica casi todos los defectos graves que siguen.

### Clasificación general

| Dimensión | Estado |
|---|---|
| Valor pedagógico del núcleo (sesiones, instrumentos) | **Bueno** |
| Calidad de prompts / IA | **Buena** |
| Exportación a Word | **Buena** |
| Arquitectura frontend | **Deficiente** |
| Proceso de build y despliegue | **Crítico** |
| Modelo de datos y coherencia con el código | **Deficiente** |
| Seguridad y control de costos | **Crítico** |
| UX del recorrido docente | **Regular** |
| UI / sistema de diseño | **Regular** |
| Accesibilidad | **Deficiente** |
| Testing y observabilidad | **Inexistente** |

**Valoración general: 4.5 / 10.** Un núcleo valioso envuelto en una base técnica que no soporta crecimiento. La buena noticia: casi todo lo grave es reparable sin reescribir el producto, porque el valor está en los prompts y en la lógica de documentos, y ambos se conservan íntegros.

---

## 2. Principales fortalezas

1. **Generación de sesiones por módulos encadenados.** `api/generate-session.js` divide la sesión en 4 llamadas donde cada una recibe el resultado de la anterior. Evita el truncamiento por `MAX_TOKENS` y produce coherencia interna. Es una decisión de diseño acertada.
2. **Prompts con conocimiento de dominio real.** `DIDACTIC_PROCESSES` (`api/generate-session.js:132-146`) mapea procesos didácticos oficiales por área y competencia — indagación, explicación, diseño tecnológico, los tres momentos de lectura, etc. Esto no es genérico; es criterio pedagógico peruano codificado.
3. **`responseSchema` de Gemini en todos los endpoints reales.** Se fuerza JSON estructurado en lugar de parsear texto libre. Reduce drásticamente la fragilidad del output.
4. **Exportación a Word de calidad profesional.** `downloadSessionWord`, `downloadRubricWord`, `downloadChecklistWord` (`App.jsx:141-291`) generan tablas, encabezados, numeración de páginas y datos del docente. Es el entregable que el docente realmente necesita.
5. **RLS correctamente planteada en `materiales_docente`.** Las cuatro políticas (select/insert/update/delete) están ancladas a `auth.uid() = user_id`. El aislamiento entre docentes es correcto en esa tabla.
6. **Sistema de créditos bien diseñado a nivel SQL.** `consume_ai_credit()` usa `SELECT ... FOR UPDATE` para evitar doble consumo concurrente, y existe `refund_ai_credit()` para devolver el crédito si Gemini falla. El diseño es sólido — el problema es que casi nadie lo llama (ver debilidad 3.3).
7. **Identidad visual con carácter.** La paleta teal/coral/amarillo, la mascota Kantu (vicuña científica) y el tono en español peruano dan personalidad. Hay una marca que vale la pena conservar y profesionalizar.

---

## 3. Principales debilidades

### 3.1 El build reescribe el código fuente (crítico)

`package.json` define:

```json
"build": "node apply-sciverse-v2.mjs && vite build"
```

`apply-sciverse-v2.mjs` es un script de **89 KB** que hace búsqueda-y-reemplazo de cadenas sobre `App.jsx` e `index.css`, los sobrescribe en disco, y **genera un endpoint nuevo** (`api/generate-project-steam.js`) que no existe en el repositorio.

Consecuencias verificadas ejecutando el script sobre una copia aislada:

- **El código que se lee en el repositorio no es el que corre en producción.** `App.jsx` tiene 3.776 líneas; tras el codemod tiene 4.221. El `CreateStudio` y el dashboard son completamente distintos.
- **No es idempotente.** La segunda pasada lanza `Error: No pude aplicar el cambio: iconos del dashboard`. Un segundo `npm run build` local siempre falla.
- **Ensucia el árbol de trabajo.** Al construir localmente, `App.jsx`, `index.css` y `api/generate-project-steam.js` quedan modificados y sin entrada en `.gitignore`, listos para ser commiteados por accidente.
- **Cualquier edición sobre una de las cadenas ancla rompe el despliegue.** `mustReplace` lanza excepción si no encuentra el texto exacto. Hay 9 anclas (verificado: 9 llamadas `app = mustReplace(...)`). Editar `App.jsx` es jugar a la ruleta con producción.
- **`PASOS.txt` documenta que esto ya rompió Vercel una vez** (`SyntaxError: Unexpected identifier 'Bearer'`).

Este es el problema número uno del proyecto. Mientras exista, ninguna mejora es segura.

### 3.2 El perfil del docente vive en dos lugares que nunca se sincronizan

`AuthGate.jsx:46-57` construye el perfil **exclusivamente desde `session.user.user_metadata`**. La tabla `docentes` nunca se lee desde la aplicación.

Pero el trigger `crear_perfil_docente()` sí escribe en `docentes`, y `TeacherAccountModal.saveProfile()` (`App.jsx:3547`) guarda los cambios **solo en metadata**, nunca en la tabla.

Resultado: la tabla `docentes` queda congelada en los valores del registro. El panel administrativo lee `docentes` y por tanto **muestra datos obsoletos**. Los campos `plan`, `activo`, `ai_week_used` y `ai_weekly_limit` existen en la tabla pero la interfaz nunca los consulta — por eso el sidebar muestra `Plan actual: Gratuito` en texto fijo (`App.jsx:3661`) y "Mi cuenta" muestra `Generaciones con IA 0 / 1` (`App.jsx:3572`) con números inventados.

### 3.3 El límite de 5 generaciones semanales no protege la ruta principal

Hay dos familias de endpoints:

| Endpoint | ¿Consume crédito? |
|---|---|
| `api/generate-session.js` | **No** |
| `api/generate-project-steam.js` (generado en build) | **No** |
| `api/generate-session-resource.js` | Sí |
| `api/generate-linked-worksheet.js` | Sí |
| `api/generate-with-quota.js` | Sí — pero **nadie lo llama** |

El generador de sesiones, que es la función estrella, hace **4 llamadas a Gemini por sesión** (`App.jsx:949`) contra `/api/generate-session`, que solo valida que el token sea válido y no toca los créditos. Un docente autenticado puede generar sesiones ilimitadas.

`api/generate-with-quota.js` fue escrito precisamente para envolver ese endpoint, pero está **huérfano**: no aparece referenciado en ningún archivo del frontend, ni en el codemod. El mecanismo de control de gasto existe, funciona, y está desconectado.

### 3.4 Los retos grupales nunca se guardan

`App.jsx:3503` guarda con `tipo:"challenge"`. Ninguno de los cuatro archivos SQL incluye `'challenge'` en el `CHECK` de `materiales_docente.tipo`:

- `supabase-schema.sql` → `session, project, rubric, checklist`
- `supabase-session-flow-v2.sql` → los 4 anteriores + `observation_guide, rating_scale, worksheet, reading, questionnaire`
- `supabase-session-resources.sql` → `session, project, rubric, checklist, worksheet, rating_scale`

Cada reto generado por IA **falla al guardarse** con violación de `CHECK`, y el `catch` muestra el mensaje crudo de Postgres al docente. El crédito ya se gastó y el trabajo se pierde.

Peor: los dos últimos archivos SQL **se contradicen entre sí**. El que se haya ejecutado de último decide si `reading` y `questionnaire` son válidos. La interfaz de producción ofrece "Ficha de lectura" (`tipo:"reading"`); si `supabase-session-resources.sql` corrió al final, esa función también falla al guardar.

### 3.5 Herramientas presentadas como IA que no llaman a ninguna IA

Cinco generadores en `App.jsx` son maquetas: un `setTimeout(1200)` que simula carga y devuelve los datos que el propio docente escribió.

| Componente | Línea | Qué devuelve |
|---|---|---|
| `CrosswordGenerator` | 1950 | Repite las pistas pegadas por el docente. **No genera crucigrama.** |
| `LearningUnitGenerator` | 2027 | `{titulo, duracion, sesiones: 8}` — el 8 es constante |
| `WorksheetGenerator` | 2107 | Eco del formulario |
| `ReadingGenerator` | 2183 | `{titulo, tema, nivel}` — **ningún texto de lectura** |
| `EvaluationSheetGenerator` | 2258 | Eco del formulario |

En la interfaz aparecen bajo la etiqueta **"CREAR CON IA"**, y el botón "Descargar" produce un `.docx` de dos líneas. En la build de producción cuatro quedan inalcanzables (siguen ocupando bundle), pero **`CrosswordGenerator` sigue publicado** dentro de la categoría "Juegos". Un docente que use "Crucigrama" recibe una lista de sus propias pistas.

Esto no es solo deuda técnica: es una promesa incumplida al usuario.

### 3.6 Sin router, sin URLs, sin historial

Toda la navegación es `useState` (`activeSection`, `creation`, `category`, `libraryTab`, `retoView`). No hay `react-router` ni manejo de `history`.

Impacto directo en el docente: no puede compartir un enlace a un recurso, el botón Atrás del navegador sale de la aplicación, recargar la página lo devuelve al inicio perdiendo el trabajo en curso, y no existen enlaces profundos para soporte ni para campañas.

### 3.7 Pérdida silenciosa de trabajo

`saveTeacherMaterial` se llama dentro de `try { ... } catch (e) { console.error(e) }` en las tres rutas principales (`App.jsx:989`, `App.jsx:1179`, y `ResourceFromAI` en la build). Si el guardado falla — por el `CHECK` de `tipo`, por sesión vencida, por red — **el docente ve el recurso en pantalla y cree que está guardado**. No aparece nunca en su biblioteca y no hay aviso.

No hay autoguardado, ni borradores, ni reintentos, ni recuperación. Si la tercera de las cuatro llamadas del generador falla, se pierde todo el formulario y el trabajo previo.

### 3.8 Repositorio contaminado

- **3 archivos ZIP** con copias completas de versiones anteriores (v5, v8, v9) — 223 KB versionados.
- **`src/` completo duplicado y muerto.** `index.html` carga `/main.jsx` (raíz). Todo `src/` (`App.jsx` de 1.897 líneas, `AdminPanel.jsx`, `main.jsx`, `supabaseClient.js`, `index.css`) es una versión antigua que no se compila.
- **`components/` completo muerto.** Los cuatro componentes (1.563 líneas) no se importan en ninguna parte. `SessionNextFlow.jsx` y `SessionResourcesPanel.jsx` son implementaciones completas de los recursos V2 que el codemod reescribió en línea.
- **~440 líneas muertas dentro de `App.jsx`**: `RegistrationGate` (2855-3298) y `LoginModal` (2695) quedaron obsoletos al pasar a `AuthGate.jsx`, y hay **código inalcanzable después de un `return`** (`App.jsx:3078-3290`): una landing completa anterior.
- **Dos lockfiles simultáneos** (`package-lock.json` y `pnpm-lock.yaml`) más `pnpm-workspace.yaml`. Vercel elige gestor según lo que detecte; las instalaciones no son deterministas.
- **6 archivos `.txt`** de instrucciones manuales, `package-fallback.json`, `AnimalCellLab.jsx` (398 líneas, nunca importado).

Balance: de aproximadamente 8.900 líneas JSX versionadas, **cerca de 4.000 no se ejecutan jamás**.

---

## 4. Riesgos

| # | Riesgo | Prob. | Impacto | Severidad |
|---|---|---|---|---|
| R1 | Gasto descontrolado en Gemini: la ruta principal no consume créditos y hace 4 llamadas por sesión | Alta | Alto | **Crítico** |
| R2 | Un despliegue rompe producción porque una edición de `App.jsx` invalida un ancla del codemod | Alta | Alto | **Crítico** |
| R3 | Pérdida silenciosa del trabajo del docente por fallo de guardado no notificado | Alta | Alto | **Crítico** |
| R4 | `ADMIN_SECRET` viaja en query string (`?secret=`) y queda en logs de Vercel e historial del navegador | Media | Alto | **Alto** |
| R5 | Fuga de PII: `/api/list-docentes` devuelve `select("*")` de todos los docentes sin paginación | Media | Alto | **Alto** |
| R6 | Divergencia permanente entre `user_metadata` y la tabla `docentes`; el admin decide sobre datos falsos | Alta | Medio | **Alto** |
| R7 | Orden de ejecución de los SQL determina qué tipos de material se pueden guardar | Media | Alto | **Alto** |
| R8 | Pérdida de confianza del docente al descubrir que "Crucigrama" y otros no generan nada | Alta | Medio | **Alto** |
| R9 | Testimonios con nombres de personas y citas presentados como reales sin evidencia de consentimiento | Media | Medio | **Medio** |
| R10 | Sin pruebas de ningún tipo: cualquier cambio puede romper auth, guardado o generación sin aviso | Alta | Medio | **Medio** |

---

## 5. Oportunidades

1. **El control de gasto ya está construido.** `consume_ai_credit`, `refund_ai_credit` y `generate-with-quota.js` funcionan. Conectarlos es cuestión de horas, no de semanas.
2. **Un solo cambio elimina la mayor fuente de riesgo.** Fusionar el resultado del codemod dentro de `App.jsx` y volver `build` a `vite build` a secas convierte el repositorio en la verdad única. Es la tarea de mayor retorno de todo el backlog.
3. **La biblioteca ya guarda `contenido jsonb` completo.** La base para historial, versiones, duplicado, plantillas y "continuar donde lo dejaste" ya está en la base de datos; falta exponerla.
4. **La ficha de identidad del docente (nivel, grado, área, región) ya se pide en cada formulario.** Elevarla al perfil elimina reescritura repetida y habilita recomendaciones personalizadas.
5. **Los prompts son el activo diferencial.** Extraerlos a un módulo versionado permite iterar calidad pedagógica sin tocar la aplicación, y medir qué versión produce mejores sesiones.
6. **Mercado claro y bien entendido.** El producto habla el idioma del CNEB peruano con precisión. Esa especificidad es una ventaja competitiva difícil de copiar.

---

## 6. Recomendaciones principales

Por orden de ejecución. El detalle está en `20-IMPLEMENTATION-ROADMAP.md` y `19-IMPROVEMENT-BACKLOG.md`.

1. **Eliminar el codemod del build.** Aplicarlo una última vez, commitear el resultado como el nuevo `App.jsx` e `index.css`, commitear `api/generate-project-steam.js`, y dejar `"build": "vite build"`. Añadir `.gitattributes` con `* text eol=lf` para que el árbol de trabajo en Windows deje de divergir del blob de Git.
2. **Cerrar la fuga de costos de IA.** Enrutar `/api/generate-session` y `/api/generate-project-steam` a través del consumo de créditos, y contar la sesión completa (4 módulos) como **una** generación, no cuatro.
3. **Reparar el guardado.** Añadir `'challenge'` al `CHECK` de `tipo`, consolidar los SQL contradictorios en una sola migración autoritativa, y sustituir los `catch` silenciosos por errores visibles con opción de reintento.
4. **Unificar el perfil.** Elegir la tabla `docentes` como fuente de verdad, leerla al iniciar sesión, y escribir en ella al editar el perfil.
5. **Retirar o construir las herramientas falsas.** Como mínimo, quitar "Crucigrama" de producción hasta que genere una cuadrícula real. No dejar publicado nada etiquetado "IA" que no llame a la IA.
6. **Sacar el secreto de administración de la URL** y moverlo a cabecera `Authorization`, con comparación en tiempo constante y limitación de intentos.
7. **Introducir enrutamiento real** con URLs por sección y por recurso.
8. **Dividir `App.jsx`** en módulos por dominio, sin reescribir la lógica — mover, no reformular.
9. **Establecer tokens de diseño** en `:root` y unificar las tres paletas divergentes (`App.jsx` `C`, `AuthGate.jsx` `COLORS`, `AdminPanel.jsx` `C_*`).
10. **Añadir pruebas a los flujos P0** antes del siguiente despliegue: registro, login, generar sesión, guardar, descargar.

---

## 7. Recuento de la auditoría

| Métrica | Cantidad |
|---|---|
| Pantallas y vistas alcanzables | 31 |
| Pantallas muertas o inalcanzables | 12 |
| Endpoints serverless | 7 (6 versionados + 1 generado en build) |
| Endpoints huérfanos | 2 (`generate-with-quota`, `credits`) |
| Tablas Supabase | 2 (`docentes`, `materiales_docente`) |
| Funciones RPC | 3 (`get_ai_credit_status`, `consume_ai_credit`, `refund_ai_credit`) |
| Triggers | 1 (`al_crear_usuario`) |
| Archivos SQL (con contradicciones entre sí) | 4 |
| Líneas JSX versionadas | ~8.900 |
| Líneas JSX que nunca se ejecutan | ~4.000 |
| Hallazgos P0 (ver `16-TECH-DEBT.md`) | 12 |
| Hallazgos P1 | 36 |
| Hallazgos P2 | 31 |
| Hallazgos P3 | 18 |
| **Total de hallazgos** | **97** |
| Mejoras en el backlog (`19-`) | 175 |

---

## 8. Conclusión

SciVerse resuelve un problema real para un usuario concreto, y su núcleo pedagógico está mejor construido de lo que sugiere el estado del repositorio. Lo que falta no es visión de producto ni criterio educativo: falta **ingeniería de base**.

Las tres cosas que hay que arreglar antes que cualquier otra son el **build que reescribe el código**, la **fuga de costos de IA** y la **pérdida silenciosa del trabajo del docente**. Ninguna requiere reescribir el producto. Las tres caben en la Fase 0 del roadmap.

Con esa base estabilizada, el resto del plan — sistema de diseño, dashboard como centro de trabajo, arquitectura de IA con historial y regeneración, administración con roles reales — se construye sobre terreno firme en lugar de sobre parches.

> **Recomendación de primera fase:** no empezar por el rediseño visual. Empezar por Fase 0 (seguridad y estabilidad). Un producto bonito que pierde el trabajo del docente y gasta sin control en IA no es un producto profesional.
