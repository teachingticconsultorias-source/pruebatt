# 24 — Baseline del entorno real

> ⚠️ **Una afirmación de este documento es incorrecta.** Lo que se dice aquí sobre el modelo `gemini-3.6-flash` (que no existiría y rompería la IA) es **falso**: es un modelo válido y estable de la API de Gemini. El resto del documento se mantiene. Detalle en [`25-AUDIT-CORRECTIONS.md`](25-AUDIT-CORRECTIONS.md) §C-1.


Inventario de lo que **debe verificarse contra los servicios reales** antes de la siguiente fase.

**Fecha:** 3 de septiembre de 2026
**Rama:** `chore/stabilize-build`
**Commit base:** `e49c68c`

> ⚠️ **Nada de este documento se ha ejecutado contra producción.**
> No se ejecutó SQL. No se modificó Supabase. No se leyeron ni escribieron variables de entorno de Vercel.
> Todo lo que sigue es un inventario preparado a partir del código versionado.

---

## 1. Supabase real pendiente de verificación

El repositorio contiene **cuatro archivos SQL con definiciones contradictorias** (`docs/audit/07-SUPABASE-DATABASE-AUDIT.md` §3.1) y **no existe tabla de migraciones**. Por tanto, **el estado real de la base de datos no se puede deducir del repositorio**: hay que preguntárselo a la base.

Ejecutar estas consultas en el **SQL Editor de Supabase**, con acceso autorizado, y registrar el resultado aquí antes de tocar nada.

### 1.1 Tipos de material realmente presentes

```sql
-- ¿Qué tipos existen ya guardados? Ninguna migración puede omitirlos.
select tipo, count(*) as filas
from public.materiales_docente
group by tipo
order by tipo;
```

```sql
select distinct tipo
from public.materiales_docente
order by tipo;
```

**Por qué importa:** el `CHECK` de `tipo` debe incluir **todos** los valores ya presentes, o la migración fallará. Además confirma si `challenge` llegó alguna vez a guardarse (la auditoría concluye que **no**, porque ningún `CHECK` lo permite — `07-` §3.1).

### 1.2 Restricción CHECK vigente

```sql
select conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conrelid = 'public.materiales_docente'::regclass
  and contype = 'c';
```

**Por qué importa:** determina **cuál de los tres archivos SQL contradictorios se ejecutó de último**, y por tanto si `reading`, `questionnaire` y `observation_guide` están permitidos hoy.

### 1.3 Estado de RLS

```sql
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relname in ('docentes', 'materiales_docente');
```

```sql
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd;
```

**Por qué importa:** el aislamiento entre docentes depende íntegramente de esto. Confirmar que RLS está activa y que existen las 6 políticas esperadas (2 en `docentes`, 4 en `materiales_docente`).

### 1.4 Columnas reales

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('docentes', 'materiales_docente')
order by table_name, ordinal_position;
```

**Por qué importa:** confirmar si las columnas de créditos (`ai_weekly_limit`, `ai_week_used`, `ai_week_start`) existen realmente — es decir, si `supabase-freemium.sql` llegó a ejecutarse.

### 1.5 Índices

```sql
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('docentes', 'materiales_docente')
order by tablename, indexname;
```

**Por qué importa:** verificar los tres índices únicos redundantes sobre `correo` (`07-` §3.6) y si el `ON CONFLICT (correo)` del trigger es seguro.

### 1.6 Funciones RPC y trigger

```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_ai_credit_status','consume_ai_credit','refund_ai_credit','crear_perfil_docente');
```

```sql
select tgname, tgrelid::regclass as tabla, tgenabled
from pg_trigger
where tgname = 'al_crear_usuario';
```

```sql
-- Confirmar que consume_ai_credit conserva FOR UPDATE (evita doble consumo)
select prosrc from pg_proc where proname = 'consume_ai_credit';
```

**Por qué importa:** `22-BREAKING-CHANGE-RISKS.md` §4 marca S4 como riesgo crítico: perder el `FOR UPDATE` reintroduce el doble consumo concurrente.

### 1.7 Permisos de las funciones

```sql
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('get_ai_credit_status','consume_ai_credit','refund_ai_credit');
```

**Por qué importa:** deben estar revocadas a `public` y concedidas solo a `authenticated`.

### 1.8 Recuento de filas y coherencia

```sql
select
  (select count(*) from auth.users)                  as usuarios_auth,
  (select count(*) from public.docentes)             as perfiles_docentes,
  (select count(*) from public.materiales_docente)   as materiales;
