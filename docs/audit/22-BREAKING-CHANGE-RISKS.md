# 22 — Riesgos de cambios que pueden romper el sistema

Qué puede romperse al aplicar las mejoras, cómo detectarlo y cómo revertirlo.

**Escala de riesgo:** 🔴 Crítico (usuarios bloqueados o datos perdidos) · 🟠 Alto (función principal caída) · 🟡 Medio (función secundaria) · 🟢 Bajo (cosmético)

---

## 1. El riesgo permanente: el codemod

> ✅ **RESUELTO el 3-sep-2026 en la rama `chore/stabilize-build`.**
> El codemod se retiró del build (`"build": "vite build"`) y su resultado está versionado.
> Se verificó que el bundle de producción (JS y CSS) es **byte-idéntico** al del flujo anterior.
> Detalle en [`24-REAL-ENVIRONMENT-BASELINE.md`](24-REAL-ENVIRONMENT-BASELINE.md) §5 y [`../legacy/README.md`](../legacy/README.md).
> **Esta sección se conserva como registro histórico** y sigue aplicando a cualquier rama anterior a ese cambio.

> **Mientras `apply-sciverse-v2.mjs` siga en el `build`, TODO cambio en `App.jsx` o `index.css` puede romper el despliegue.**

`mustReplace` (`apply-sciverse-v2.mjs:7-11`) lanza excepción si no encuentra el texto exacto. Hay **9 anclas**. Si una edición altera cualquiera de ellas —aunque sea un espacio— el build falla y **Vercel no publica**.

`PASOS.txt` documenta que esto ya ocurrió: `SyntaxError: Unexpected identifier 'Bearer'`.

### Las 9 anclas

| # | Ancla (resumen) | Zona sensible de `App.jsx` |
|---|---|---|
| 1 | `  Quote,\n} from "lucide-react";` | Final del import de iconos (~línea 62) |
| 2 | Marcador previo a los generadores V2 | Antes de `CreateStudio` |
| 3 | La función `CreateStudio` **completa** | 2334-2434 |
| 4 | Declaración de estado en `SciVerseApp` | ~3585 |
| 5 | El bloque del dashboard **completo** | 3684-3702 |
| 6 | Punto de conexión dashboard ↔ estudio | ~3721 |
| 6B (×5) | Anclas del flujo Sesión→Instrumento→Material | Varias |

### Prueba obligatoria antes de cada despliegue

Mientras dure esta situación, **verificar el codemod en una copia aislada con finales de línea LF**:

```bash
# Verificación (no modifica el repositorio)
mkdir -p /tmp/verify && cd /tmp/verify
git -C <repo> show HEAD:App.jsx > App.jsx
git -C <repo> show HEAD:index.css > index.css
git -C <repo> show HEAD:apply-sciverse-v2.mjs > apply-sciverse-v2.mjs
node apply-sciverse-v2.mjs   # si falla, el despliegue fallará
```

> **Detalle verificado:** el blob de Git tiene LF y el árbol de trabajo en Windows tiene CRLF (`core.autocrlf=true`, sin `.gitattributes`). Por eso el codemod **falla siempre en local** pero funciona en Vercel. La verificación debe hacerse sobre el blob, no sobre el archivo local.

### Mitigación definitiva

Eliminar el codemod (`19-` B-001) es el **primer trabajo del roadmap** precisamente por esto.

---

## 2. Riesgos sobre autenticación

