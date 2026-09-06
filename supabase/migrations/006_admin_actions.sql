-- ============================================================================
-- 006_admin_actions.sql   ·   ACCIONES ADMINISTRATIVAS SOBRE DOCENTES
--
--                    ⚠️  DISEÑADA · NO EJECUTADA  ⚠️
--
-- DEPENDE DE 002_commercial_core, 003_secure_ai_credits y 005_admin_core.
--
-- ALCANCE — cuatro operaciones, todas transaccionales y auditadas:
--     · admin_set_account_status  suspender / reactivar
--     · admin_change_plan         cambiar de plan conservando el historial
--     · admin_extend_plan         extender la vigencia del plan actual
--     · admin_audit_recent        leer la auditoría (solo lectura)
--
-- NO crea planes de pago: el catálogo lo decide el equipo cuando fije nombres
-- y precios. Al final del fichero hay la plantilla exacta del INSERT.
--
-- NO retira ADMIN_SECRET ni toca `api/list-docentes.js`.
--
-- ----------------------------------------------------------------------------
-- DOS DECISIONES QUE CONVIENE ENTENDER
-- ----------------------------------------------------------------------------
-- 1. EL ACTOR VIAJA COMO PARÁMETRO, Y AUN ASÍ SE VUELVE A COMPROBAR.
--    Estas funciones se invocan con `service_role`, así que `auth.uid()` es
--    NULL: no hay forma de saber quién actúa salvo que el backend lo diga.
--    Podría bastar con que la API valide antes —y lo hace—, pero cada función
--    vuelve a comprobar que `p_actor` sea un administrador ACTIVO con rango
--    suficiente. Si mañana un fallo en la API dejara pasar a alguien, la base
--    seguiría rechazándolo.
--
-- 2. EL HISTORIAL NO SE SOBRESCRIBE.
--    Cambiar de plan NO edita la suscripción vigente: la cierra como
--    'cancelled' y crea una nueva. Así queda registrado qué plan tuvo cada
--    docente y desde cuándo. El índice único parcial de 002 garantiza que
--    nunca haya dos activas, incluso si dos administradores pulsan a la vez:
--    el segundo choca con el índice y su transacción entera se deshace.
--
-- GARANTÍAS
--     · No borra datos ni columnas.   · No recrea tablas.
--     · No desactiva RLS.             · Idempotente y transaccional.
-- ============================================================================

begin;


-- ============================================================================
-- 0. PRECONDICIONES
-- ============================================================================
do $$
begin
  if to_regclass('sciverse_private.admin_users') is null then
    raise exception 'ABORTA: falta 005_admin_core.sql';
  end if;
  if to_regclass('sciverse_private.admin_audit_log') is null then
    raise exception 'ABORTA: falta la tabla de auditoría de 005_admin_core.sql';
  end if;
  if to_regclass('public.subscriptions') is null then
    raise exception 'ABORTA: falta 002_commercial_core.sql';
  end if;
end;
$$;


