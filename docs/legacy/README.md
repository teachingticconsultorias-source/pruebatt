# Código legado — archivado, NO reutilizar

## `apply-sciverse-v2.mjs`

> ⛔ **Este script NO debe volver al proceso de build bajo ninguna circunstancia.**

### Qué hacía

Era un *codemod* de 89 KB que se ejecutaba **antes** de `vite build`:

```json
"build": "node apply-sciverse-v2.mjs && vite build"
```

En cada build, mediante búsqueda y reemplazo de cadenas:

1. **Modificaba `App.jsx` en disco** — 9 llamadas a `mustReplace()`, cada una anclada a un fragmento de texto literal:
   | # | Sección | Efecto |
   |---|---|---|
   | 1 | Iconos | Añadía `Gamepad2`, `ListChecks`, `CalendarDays` al import de `lucide-react` |
   | 2 | Generadores V2 | Inyectaba `ProjectSteamGenerator`, `ResourceFromAI`, `ValuationScaleGenerator`, `LinkedWorksheetGenerator`, `LinkedReadingGenerator`, `LinkedRatingScaleGenerator`, `CompleteClassFlow`, `CompleteClassIntro`, `FlowChoiceCard` |
   | 3 | `CreateStudio` | **Reemplazo total** por la versión con categorías (Fichas · Juegos · Instrumentos · Planificación) |
   | 4 | Estado | Añadía `initialCreation` para abrir el estudio desde el dashboard |
   | 5 | Dashboard | **Reemplazo total** por el "Home V2" |
   | 6 | Cableado | Conectaba dashboard ↔ estudio |
   | 6B (×4) | Flujo encadenado | Sesión → Instrumento → Material |

2. **Añadía CSS a `index.css`** — dos bloques grandes, protegidos por marcador (`/* SCIVERSE HOME V2 — 2026-08-27 */` y `/* SCIVERSE COMPLETE CLASS FLOW V3 */`), por lo que esta parte sí era idempotente.

3. **Generaba `api/generate-project-steam.js`** — un endpoint serverless completo, escrito como una cadena de 101 líneas dentro del propio script. **Ese archivo no existía en el repositorio**: solo aparecía durante el build.

### Por qué se retiró

| Problema | Detalle |
|---|---|
| **El repositorio no era la fuente de verdad** | `App.jsx` tenía 3.776 líneas en Git y 4.221 en producción. `CreateStudio` y el dashboard desplegados eran completamente distintos a los del repositorio. Nadie podía razonar sobre producción leyendo el código. |
| **No era idempotente** | Verificado: la primera ejecución termina con éxito; la segunda falla con `Error: No pude aplicar el cambio: iconos del dashboard`. Un segundo `npm run build` local siempre fallaba. |
| **Frágil por diseño** | `mustReplace()` lanza excepción si no encuentra el texto exacto. Cualquier edición de `App.jsx` que tocara una de las 9 anclas **rompía el despliegue**. `PASOS.txt` documenta que ya ocurrió (`SyntaxError: Unexpected identifier 'Bearer'`). |
| **Ensuciaba el árbol de trabajo** | Construir en local dejaba `App.jsx`, `index.css` y `api/generate-project-steam.js` modificados y sin entrada en `.gitignore`, listos para commitearse por accidente. |
| **Un endpoint sin revisión posible** | `api/generate-project-steam.js` no podía revisarse en un pull request ni probarse sin ejecutar el codemod. |
| **Imposible construir en Windows** | El blob de Git tiene LF y el árbol de trabajo local tenía CRLF (`core.autocrlf=true`, sin `.gitattributes`). Las anclas usan LF, así que el codemod fallaba siempre en local. |

Análisis completo en [`docs/audit/05-FRONTEND-CODE-AUDIT.md`](../audit/05-FRONTEND-CODE-AUDIT.md) §2 y [`docs/audit/16-TECH-DEBT.md`](../audit/16-TECH-DEBT.md) TD-01.

### Dónde se materializó

| Dato | Valor |
|---|---|
| **Commit base** | `e49c68c` (rama `main`) |
| **Rama de materialización** | `chore/stabilize-build` |
| **Fecha** | 3 de septiembre de 2026 |
| **Procedimiento** | El codemod se ejecutó **una última vez** sobre una copia aislada del blob de Git (finales de línea LF, no el árbol de trabajo). El resultado se verificó por hash y se commiteó como el nuevo código fuente. |

**Hashes SHA-256 del resultado materializado** (el que producción recibía antes de `vite build`):

```
758496aceb596cc145109be15e6f7e9c10669d7c5229e292df07c4118fd732a7  App.jsx
c51bd38284a0cef4d925a7cd7dac6bd3d299c748697c4afb66c8b257a56db061  index.css
d0062bfccfa727812257d02aa31862774bf1e4dc4b2530d098f3025cd978fd6c  api/generate-project-steam.js
```

El codemod es **determinista**: dos ejecuciones independientes sobre el mismo blob produjeron hashes idénticos.

### Estado actual

```json
"build": "vite build"
```

`App.jsx`, `index.css` y `api/generate-project-steam.js` están versionados directamente en Git con el contenido exacto que producción venía recibiendo. **El build ya no modifica ningún archivo fuente.**

---

## ⚠️ Documentación obsoleta en la raíz del repositorio

Estos archivos siguen en la raíz y **contienen instrucciones que ya no son válidas**. Indican ejecutar el codemod o restaurar el script `build` antiguo:

- `LEEME.txt`
- `LEEME_PRIMERO.txt`
- `INSTRUCCIONES_SCIVERSE_V2.txt`
- `INSTRUCCIONES.txt`
- `INTEGRACION_App.jsx.txt`
- `INTEGRACION_App_V2.txt`
- `PASOS.txt`
- `README.txt`

**No los sigas.** Su eliminación está registrada como TD-54 en [`docs/audit/16-TECH-DEBT.md`](../audit/16-TECH-DEBT.md) y corresponde a un bloque posterior, para mantener este cambio revisable.

Lo mismo aplica a `package-fallback.json`, que contenía el script `"build": "vite build"` como plan de emergencia y ha quedado sin propósito.