| # | Cambio | Riesgo | Qué se rompe | Detección | Mitigación / reversión |
|---|---|---|---|---|---|
| A1 | Migrar el perfil de `user_metadata` a la tabla `profiles` | 🔴 | Si `profiles` no tiene fila para un usuario antiguo, el perfil llega vacío y la interfaz muestra huecos | Contar filas: `auth.users` vs `profiles` antes de cambiar la lectura | **Escritura dual 2 semanas** antes de cambiar la lectura. Respaldo a metadata si la fila no existe |
| A2 | Renombrar `docentes` → `profiles` | 🔴 | `api/list-docentes.js` deja de funcionar; el admin queda ciego | Prueba del panel admin | **Vista de compatibilidad** `docentes` apuntando a `profiles` |
| A3 | Cambiar la PK de `docentes` (id sintético → `user_id`) | 🔴 | Rompe cualquier FK futura y el trigger `crear_perfil_docente` | Prueba de registro en staging | Mantener `id` como columna con índice único durante la transición |
| A4 | Comprobar `activo` al iniciar sesión | 🟠 | Si alguna fila tiene `activo = null`, esos docentes quedan bloqueados | `select count(*) where activo is null` | Comprobar `activo IS NOT FALSE`, no `activo = true` |
| A5 | Registro en 2 pasos | 🟡 | Registros a medias sin completar el paso 2 | Ratio paso 1 / paso 2 | El paso 2 debe ser **opcional**; la cuenta ya es válida tras el paso 1 |
| A6 | Añadir captcha | 🟠 | Mal configurado, bloquea **todos** los registros | Vigilar registros por hora tras el despliegue | Interruptor de desactivación; probar en staging |
| A7 | Cambiar `redirectTo` de recuperación | 🟠 | Los enlaces ya enviados dejan de funcionar | Probar un enlace real | Soportar la ruta antigua durante 30 días |
| A8 | Introducir el router | 🟠 | Sin rewrite de SPA, recargar en `/biblioteca` da 404 | Cargar cada URL directamente | **`vercel.json` con el rewrite ANTES de desplegar el router** |

### Regla de oro para autenticación

Cualquier cambio en auth se prueba con **cuentas creadas antes del cambio**, no solo con cuentas nuevas. Los usuarios existentes son los que más riesgo corren.

---

## 3. Riesgos sobre los datos existentes

| # | Cambio | Riesgo | Qué se rompe | Detección | Mitigación / reversión |
|---|---|---|---|---|---|
| D1 | Redefinir el `CHECK` de `tipo` | 🟠 | Si se omite un tipo ya presente, **la migración falla** o bloquea guardados | `select distinct tipo from materiales_docente` **antes** | Incluir todos los valores existentes más `challenge`. Consultar primero |
| D2 | Sustituir el `CHECK` por FK a `material_types` | 🔴 | Si falta poblar un tipo existente, la FK falla y **la migración se revierte** | Comparar tipos existentes con la tabla nueva | Poblar `material_types` **antes** de crear la FK |
| D3 | Migrar favoritos de `localStorage` a Supabase | 🟡 | Si la migración se ejecuta antes de leer `localStorage`, se pierden | Contar favoritos antes y después | Migrar en el **primer acceso** de cada docente; no borrar `localStorage` hasta confirmar |
| D4 | Añadir `deleted_at` (borrado lógico) | 🟠 | Las consultas existentes que no filtren mostrarán materiales borrados | Revisar todas las consultas a `materials` | Añadir `where deleted_at is null` en la **misma** migración |
| D5 | Trigger `updated_at` | 🟢 | Ninguno; hoy nada actualiza esa tabla | — | — |
| D6 | Resolver los índices únicos de `correo` | 🟠 | Si hay correos que difieren solo en mayúsculas, crear el índice de `lower()` **falla** | `select lower(correo), count(*) ... having count(*) > 1` | Normalizar los duplicados antes |
| D7 | Añadir `parent_id` a materiales | 🟢 | Ninguno; columna nueva anulable | — | — |
| D8 | Crear `ai_usage` y dejar de leer `ai_week_used` | 🟠 | Si no se copian los contadores, todos los docentes recuperan sus 5 créditos | Comparar `used` antes y después | Escritura dual durante 2 semanas; copiar valores actuales al crear |

### Regla de oro para datos

**Ninguna migración sin haber consultado antes el estado real.** Los archivos SQL del repositorio no dicen qué se ejecutó: hay que preguntárselo a la base de datos.

---