-- ============================================================================
-- 1. RANGO DEL ACTOR
--    Devuelve el rol si es administrador activo con rango suficiente; si no,
--    lanza. Se usa al principio de cada acción.
-- ============================================================================
create or replace function sciverse_private.require_admin_role(
  p_actor uuid,
  p_min   text default 'admin'
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_rank integer;
  v_min  integer := case p_min when 'support' then 1 when 'admin' then 2
                               when 'superadmin' then 3 else 99 end;
begin
  if p_actor is null then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select a.role into v_role
    from sciverse_private.admin_users a
   where a.user_id = p_actor and a.is_active;

  if v_role is null then
    raise exception 'ADMIN_REQUIRED';
  end if;

  v_rank := case v_role when 'support' then 1 when 'admin' then 2
                        when 'superadmin' then 3 else 0 end;

  if v_rank < v_min then
    raise exception 'ADMIN_ROLE_INSUFFICIENT';
  end if;

  return v_role;
end;
$$;


-- ============================================================================
-- 2. SUSPENDER / REACTIVAR
--
--    Una cuenta suspendida no puede generar: `consume_ai_credit()` ya lanza
--    ACCOUNT_INACTIVE cuando `docentes.activo` es falso, así que basta con
--    tocar esa columna. No hace falta duplicar la comprobación en ningún sitio.
-- ============================================================================
create or replace function public.admin_set_account_status(
  p_actor  uuid,
  p_target uuid,
  p_active boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role   text := sciverse_private.require_admin_role(p_actor, 'admin');
  v_doc    public.docentes%rowtype;
  v_antes  boolean;
begin
  if p_target is null then
    raise exception 'TARGET_REQUIRED';
  end if;

  select * into v_doc from public.docentes where user_id = p_target for update;
  if not found then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  v_antes := v_doc.activo;

  if v_antes = p_active then
    return jsonb_build_object(
      'ok', true, 'sin_cambios', true, 'activo', v_antes);
  end if;

  update public.docentes
     set activo = p_active
   where user_id = p_target
  returning * into v_doc;

  insert into sciverse_private.admin_audit_log
    (admin_user_id, admin_role, action, target_user_id, entity_type,
     before_data, after_data, metadata)
  values
    (p_actor, v_role,
     case when p_active then 'ADMIN_REACTIVATED_USER' else 'ADMIN_SUSPENDED_USER' end,
     p_target, 'docente',
     jsonb_build_object('activo', v_antes),
     jsonb_build_object('activo', p_active),
     jsonb_build_object('motivo', nullif(btrim(coalesce(p_reason, '')), '')));

  return jsonb_build_object('ok', true, 'sin_cambios', false, 'activo', v_doc.activo);
end;
$$;


-- ============================================================================
-- 3. CAMBIAR DE PLAN
--
--    Cierra la suscripción vigente y crea una nueva. Todo en la misma
--    transacción: no puede quedar alguien sin plan ni con dos.
--
--    `p_months` NULL = sin vencimiento (el caso del gratuito).
-- ============================================================================
create or replace function public.admin_change_plan(
  p_actor  uuid,
  p_target uuid,
  p_plan   text,
  p_months integer default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role    text := sciverse_private.require_admin_role(p_actor, 'admin');
  v_plan    public.plans%rowtype;
  v_actual  public.subscriptions%rowtype;
  v_nueva   public.subscriptions%rowtype;
  v_hasta   timestamptz;
begin
  if p_target is null then raise exception 'TARGET_REQUIRED'; end if;

  if not exists (select 1 from public.docentes where user_id = p_target) then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  select * into v_plan from public.plans where code = p_plan and is_active;
  if not found then
    raise exception 'PLAN_NOT_FOUND';
  end if;

  if p_months is not null and (p_months < 1 or p_months > 36) then
    raise exception 'DURATION_OUT_OF_RANGE';
  end if;

  v_hasta := case when p_months is null then null
                  else now() + (p_months || ' months')::interval end;

  -- Bloquea la vigente: dos administradores a la vez se serializan aquí.
  select * into v_actual
    from public.subscriptions
   where user_id = p_target and status = 'active'
     for update;

  if found then
    if v_actual.plan_code = p_plan and v_actual.ends_at is not distinct from v_hasta then
      return jsonb_build_object('ok', true, 'sin_cambios', true, 'plan', p_plan);
    end if;

    update public.subscriptions
       set status = 'cancelled',
           cancelled_at = now(),
           cancel_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''),
                                    'Reemplazada por cambio de plan'),
           updated_at = now()
     where id = v_actual.id;
  end if;

  insert into public.subscriptions
    (user_id, plan_code, status, source, starts_at, ends_at)
  values
    (p_target, p_plan, 'active', 'admin_manual', now(), v_hasta)
  returning * into v_nueva;

  insert into sciverse_private.admin_audit_log
    (admin_user_id, admin_role, action, target_user_id, entity_type, entity_id,
     before_data, after_data, metadata)
  values
    (p_actor, v_role, 'ADMIN_CHANGED_PLAN', p_target, 'subscription', v_nueva.id,
     case when v_actual.id is null then null
          else jsonb_build_object('plan', v_actual.plan_code,
                                  'desde', v_actual.starts_at,
                                  'hasta', v_actual.ends_at) end,
     jsonb_build_object('plan', v_nueva.plan_code,
                        'desde', v_nueva.starts_at,
                        'hasta', v_nueva.ends_at),
     jsonb_build_object('meses', p_months,
                        'motivo', nullif(btrim(coalesce(p_reason, '')), '')));

  return jsonb_build_object(
    'ok', true, 'sin_cambios', false,
    'plan', v_nueva.plan_code, 'desde', v_nueva.starts_at, 'hasta', v_nueva.ends_at);

exception
  when unique_violation then
    -- El índice parcial de 002 hizo su trabajo: otro administrador cambió
    -- este plan mientras tanto y su transacción llegó primero.
    raise exception 'CONCURRENT_CHANGE';
end;
$$;


-- ============================================================================
-- 4. EXTENDER LA VIGENCIA
--    Sobre la suscripción activa. Si no vence, no hay nada que extender.
-- ============================================================================
create or replace function public.admin_extend_plan(
  p_actor  uuid,
  p_target uuid,
  p_months integer,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role   text := sciverse_private.require_admin_role(p_actor, 'admin');
  v_sub    public.subscriptions%rowtype;
  v_antes  timestamptz;
  v_nuevo  timestamptz;
begin
  if p_target is null then raise exception 'TARGET_REQUIRED'; end if;
  if p_months is null or p_months < 1 or p_months > 36 then
    raise exception 'DURATION_OUT_OF_RANGE';
  end if;

  select * into v_sub
    from public.subscriptions
   where user_id = p_target and status = 'active'
     for update;

  if not found then
    raise exception 'NO_ACTIVE_SUBSCRIPTION';
  end if;

  if v_sub.ends_at is null then
    raise exception 'PLAN_HAS_NO_EXPIRY';
  end if;

  v_antes := v_sub.ends_at;
  -- Si ya venció, se cuenta desde hoy: extender hacia atrás no serviría.
  v_nuevo := greatest(v_antes, now()) + (p_months || ' months')::interval;

  update public.subscriptions
     set ends_at = v_nuevo, updated_at = now()
   where id = v_sub.id;

  insert into sciverse_private.admin_audit_log
    (admin_user_id, admin_role, action, target_user_id, entity_type, entity_id,
     before_data, after_data, metadata)
  values
    (p_actor, v_role, 'ADMIN_EXTENDED_PLAN', p_target, 'subscription', v_sub.id,
     jsonb_build_object('hasta', v_antes),
     jsonb_build_object('hasta', v_nuevo),
     jsonb_build_object('meses', p_months,
                        'motivo', nullif(btrim(coalesce(p_reason, '')), '')));

  return jsonb_build_object('ok', true, 'plan', v_sub.plan_code,
                            'hasta_antes', v_antes, 'hasta', v_nuevo);
end;
$$;


-- ============================================================================
-- 5. LEER LA AUDITORÍA  (solo lectura · para la ficha del docente)
-- ============================================================================
create or replace function public.admin_audit_recent(
  p_target uuid default null,
  p_limit  integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'accion',   l.action,
             'rol',      l.admin_role,
             'fecha',    l.created_at,
             'antes',    l.before_data,
             'despues',  l.after_data,
             'motivo',   l.metadata->>'motivo',
             'actor',    coalesce(
                           (select d.nombres || ' ' || d.apellidos
                              from public.docentes d where d.user_id = l.admin_user_id),
                           (select u.email::text from auth.users u where u.id = l.admin_user_id),
                           'Equipo SciVerse'))
           order by l.created_at desc)
      from (select * from sciverse_private.admin_audit_log
             where p_target is null or target_user_id = p_target
             order by created_at desc
             limit v_limit) l), '[]'::jsonb);
