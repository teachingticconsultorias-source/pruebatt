# Cómo viaja el dato del docente a Gemini y vuelve

Documento de referencia técnica. Describe el recorrido REAL, leído del código,
no el que debería existir. Sin secretos ni ejemplos con datos personales.

```
DOCENTE
  ↓ escribe en el formulario                     App.jsx · useState del generador
FORM
  ↓ validación de paso                           nextStep() · no avanza sin lo obligatorio
VALIDACIÓN
  ↓ (opcional) pide ayuda                        lib/kantu/useSugerencia.js
KANTU ──── propuesta ──── el docente pulsa «Usar» ──→ vuelve al FORM
  ↓                       si cierra, el form no se toca
NORMALIZACIÓN
  ↓ construirContextoKantu()                     lib/kantu/contexto.js
API
  ↓ POST /api/generate-session                   cabecera Idempotency-Key
PROMPT
  ↓ formContext() + modulePrompt()               api/generate-session.js
GEMINI
  ↓ generateJson()                               api/_lib/gemini.js · responseSchema
SCHEMA VALIDATION
  ↓ MODULE_SCHEMAS + _lib/quality.js
UI
  ↓ componerSesion()                             lib/sesion/modulos.js
BIBLIOTECA
  ↓ saveTeacherMaterial()                        materiales_docente
DOCX
     lib/docx/                                   sobre el mismo objeto guardado
```

## 1 · Campos del docente, uno a uno

Herramienta de referencia: **Sesión de aprendizaje** (la más completa; las demás
son subconjuntos declarados en `CAMPOS_POR_HERRAMIENTA`).

| Campo | Nace en | Validación front | Kantu | Gemini | Word | Biblioteca |
| --- | --- | --- | --- | --- | --- | --- |
| `nivel` | paso 1 · select | obligatorio | sí | sí | sí | sí |
| `grado` | paso 1 · select | obligatorio | sí | sí | sí | sí |
| `seccion` | paso 1 · texto | libre | **no** | **no** | sí | sí |
| `area` | paso 1 · select por nivel | obligatorio | sí | sí | sí | sí |
| `region` | paso 1 · select | obligatorio | sí | sí | sí | sí |
| `fecha` | paso 1 · date | obligatorio | **no** | **no** | sí | sí |
| `duracion` | paso 1 · select | obligatorio | sí | sí | sí | sí |
| `tema` | paso 2 · texto | obligatorio | sí (ancla) | sí | sí (título) | sí |
| `competencia` | paso 2 · select | obligatorio | sí | sí | sí | sí |
| `capacidades` | paso 2 · checkboxes | ≥ 1 | sí | sí | sí | sí |
| `proposito` | paso 2 · textarea + Kantu | obligatorio | sí | sí | sí | sí |
| `contexto` | paso 2 · textarea + Kantu | obligatorio | sí | sí | **no** | sí |
| `evidencia` | paso 2 · textarea + Kantu | obligatorio | sí | sí | sí | sí |
| `recursos` | paso 2 · texto | libre | sí | sí | **no** | sí |
| `steam` | paso 2 · switch | — | **no** | sí (`STEAM: sí/no`) | sí (áreas) | sí |
| `inclusivo` | paso 2 · switch | — | **no** | sí (`DUA: sí/no`) | vía DUA | sí |

**Campos capturados que NO llegan a Gemini, y por qué está bien:** `seccion` y
`fecha` son datos administrativos del encabezado. Meterlos en el prompt gastaría
presupuesto sin cambiar una línea de la sesión; llegan enteros al Word y a la
biblioteca, que es donde sirven.

**Campos capturados que NO llegan a Kantu:** los dos switches. Una sugerencia de
propósito no cambia porque la sesión sea STEAM.

**Ruta muerta detectada:** `SteamGenerator` acepta `documentType` con cuatro
valores (`session`, `project`, `rubric`, `checklist`) pero el único enrutado es
`session`. Las otras tres ramas no son alcanzables desde la interfaz.

## 2 · Kantu

| | |
| --- | --- |
| Endpoint | `POST /api/generate-session` con `mode: "suggestion"` |
| Contexto | `construirContextoKantu(herramienta, form)` → pares etiqueta/valor |
| Presupuesto | `maxOutputTokens: 800` · `thinkingLevel: "minimal"` |
| Crédito | **ninguno**: el modo sugerencia responde antes de `withCredit()` |
| Doble clic | `enCurso` es una `ref`, se comprueba antes de la petición |
| Errores | `mensajeDeError()` → toast; nunca un código ni un JSON |
| Espera | el texto cambia a los 6 s; no se cancela nada |

La regla que **no se toca**: la propuesta se guarda en `propuesta` y se enseña en
`SuggestionModal`. El formulario sólo cambia en el `onUsar` del modal. Cerrar,
reintentar o fallar dejan el formulario exactamente como estaba. El hook no
importa ni `setForm` ni `update`, así que no puede escribir aunque quisiera.