## 4. Riesgos sobre Supabase

| # | Cambio | Riesgo | Qué se rompe | Detección | Mitigación |
|---|---|---|---|---|---|
| S1 | Modificar políticas RLS | 🔴 | Una política mal escrita **expone materiales entre docentes** o bloquea el acceso a los propios | Prueba con dos cuentas: A no debe ver nada de B | Probar en staging con dos usuarios reales. **Nunca desactivar RLS "temporalmente" en producción** |
| S2 | Añadir política de DELETE a `docentes` | 🟠 | Con `using` mal escrito, un docente podría borrar filas ajenas | Prueba explícita de borrado cruzado | `using (auth.uid() = user_id)` **y** `with check` |
| S3 | Cambiar `search_path` de las RPC de `public` a `''` | 🟠 | Si algún nombre queda sin calificar, la función falla en ejecución | Ejecutar las 3 RPC tras el cambio | Calificar todos los nombres (`public.docentes`) en la misma migración |
| S4 | Modificar `consume_ai_credit` | 🔴 | Perder el `FOR UPDATE` reintroduce el **doble consumo concurrente** | Prueba de dos peticiones simultáneas | Conservar `SELECT ... FOR UPDATE`; probar concurrencia |
| S5 | Cambiar el trigger `crear_perfil_docente` | 🔴 | Un error en el trigger **bloquea todos los registros nuevos** (corre dentro de la transacción de `auth.users`) | Registro de prueba tras cada cambio | Probar en staging; tener a mano el `create or replace` anterior |
| S6 | Crear `admin_roles` | 🟡 | Sin fila inicial, **nadie puede entrar al admin** | Verificar que existe al menos un superadmin | Insertar el primer superadmin en la misma migración |

---

## 5. Riesgos sobre rutas y navegación

| # | Cambio | Riesgo | Qué se rompe | Mitigación |
|---|---|---|---|---|
| R1 | Introducir el router | 🟠 | Sin rewrite, cualquier URL profunda da 404 | `vercel.json` con `{"source":"/(.*)","destination":"/"}` **antes** del router |
| R2 | Retirar `?admin=1` | 🟡 | Los administradores pierden su acceso habitual | Soportar ambos accesos **1 semana**; avisar antes |
| R3 | Cambiar `?view=reset-password` / `?restablecer=1` | 🟠 | Los enlaces de recuperación ya enviados dejan de funcionar | Soportar los parámetros antiguos 30 días |
| R4 | Mover los legales de modal a página | 🟢 | Enlaces externos al modal (no debería haberlos) | Redirección desde el ancla antigua |
| R5 | Cambiar el ancla `#planes-docente` | 🟢 | El enlace del dashboard deja de funcionar | Actualizar ambos a la vez |

---

## 6. Riesgos sobre usuarios existentes

| # | Cambio | Riesgo | Impacto en la docente | Mitigación |
|---|---|---|---|---|
| U1 | Aplicar la escala tipográfica | 🟡 | Toda la interfaz cambia de aspecto de golpe | Aviso en la aplicación; desplegar en horario de baja actividad |
| U2 | Rediseñar el dashboard | 🟠 | La docente no encuentra lo que usaba | Conservar todas las acciones existentes; **añadir**, no quitar |
| U3 | Retirar "Crucigrama" | 🟡 | Quien lo usara pierde la opción | Explicar el motivo con honestidad: no generaba nada |
| U4 | Cambiar el flujo de generación | 🔴 | Si el nuevo falla, **la función principal cae** | Convivencia con interruptor; comparar 10 resultados antes de cambiar |
| U5 | Cobrar créditos donde antes era gratis | 🟠 | La docente que hacía 10 sesiones semanales ahora hace 5 | **Avisar antes.** Considerar un periodo de gracia o subir el límite |
| U6 | Onboarding obligatorio | 🟡 | Los usuarios existentes lo verían sin necesitarlo | Mostrarlo solo si `onboarding_completed_at is null` **y** el usuario es nuevo |
| U7 | Registro en 2 pasos | 🟢 | Solo afecta a nuevos | — |