end;
$$;


-- ============================================================================
-- 6. PERMISOS
--    Se revoca de PUBLIC, anon Y authenticated antes de conceder: los
--    privilegios por defecto del proyecto ya los concedieron al crear cada
--    función. Sólo `service_role` puede invocarlas, y esa clave vive
--    exclusivamente en el servidor.
-- ============================================================================
revoke all on function sciverse_private.require_admin_role(uuid, text)                from public, anon, authenticated;
revoke all on function public.admin_set_account_status(uuid, uuid, boolean, text)     from public, anon, authenticated;
revoke all on function public.admin_change_plan(uuid, uuid, text, integer, text)      from public, anon, authenticated;
revoke all on function public.admin_extend_plan(uuid, uuid, integer, text)            from public, anon, authenticated;
revoke all on function public.admin_audit_recent(uuid, integer)                       from public, anon, authenticated;

grant execute on function public.admin_set_account_status(uuid, uuid, boolean, text) to service_role;
grant execute on function public.admin_change_plan(uuid, uuid, text, integer, text)  to service_role;
grant execute on function public.admin_extend_plan(uuid, uuid, integer, text)        to service_role;
grant execute on function public.admin_audit_recent(uuid, integer)                   to service_role;
grant execute on function sciverse_private.require_admin_role(uuid, text)            to service_role;


commit;


-- ============================================================================
-- CATÁLOGO DE PLANES DE PAGO  ·  ejecutar aparte, cuando se decidan
-- ============================================================================
--
-- Este bloque NO se ejecuta con la migración: los nombres y precios los fija
-- el equipo, no el código. Cuando estén decididos, esta es la plantilla.
-- Mientras tanto, «Cambiar plan» sólo ofrecerá el gratuito.
--
--   insert into public.plans
--     (code, name, description, ai_weekly_limit, price_cents, currency,
--      billing_period_months, sort_order, is_active)
--   values
--     ('<codigo>', '<Nombre visible>', '<Descripción breve>',
--      <limite_semanal>, <precio_en_centimos>, 'PEN',
--      <meses_de_vigencia>, <orden>, true)
--   on conflict (code) do update
--     set name = excluded.name,
--         description = excluded.description,
--         ai_weekly_limit = excluded.ai_weekly_limit,
--         price_cents = excluded.price_cents,
--         updated_at = now();
--
-- El `code` debe cumplir el CHECK de 002: minúsculas, dígitos y guion bajo.
--
--
-- ============================================================================
-- PLAN DE ROLLBACK
-- ============================================================================
--
--   begin;
--   drop function if exists public.admin_audit_recent(uuid, integer);
--   drop function if exists public.admin_extend_plan(uuid, uuid, integer, text);
--   drop function if exists public.admin_change_plan(uuid, uuid, text, integer, text);
--   drop function if exists public.admin_set_account_status(uuid, uuid, boolean, text);
--   drop function if exists sciverse_private.require_admin_role(uuid, text);
--   commit;
--
-- No se pierde nada: las suscripciones, la auditoría y los estados de cuenta
-- ya escritos se conservan. El panel vuelve a ser de solo lectura, que es el
-- estado de Admin 1, y `?admin=legacy` sigue disponible.
-- ============================================================================