Los campos vacíos no viajan, y cada valor se recorta a un tope por campo
(`LIMITES`), porque 800 tokens se comparten con el razonamiento.

## 3 · Lo que recibe Gemini

`formContext(form)` produce el bloque que encabeza los cuatro módulos:

```
Nivel · Grado · Área · Región
Tema · Duración total
Competencia oficial · Capacidades oficiales
Propósito propuesto · Contexto · Evidencia
Recursos disponibles · DUA · STEAM
```

Además, `modulePrompt()` añade por módulo:

| Módulo | Añade | Presupuesto |
| --- | --- | --- |
| `alignment` | nada más: parte del contexto | 5000 · medium |
| `sequence` | alineación aprobada + **procesos didácticos del área** | 6000 · low |
| `assessment` | alineación + secuencia | 5000 · medium |
| `annexes` | alineación + secuencia + evaluación | 6500 · medium |

Los procesos didácticos salen de `DIDACTIC_PROCESSES`, indexados por área ya
normalizada (`normalizarArea`), y para Ciencia y Tecnología, Comunicación,
Castellano L2 e Inglés se elige la ruta según la competencia. No hay una
segunda fuente de verdad en el navegador: el catálogo de `config/curriculum.js`
gobierna qué áreas existen; el servidor decide los procesos de cada una.

## 4 · Jerarquía de la información

De mayor a menor autoridad. Gemini ocupa el último lugar y **nunca** contradice
un nivel superior:

1. **Lo que el docente escribió** — tema, propósito, contexto, evidencia.
2. **Lo que el docente seleccionó** — nivel, grado, área, región, competencia,
   capacidades, duración.
3. **Sugerencias de Kantu aceptadas explícitamente** — que en cuanto se aceptan
   son indistinguibles del nivel 1, porque viven en el mismo campo.
4. **Catálogo curricular local** — `config/curriculum.js` y
   `GENERATOR_COMPETENCIES`. Resuelto en el navegador, sin consultar a nadie.
5. **Instrucciones pedagógicas del sistema** — `SYSTEM_INSTRUCTION` y los
   prompts por módulo.
6. **Inferencias de Gemini** — sólo para lo que nadie dio.

En la práctica esto se sostiene porque los niveles 1 a 4 viajan como TEXTO
LITERAL dentro del prompt y el esquema de respuesta no tiene campos para
`nivel`, `grado`, `área` ni `región`: el modelo no puede devolverlos y por tanto
no puede cambiarlos. El documento final los toma del formulario, no de la
respuesta (`componerSesion()` lee `form.area`, `form.competencia`,
`form.capacidades`).

Comprobado en `tests/flujo-datos.test.jsx` con el caso DPCC · Puno · 3.º de
Secundaria: los valores aparecen literalmente en el prompt, el área no se
sustituye, y los procesos didácticos son los de DPCC y no los de Matemática.

## 5 · Validación de la respuesta

| Riesgo | Dónde se corta |
| --- | --- |
| JSON incompleto o truncado | `finishReason === "MAX_TOKENS"` → `AI_INCOMPLETE`, sin reintento automático |
| Campos requeridos ausentes | `responseSchema` con `required` por módulo |
| Estructura inválida | `JSON.parse` dentro de `generateJson()` |
| Placeholders y vacíos | `api/_lib/quality.js` → `GENERATION_INCOMPLETE` |
| `undefined` · `null` · `[object Object]` | `clean()` en `lib/docx/core.js` antes de imprimir |
| Proveedor caído o saturado | 429/5xx con reintento y respaldo; luego `AI_BUSY` |

## 6 · Errores que ve la docente

Un solo sitio: `lib/mensajes.js`. El servidor ya traduce los suyos
(`api/_lib/errors.js`) y jamás manda un stack ni el mensaje crudo del
proveedor. El navegador añade lo que el servidor no puede saber —red caída,
navegador sin conexión— y filtra cualquier texto que huela a técnico
(`MAX_TOKENS`, `PGRST`, `TypeError`, códigos HTTP) antes de publicarlo.

## 7 · Observabilidad

Lo que se registra en Vercel por generación, y nada más:

```
requestId · tool · module · model · attempt · maxOutputTokens · thinkingLevel
finishReason · blockReason · textLength · tokens{pensamiento,salida} · durationMs
```

No se registra: nombre del docente, correo, teléfono, el prompt completo, la
respuesta de Gemini, comprobantes, JWT ni claves. El log de idempotencia guarda
la clave de operación y la herramienta; nunca el contenido.

Con esos campos ya se pueden contar, leyendo los logs, las métricas que
importan: generaciones iniciadas y terminadas, tasa de fallo por módulo,
duración media y p95, 429 del proveedor, truncados por `MAX_TOKENS` y reintentos.
No hay plataforma externa instalada y esta fase no añade ninguna.
