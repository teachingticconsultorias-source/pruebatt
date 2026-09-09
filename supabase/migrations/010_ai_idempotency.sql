-- ============================================================================
-- 010_ai_idempotency.sql   ·   UNA GENERACIÓN LÓGICA, UNA SOLA VEZ
--
--                    ⚠️  DISEÑADA · NO EJECUTADA  ⚠️
--
-- DEPENDE DE 003_secure_ai_credits (esquema `sciverse_private`).
--
-- QUÉ RESUELVE
--     `disabled={loading}` en el navegador no basta. Un doble clic muy
--     rápido, un reintento del navegador tras una conexión mala o una
--     recarga impaciente mandan dos peticiones idénticas. Sin esto: dos
--     créditos, dos llamadas a Gemini y dos filas en la biblioteca.
--
-- POR QUÉ EN LA BASE Y NO EN MEMORIA
--     Vercel ejecuta varias instancias a la vez. Dos peticiones simultáneas
--     pueden caer en procesos distintos que no comparten memoria — que es
--     exactamente el caso a cubrir. El único árbitro común es Postgres.
--
-- LA GARANTÍA ES LA CLAVE PRIMARIA
--     `insert ... on conflict do nothing`. Si dos procesos insertan la misma
--     clave en el mismo milisegundo, Postgres deja pasar a uno y sólo a uno.
--     No hace falta bloqueo, ni cola, ni Redis: la unicidad ya es atómica.
--
-- ALCANCE
--     · sciverse_private.ai_operations
--     · begin_ai_operation(text, text)   reserva
--     · finish_ai_operation(text, text)  cierra
--     · purge_ai_operations(integer)     limpieza, sin cron
--
-- GARANTÍAS
--     · No toca créditos, planes, pagos ni suscripciones.
--     · No borra datos existentes.  · No desactiva RLS.
--     · Idempotente y transaccional.
--     · La clave foránea es ON DELETE RESTRICT: eliminar físicamente una
--       cuenta queda BLOQUEADO mientras tenga operaciones. El flujo normal de
--       SciVerse es desactivar cuentas (`docentes.activo`), no borrarlas.
--       Para un borrado real, purgar antes con `purge_ai_operations`.
-- ============================================================================

begin;


-- ============================================================================
-- 0. PRECONDICIONES
-- ============================================================================
do $$
begin
  if to_regnamespace('sciverse_private') is null then
    raise exception 'ABORTA: falta 003_secure_ai_credits.sql';
  end if;
end;
$$;


-- ============================================================================
-- 1. LA TABLA
--
--    La clave la elige el cliente y se guarda POR USUARIO: dos docentes
--    pueden mandar la misma cadena sin bloquearse entre sí, y aun así nadie
--    puede reservar la operación de otra persona.
--
--    NO se guarda el resultado de la generación. Una ficha completa son
--    kilobytes de JSON por operación y no aporta nada al objetivo: lo que se
--    necesita es saber si esta operación ya empezó, no repetir su salida.
--    El resultado ya vive en `materiales_docente` cuando la docente lo guarda.
-- ============================================================================
create table if not exists sciverse_private.ai_operations (
  -- ON DELETE RESTRICT, no CASCADE.
  --
  -- SciVerse va hacia el borrado lógico de cuentas: desactivar, no eliminar.
  -- Una cascada aquí sería una puerta trasera para que borrar una fila de
  -- `auth.users` arrastre en silencio filas de otras tablas, y ese hábito es
  -- el que hay que no adquirir. Con RESTRICT, eliminar físicamente a una
  -- usuaria queda BLOQUEADO mientras tenga operaciones asociadas, y quien lo
  -- intente recibe un error en vez de un borrado silencioso.
  --
  -- No se usa SET NULL porque `user_id` forma parte de la clave primaria y
  -- debe seguir siendo NOT NULL: es lo que hace que la clave de una docente
  -- no colisione con la de otra.
  --
  -- Esto NO congela la tabla: `purge_ai_operations` sigue borrando operaciones
  -- antiguas. Son datos técnicos efímeros —«esta generación ya empezó»—, no
  -- historial pedagógico ni comercial. Vaciarlos no pierde nada que la
  -- docente pueda echar de menos.
  user_id     uuid        not null references auth.users(id) on delete restrict,
  key         text        not null,
  tool        text,
  status      text        not null default 'processing',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint ai_operations_pk primary key (user_id, key),
  constraint ai_operations_status_valid check (
    status in ('processing', 'completed', 'failed')),
  constraint ai_operations_key_format check (
    key ~ '^[A-Za-z0-9._:-]{8,120}$')
);