### U5 merece atención especial

Hoy `/api/generate-session` es gratuito de facto. Una docente puede llevar meses generando sin límite. **Activar la cuota es, desde su punto de vista, una restricción nueva.**

Recomendación: avisar con una semana de antelación, explicar el motivo, y valorar subir el límite gratuito de 5 a 8-10 para amortiguar el cambio.

---

## 7. Riesgos sobre Vercel y el despliegue

| # | Cambio | Riesgo | Qué se rompe | Mitigación |
|---|---|---|---|---|
| V1 | Eliminar el codemod del `build` | 🟠 | Si el `App.jsx` commiteado no coincide con el que producía el build, **el sitio cambia** | Comparar byte a byte; desplegar primero a vista previa |
| V2 | Añadir `.gitattributes` y renormalizar | 🟠 | El commit de renormalización toca **todos** los archivos: el diff es enorme | Commit **exclusivo**, sin cambios funcionales |
| V3 | Eliminar un lockfile | 🟠 | Vercel cambia de gestor y puede resolver versiones distintas | Desplegar a vista previa y verificar el build |
| V4 | Añadir `vercel.json` | 🟠 | Una CSP mal configurada **bloquea las fuentes o el script** | Empezar con `Content-Security-Policy-Report-Only` |
| V5 | Crear `api/_lib/` | 🟡 | Vercel podría interpretar los archivos como funciones | El prefijo `_` los excluye; verificar en la vista previa |
| V6 | Mover endpoints a `api/ai/` | 🟠 | Las rutas cambian: `/api/generate-session` → `/api/ai/session` | Conservar los endpoints antiguos como redirección 1 mes |
| V7 | División de código | 🟡 | Fragmentos que no cargan si el despliegue se solapa con una sesión abierta | Manejo de error de carga con recarga automática |
| V8 | Falta `maxDuration` en las funciones | 🟠 | Con 4 llamadas encadenadas, la función puede agotar el tiempo por defecto | Declarar `maxDuration` explícito al mover a `api/ai/session.js` |

---

## 8. Riesgos sobre la IA

| # | Cambio | Riesgo | Qué se rompe | Mitigación |
|---|---|---|---|---|
| I1 | Cambiar el modelo de Gemini | 🔴 | Un identificador inválido rompe **toda** la generación | Probar en staging con los 10 modos antes de producción |
| I2 | Orquestar los módulos en servidor | 🔴 | Es una reescritura del flujo central | Convivencia con interruptor; comparar 10 sesiones |
| I3 | Añadir cuota a `generate-session` | 🟠 | Cobrar 4 créditos por sesión agota el cupo semanal de una sola vez | **Definir la unidad de cobro antes.** Idealmente 1 sesión = 1 crédito |
| I4 | Validación semántica del output | 🟠 | Reglas demasiado estrictas rechazan resultados válidos y consumen reintentos | Empezar en modo aviso (registrar sin rechazar) 2 semanas |
| I5 | Cambiar los prompts | 🟠 | La calidad puede empeorar sin que nadie lo note | Versionar y registrar `prompt_version`; comparar antes de generalizar |
| I6 | Delimitar la entrada en los prompts | 🟡 | Cambia el prompt: el output puede variar | Comparar resultados antes y después |
| I7 | Añadir timeout | 🟡 | Un timeout corto corta generaciones válidas | Empezar en 45 s y medir la duración real |
| I8 | Limitación de tasa | 🟠 | Un límite bajo bloquea uso legítimo | Medir el uso real antes de fijar el umbral |

---

## 9. Riesgos sobre el panel administrativo

