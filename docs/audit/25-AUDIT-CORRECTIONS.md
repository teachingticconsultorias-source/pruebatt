# 25 — Correcciones a la auditoría

Hallazgos de la auditoría original (documentos 00-24) que la implementación del **Bloque B** demostró **incorrectos**. Se registran aquí en lugar de reescribir los documentos, para que quede constancia del error y de cómo se detectó.

---

## C-1 · 🔴 `gemini-3.6-flash` SÍ es un modelo válido

**Dónde lo afirmé mal:** `06-BACKEND-API-AUDIT.md` §3.6 · `08-AUTH-SECURITY-AUDIT.md` P1-8 · `09-AI-GEMINI-AUDIT.md` §2 · `16-TECH-DEBT.md` TD-10 · `19-IMPROVEMENT-BACKLOG.md` B-008 · `21-QUICK-WINS.md` QW-06 · `24-REAL-ENVIRONMENT-BASELINE.md` §2.1

**Lo que afirmé:**

> `gemini-3.6-flash` no corresponde a ningún identificador de modelo publicado por Google. […] Si `GEMINI_MAIN_MODEL` no está definida, **toda generación falla**. […] **Prioridad P0.**

**Lo que es cierto:** `gemini-3.6-flash` es un identificador **válido y estable** de la API de Gemini. Modelo Flash de generación anterior, ventana de contexto de 1M de tokens, disponible desde julio de 2026.

Verificado el 2026-09-03 contra dos fuentes:
- [Models · Gemini API · Google AI for Developers](https://ai.google.dev/gemini-api/docs/models)
- [Gemini 3.6 Flash — Model Card, Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-6-flash/)

**Por qué me equivoqué.** Asumí, a partir de mi conocimiento previo, que la numeración `3.6` no encajaba con ningún esquema de nombres conocido, y no lo verifiqué contra la documentación del proveedor antes de clasificarlo como P0. Fue una conclusión basada en memoria, no en evidencia.

**Impacto de la corrección:**

| Aspecto | Auditoría original | Realidad |
|---|---|---|
| Prioridad | **P0** — indisponibilidad total | **P3** — higiene de configuración |
| ¿La IA está rota hoy? | Sí, si falta la variable | **No.** Funciona con el valor por defecto |
| Acción correcta | Cambiar el modelo urgentemente | Centralizar la constante y documentar la variable |

**Qué se hizo en su lugar.** El modelo se centralizó en `api/_lib/gemini.js` (antes estaba duplicado en 4 endpoints) y `GEMINI_MAIN_MODEL` se documentó en `.env.example`. **Deliberadamente NO se hace fallar el arranque** cuando la variable falta, aunque el Bloque B lo pedía: hacerlo habría provocado una caída total del generador en producción, donde hoy funciona. En su lugar se registra un aviso en el log del servidor.

**Dato útil que sí salió de la verificación:** el precio publicado es de **$1,50 por millón de tokens de entrada y $7,50 por millón de salida**. Con 4 módulos de 4.500-8.192 tokens de salida, una sesión ronda los **$0,15-0,20**. Eso hace mucho más concreto el riesgo de la generación sin cuota: no era una preocupación teórica.

---

## C-2 · 🟠 `onChoosePlan` NO estaba roto

**Dónde lo afirmé mal:** `02-SCREEN-INVENTORY.md` A8 · `03-UX-AUDIT.md` §1.3 · `10-FEATURE-AUDIT.md` §7 · `11-LANDING-AUDIT.md` §3.2 · `19-IMPROVEMENT-BACKLOG.md` B-017 · `21-QUICK-WINS.md` QW-10

**Lo que afirmé:**

> La landing anula la lógica de WhatsApp pasando `onChoosePlan={onRegister}`. Pulsar "Elegir plan mensual" lleva al registro en vez de al pago. **Se pierde la conversión en el punto de máxima intención. P0.**

**Lo que es cierto:** `PlansModal` gestiona los planes de pago **internamente y correctamente**:

```js
const handleChoosePlan = (plan) => {
  if (plan.name === "Gratuito") return onChoosePlan("gratuito");
  const message = `Hola Teaching TIC, deseo adquirir el Plan ${plan.name}…`;
  window.open(`https://wa.me/…`, "_blank", "noopener,noreferrer");
  onClose();
};
```

`onChoosePlan` **solo se invoca para el plan gratuito**, y recibe la cadena `"gratuito"`, no un objeto. Por tanto `onRegister` **es el handler correcto**.

**Por qué me equivoqué.** Vi que `choosePlan` estaba definido en `ImprovedLanding` y nunca se usaba, y concluí que su lógica de WhatsApp era la que "faltaba". No comprobé que `PlansModal` ya tuviera la suya propia. Leí la ausencia de una llamada como la ausencia de la función.

**Qué pasó al intentar "corregirlo".** Durante el Bloque B cambié la línea a `onChoosePlan={choosePlan}`, lo que **introducía una regresión real**: `choosePlan("gratuito")` evalúa `"gratuito".name` → `undefined` → no coincide con `"Gratuito"` → abre WhatsApp con *"deseo adquirir el Plan undefined por S/undefined"*. Se detectó al verificar el contrato de `PlansModal` antes de dar el cambio por bueno, y **se revirtió**.

**El problema real, mucho menor:** `choosePlan` en `ImprovedLanding` es código muerto que duplica `PlansModal.handleChoosePlan`. Esa duplicación fue precisamente lo que indujo el diagnóstico erróneo. Queda anotado en el código y su eliminación corresponde al Bloque C.

---

## Lecciones aplicadas al resto del trabajo

1. **Verificar los hechos externos contra la fuente**, no contra la memoria. La afirmación sobre el modelo de Gemini era comprobable con una consulta y no la hice.
2. **Leer el contrato completo antes de declarar algo roto.** Que un handler "parezca" el equivocado no basta: hay que leer quién lo llama y con qué.
3. **Comprobar cada corrección antes de darla por buena.** La regresión de C-2 se detectó justo por hacerlo.

---

## Hallazgos de la auditoría que el Bloque B sí confirmó

Para no dejar la impresión de que la auditoría fue poco fiable en conjunto, estos hallazgos se verificaron **empíricamente** durante la implementación:

| Hallazgo | Cómo se confirmó |
|---|---|
| El codemod no es idempotente | Ejecutado dos veces: exit 0, luego exit 1 (Bloque A) |
| `challenge` no está en ningún `CHECK` | Búsqueda en los 4 archivos SQL: 0 coincidencias |
| `/api/generate-session` no consumía créditos | Lectura del handler: ninguna llamada a `consume_ai_credit` |
| `generate-with-quota` está huérfano | Búsqueda de `/api/` en `App.jsx` y `components/`: no aparece |
| `CreditsIndicator` nunca se importaba | Búsqueda de importaciones: 0 |
| El guardado fallaba en silencio | 9 puntos con `catch { console.error }` |
| Las mascotas pesaban 1,77 MB | Medido: 891 KB + 875 KB, mostradas a 52-140 px |
| El listado traía `contenido` completo | Confirmado en el `select` de la biblioteca |
| Solo 3 reglas `:focus` en 99 KB de CSS | Recuento directo |
| El crucigrama era una simulación | `setTimeout(1200)` + eco de las pistas |
| `generate-session.js` sin respaldo a `SUPABASE_URL` | Único de los 5 endpoints sin el respaldo |

También se corrigió en el Bloque A un recuento menor: el codemod tenía **9** anclas, no 11.