-- Para la limpieza por antigüedad.
create index if not exists ai_operations_antiguedad_idx
  on sciverse_private.ai_operations (created_at);

revoke all on sciverse_private.ai_operations from public;
revoke all on sciverse_private.ai_operations from anon, authenticated;
alter table sciverse_private.ai_operations enable row level security;

comment on table sciverse_private.ai_operations is
  'Reserva de operaciones de IA para evitar cobros y generaciones duplicadas. La clave primaria (user_id, key) ES la garantía de concurrencia.';


-- ============================================================================
-- 2. RESERVAR
--
--    Devuelve `started` sólo a quien ADQUIRIÓ la operación. Cualquier otra
--    petición con la misma clave recibe `duplicate` y no debe cobrar ni
--    generar.
--
--    UNA EXCEPCIÓN DELIBERADA: si la operación anterior quedó en `failed`, se
--    permite volver a empezar con la misma clave. El caso real es una
--    generación que falló y la docente pulsa «reintentar» sin que el
--    navegador cambie la clave; negárselo la dejaría atascada.
--
--    DOS ADQUISICIONES ATÓMICAS, NINGUNA LECTURA PREVIA
--    --------------------------------------------------
--    Este bloque tuvo un fallo de concurrencia que conviene dejar explicado,
--    porque es fácil de reintroducir: leía el estado con un SELECT y decidía
--    después. Entre esa lectura y el UPDATE cabe otra transacción, así que
--    dos reintentos simultáneos sobre la MISMA operación fallida podían ver
--    los dos `failed` y declararse los dos `started`. Resultado: dos créditos
--    y dos llamadas a Gemini, que es justo lo que esta tabla existe para
--    impedir.
--
--    Un SELECT nunca es una garantía de exclusión. Las dos únicas sentencias
--    que deciden aquí son:
--
--      1. INSERT ... ON CONFLICT DO NOTHING   → gana quien inserta
--      2. UPDATE ... WHERE status = 'failed'  → gana quien transiciona
--
--    En la segunda, dos transacciones concurrentes se serializan sobre el
--    bloqueo de la fila: la que llega después reevalúa el WHERE contra la
--    fila ya actualizada, ve `processing` y afecta a CERO filas. Por eso la
--    respuesta la decide ROW_COUNT (`FOUND`), no lo que dijera un SELECT.
--
--    El SELECT del final sólo sirve para informar de qué estado había. Si
--    para entonces el dato hubiera cambiado, daría igual: la decisión ya está
--    tomada.
-- ============================================================================
create or replace function public.begin_ai_operation(
  p_key  text,
  p_tool text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_estado text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_key is null or p_key !~ '^[A-Za-z0-9._:-]{8,120}$' then
    raise exception 'IDEMPOTENCY_KEY_INVALID';
  end if;

  -- ---- Adquisición 1: la operación no existía ----------------------------
  insert into sciverse_private.ai_operations (user_id, key, tool, status)
  values (v_uid, p_key, p_tool, 'processing')
  on conflict (user_id, key) do nothing;

  if found then
    return jsonb_build_object('status', 'started', 'reintento', false);
  end if;

  -- ---- Adquisición 2: existía y estaba fallida ---------------------------
  -- Sólo transiciona quien encuentra la fila TODAVÍA en `failed`.
  update sciverse_private.ai_operations
     set status     = 'processing',
         tool       = coalesce(p_tool, tool),
         updated_at = now()
   where user_id = v_uid
     and key     = p_key
     and status  = 'failed';

  if found then
    return jsonb_build_object('status', 'started', 'reintento', true);
  end if;

  -- ---- No se adquirió: es un duplicado -----------------------------------
  -- Sólo informativo. `processing` (otra petición en curso) o `completed`.
  select status into v_estado
    from sciverse_private.ai_operations
   where user_id = v_uid and key = p_key;

  return jsonb_build_object('status', 'duplicate', 'estado_previo', v_estado);
end;
$$;


-- ============================================================================
-- 3. CERRAR
--
--    Antes devolvía `{ok:true}` pasara lo que pasara, incluso sin haber
--    tocado ninguna fila. Eso es peor que un error: un cliente que cierre una
--    clave equivocada recibiría confirmación de algo que no ocurrió, y el día
--    que la contabilidad no cuadre no habría por dónde empezar a mirar.
--
--    El UPDATE está acotado a `user_id = auth.uid()`, así que «no existe» y
--    «es de otra persona» producen exactamente la misma respuesta. Es
--    deliberado: distinguirlas confirmaría a un tercero que cierta clave
--    existe en la cuenta de alguien.
-- ============================================================================
create or replace function public.finish_ai_operation(
  p_key    text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_status not in ('completed', 'failed') then
    raise exception 'STATUS_INVALID';
  end if;

  update sciverse_private.ai_operations
     set status = p_status, updated_at = now()
   where user_id = v_uid and key = p_key;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;


-- ============================================================================
-- 4. LIMPIEZA
--
--    Sin `pg_cron` en este proyecto, así que no hay borrado automático. La
--    tabla crece una fila por generación: con 100 docentes generando cada
--    día son ~3.000 filas al mes, nada preocupante. Cuando estorbe, se
--    ejecuta esta función a mano o desde el panel.
--
--    NO se borran las de menos de 24 horas: son las que están protegiendo
--    algo ahora mismo.
-- ============================================================================
create or replace function public.purge_ai_operations(p_dias integer default 7)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dias integer := greatest(coalesce(p_dias, 7), 1);
  v_n    integer;
begin
  delete from sciverse_private.ai_operations
   where created_at < now() - (v_dias || ' days')::interval;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'borradas', v_n, 'dias', v_dias);
end;
$$;


-- ============================================================================
-- 5. PERMISOS
--    Revocar de PUBLIC, anon Y authenticated antes de conceder: los
--    privilegios por defecto del proyecto ya los concedieron al crear.
-- ============================================================================
revoke all on function public.begin_ai_operation(text, text)  from public, anon, authenticated;
revoke all on function public.finish_ai_operation(text, text) from public, anon, authenticated;
revoke all on function public.purge_ai_operations(integer)    from public, anon, authenticated;

-- La docente reserva y cierra SUS operaciones: la función resuelve auth.uid()
-- y no acepta un identificador de usuario como parámetro.
grant execute on function public.begin_ai_operation(text, text)  to authenticated, service_role;
grant execute on function public.finish_ai_operation(text, text) to authenticated, service_role;

-- La limpieza es de mantenimiento: sólo desde el servidor.
grant execute on function public.purge_ai_operations(integer) to service_role;


commit;


-- ============================================================================
-- COMPROBACIÓN  ·  solo lectura, después de aplicar
-- ============================================================================
--
--   select count(*) as operaciones,
--          count(*) filter (where status = 'processing') as en_curso,
--          count(*) filter (where status = 'completed')  as completadas,
--          count(*) filter (where status = 'failed')     as fallidas
--     from sciverse_private.ai_operations;
--
--   select has_function_privilege('anon','public.begin_ai_operation(text, text)','EXECUTE');
--   -- debe ser false
--
--
-- ============================================================================
-- PLAN DE ROLLBACK
-- ============================================================================
--
--   begin;
--   drop function if exists public.purge_ai_operations(integer);
--   drop function if exists public.finish_ai_operation(text, text);
--   drop function if exists public.begin_ai_operation(text, text);
--   drop table    if exists sciverse_private.ai_operations;
--   commit;
--
-- Revertir NO rompe la aplicación: `api/_lib/idempotency.js` detecta que la
-- función no existe, registra `sin_soporte` y deja pasar la generación. Se
-- vuelve al comportamiento anterior a este bloque, sin protección frente a
-- duplicados pero sin fallos.
-- ============================================================================