```

```sql
-- Usuarios SIN perfil: indicaría fallos del trigger
select u.id, u.email, u.created_at
from auth.users u
left join public.docentes d on d.user_id = u.id
where d.user_id is null
order by u.created_at desc;
```

```sql
-- Perfiles huérfanos (sin usuario en auth)
select d.id, d.correo, d.created_at
from public.docentes d
left join auth.users u on u.id = d.user_id
where d.user_id is null or u.id is null;
```

**Por qué importa:** `22-` §2 marca A1 como riesgo crítico. Si hay usuarios sin perfil, migrar a `profiles` los dejaría sin datos.

### 1.9 Estado de créditos

```sql
select plan, count(*) as docentes,
       avg(ai_week_used)::numeric(10,2) as media_usada,
       max(ai_week_used)                as maximo_usado,
       min(ai_weekly_limit)             as limite_min,
       max(ai_weekly_limit)             as limite_max
from public.docentes
group by plan;
```

```sql
-- Semanas de créditos desalineadas
select ai_week_start, count(*)
from public.docentes
group by ai_week_start
order by ai_week_start desc;
```

**Por qué importa:** antes de activar la cuota en `/api/generate-session` (hoy sin límite, `09-` §5.1) hay que saber cuánto consume realmente un docente. Es la base para decidir si el límite gratuito de 5 debe subirse al activar el cobro (`22-` §6, riesgo U5).

### 1.10 Correos duplicados por mayúsculas

```sql
select lower(correo) as correo_normalizado, count(*)
from public.docentes
group by lower(correo)
having count(*) > 1;
```

**Por qué importa:** `22-` §3, riesgo D6. Si existen duplicados, crear el índice único sobre `lower(correo)` fallará.

### 1.11 Distribución de material por docente

```sql
select count(*) as materiales_por_docente, count(*) as docentes
from (
  select user_id, count(*) as c
  from public.materiales_docente
  group by user_id
) t
group by 1
order by 1 desc
limit 20;
```

**Por qué importa:** la biblioteca usa `limit(100)` con filtrado en cliente (`10-` §5). Si algún docente supera 100 materiales, **ya no puede encontrar los antiguos**.

---

## 2. Variables de entorno

Detectadas por análisis estático del código versionado.

> 🔒 **No se ha impreso ni consultado ningún valor.** El estado en Vercel no es verificable desde el repositorio.

| Variable | Ámbito | Leída en | Estado |
|---|---|---|---|
| `GEMINI_API_KEY` | Servidor | `api/generate-session.js`, `api/generate-session-resource.js`, `api/generate-linked-worksheet.js`, `api/generate-project-steam.js` | **NO VERIFICABLE DESDE EL REPOSITORIO** |
| `GEMINI_MAIN_MODEL` | Servidor | los 4 endpoints de IA | **NO VERIFICABLE DESDE EL REPOSITORIO** — ⚠️ ver §2.1 |
| `VITE_SUPABASE_URL` | Cliente + servidor | `supabaseClient.js`, endpoints | **NO VERIFICABLE DESDE EL REPOSITORIO** |
| `VITE_SUPABASE_ANON_KEY` | Cliente | `supabaseClient.js`, endpoints | **NO VERIFICABLE DESDE EL REPOSITORIO** |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Cliente | `supabaseClient.js`, endpoints | **NO VERIFICABLE DESDE EL REPOSITORIO** — ⚠️ falta en `.env.example` |
| `SUPABASE_URL` | Servidor | `api/credits.js`, `api/generate-session-resource.js`, `api/generate-with-quota.js`, `api/list-docentes.js` | **NO VERIFICABLE DESDE EL REPOSITORIO** |
| `SUPABASE_SERVICE_ROLE_KEY` | Servidor | `api/list-docentes.js` | **NO VERIFICABLE DESDE EL REPOSITORIO** |
| `ADMIN_SECRET` | Servidor | `api/list-docentes.js` | **NO VERIFICABLE DESDE EL REPOSITORIO** |

**Localmente:** no existen `.env`, `.env.local` ni `.env.production` en el árbol de trabajo. `.gitignore` cubre `.env` y `.env.local`. **No hay secretos versionados** (verificado con búsqueda de patrones JWT, `sb_secret_`, `sb_publishable_`, `AIza`, `service_role`).

### 2.1 ⚠️ `GEMINI_MAIN_MODEL` — verificación prioritaria

Los cuatro endpoints declaran:

```js
const GEMINI_MODEL = process.env.GEMINI_MAIN_MODEL || "gemini-3.6-flash";
```

`gemini-3.6-flash` **no corresponde a ningún identificador de modelo publicado por Google**. Todo el sistema de generación depende de que esta variable esté definida en Vercel con un valor válido.

Además, **no aparece en `.env.example`**: un despliegue nuevo hecho siguiendo la documentación del propio repositorio nacería con la IA rota, y el error llegaría envuelto como "Error de la API de Gemini".

**Verificación requerida antes de la siguiente fase:**

1. Confirmar en Vercel → Settings → Environment Variables si `GEMINI_MAIN_MODEL` está DEFINIDA.
2. Si lo está, confirmar que su valor es un identificador de modelo válido y vigente.
3. Si NO lo está, la generación está usando `"gemini-3.6-flash"` y debería estar fallando — comprobarlo en los logs de Vercel.

**No se corrige en este bloque** por decisión de alcance (Bloque A se limita a la estabilización del build). Registrado como B-008 / P0 en `19-IMPROVEMENT-BACKLOG.md`.

### 2.2 `.env.example` desactualizado

Faltan dos variables que el código sí lee:

- `GEMINI_MAIN_MODEL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Registrado como TD-67 en `16-TECH-DEBT.md`. **No corregido en este bloque.**