| # | Cambio | Riesgo | Qué se rompe | Mitigación |
|---|---|---|---|---|
| AD1 | Secreto de query a cabecera | 🟠 | Marcadores y accesos guardados dejan de funcionar | Avisar; documentar el nuevo acceso |
| AD2 | Rotar `ADMIN_SECRET` | 🟠 | Acceso perdido hasta actualizar la variable | Rotar y comunicar en el mismo momento |
| AD3 | Sustituir por `admin_roles` | 🔴 | Sin superadmin inicial, **nadie entra** | Insertar el primer superadmin en la migración y verificarlo |
| AD4 | Retirar `?admin=1` | 🟠 | Pérdida del único acceso conocido | Convivencia 1 semana |
| AD5 | Cambiar de `docentes` a `profiles` | 🟠 | El listado se queda vacío | Vista de compatibilidad |
| AD6 | Paginar el listado | 🟢 | El admin ya no ve todo de golpe | Indicar el total y la paginación |

---

## 10. Matriz de los diez cambios más peligrosos

| Rango | Cambio | Riesgo | Por qué |
|---|---|---|---|
| 1 | Editar `App.jsx` con el codemod activo | 🔴 | **Rompe el despliegue entero.** Vercel no publica |
| 2 | Modificar políticas RLS | 🔴 | Puede exponer datos entre docentes |
| 3 | Cambiar el trigger `crear_perfil_docente` | 🔴 | Bloquea **todos** los registros nuevos |
| 4 | Migrar el perfil a `profiles` | 🔴 | Puede dejar sin perfil a usuarios existentes |
| 5 | Orquestar la IA en servidor | 🔴 | Reescribe el flujo central del producto |
| 6 | Cambiar el modelo de Gemini | 🔴 | Un identificador inválido cae toda la generación |
| 7 | Sustituir el `CHECK` por FK | 🔴 | Migración fallida si falta poblar un tipo |
| 8 | Modificar `consume_ai_credit` | 🔴 | Perder `FOR UPDATE` = doble consumo |
| 9 | Sustituir `ADMIN_SECRET` por roles | 🔴 | Sin superadmin inicial, nadie entra |
| 10 | Introducir el router sin `vercel.json` | 🟠 | Todas las URLs profundas dan 404 |

---

## 11. Protocolo de despliegue seguro

Para cualquier cambio de riesgo 🔴 o 🟠:

### Antes

1. Verificar el codemod en copia aislada con LF (mientras siga activo)
2. Consultar el **estado real** de la base de datos, no los archivos SQL
3. Probar en staging con datos parecidos a producción
4. Probar con cuentas creadas **antes** del cambio
5. Tener escrito el procedimiento de reversión
6. Desplegar a vista previa de Vercel y comparar visualmente

### Durante

7. Desplegar en horario de baja actividad (para docentes peruanos: mañana temprano o noche)
8. Un cambio de riesgo por despliegue — **nunca agrupar** dos cambios 🔴
9. Verificar el flujo P0 inmediatamente tras publicar

### Después

10. Vigilar los logs de Vercel durante 30 minutos
11. Verificar los registros y generaciones de las primeras horas
12. Mantener disponible la reversión durante 24 h

### Reversión

- **Frontend:** revertir el despliegue en Vercel (instantáneo)
- **Base de datos:** cada migración debe traer su `down` escrito **antes** de aplicarla
- **Endpoints:** conservar los antiguos como redirección al menos un mes

---

## 12. Qué NO se puede revertir

Conviene ser explícito:

| Acción | Por qué es irreversible |
|---|---|
| Borrar filas de `materiales_docente` | Sin papelera, el trabajo de la docente se pierde definitivamente |
| Borrar `localStorage` de favoritos sin migrar | No hay copia en ninguna parte |
| Rotar `GEMINI_API_KEY` sin actualizar Vercel | Corte inmediato del servicio |
| Eliminar `ADMIN_SECRET` sin superadmin en `admin_roles` | Pérdida total del acceso administrativo |
| Un `DROP COLUMN` sin respaldo | Los datos no vuelven |
| Correos enviados por error | No se pueden retirar |

**Ante cualquiera de estas, hacer copia de seguridad antes.** Supabase permite copias bajo demanda: usarlas.