---

## 3. Vercel — pendiente de verificación

| Elemento | Qué comprobar |
|---|---|
| **Gestor de paquetes detectado** | Coexisten `package-lock.json` y `pnpm-lock.yaml`. Vercel prioriza pnpm cuando existe su lockfile. Verificar en los logs de un despliegue reciente cuál usa realmente |
| **Comando de build configurado** | Confirmar si Vercel usa el `build` de `package.json` o tiene un override en la interfaz. **Si hay override con el codemod, este bloque no surtirá efecto** |
| **`maxDuration` de las funciones** | No está declarada. El generador de sesión encadena 4 llamadas a Gemini de 15-30 s cada una desde el cliente; cada función individual debería caber, pero conviene confirmar el límite del plan |
| **Región de las funciones** | No declarada: se usa la de por defecto, probablemente lejos de los usuarios peruanos |
| **`api/generate-project-steam.js`** | A partir de este bloque está **versionado**. Confirmar que el despliegue lo detecta como función igual que antes |
| **Presupuesto de Google Cloud** | Verificar si existe límite de gasto para la API de Gemini (`19-` B-009, P0) |

---

## 4. Verificación posterior al primer despliegue de esta rama

Cuando esta rama llegue a producción (**no en este bloque**), comprobar:

- [ ] El build de Vercel termina sin ejecutar el codemod
- [ ] El sitio desplegado es visualmente idéntico al anterior
- [ ] `/api/generate-project-steam` responde igual que antes
- [ ] El dashboard muestra el Home V2 (banner "Crea tu clase completa" y 4 categorías)
- [ ] El estudio de creación muestra las 4 categorías (Fichas · Juegos · Instrumentos · Planificación)
- [ ] El flujo Sesión → Instrumento → Material funciona
- [ ] Los 5 recorridos P0 de `23-PRODUCTION-CHECKLIST.md` §12

---

## 5. Evidencia recogida en este bloque

Lo que **sí** se pudo verificar localmente, sin tocar producción:

| Verificación | Resultado |
|---|---|
| Codemod, primera ejecución sobre el blob `e49c68c` | ✅ Éxito (exit 0) |
| Codemod, segunda ejecución consecutiva | ❌ Falla: `No pude aplicar el cambio: iconos del dashboard` (exit 1) — **no idempotente, confirmado** |
| Determinismo del codemod | ✅ Dos ejecuciones independientes → hashes SHA-256 idénticos |
| Materialización en el repositorio | ✅ Byte a byte idéntica al resultado del codemod |
| `npm ci` limpio | ✅ 161 paquetes, exit 0 |
| `npm run build` (1ª vez) | ✅ exit 0 |
| `npm run build` (2ª vez consecutiva) | ✅ exit 0 — **antes era imposible** |
| El build muta el código fuente | ✅ NO (hashes idénticos antes y después) |
| **Bundle JS: flujo antiguo vs nuevo** | ✅ **Byte-idéntico** — `2b6b7717…a00373` |
| **Bundle CSS: flujo antiguo vs nuevo** | ✅ **Byte-idéntico** — `5cafd0b5…493963` |
| `dist/index.html`: antiguo vs nuevo | ✅ Idéntico tras normalizar EOL |
| Servidor de vista previa | ✅ HTTP 200 en HTML, JS, CSS y assets |

**Conclusión:** eliminar el codemod produce un bundle de producción **byte-idéntico**. No hay cambio de comportamiento ni de aspecto.
