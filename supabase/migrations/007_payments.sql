-- ============================================================================
-- 007_payments.sql   ·   PLANES COMERCIALES + PAGOS MANUALES + ACTIVACIÓN
--
--                    ⚠️  DISEÑADA · NO EJECUTADA  ⚠️
--
-- DEPENDE DE 002_commercial_core, 003_secure_ai_credits, 005_admin_core y
-- 006_admin_actions.
--
-- ALCANCE
--     · public.payment_requests    solicitudes de pago manual
--     · public.payment_settings    instrucciones de pago (sin datos inventados)
--     · plan `pro` sembrado INACTIVO, pendiente de decidir precio y límite
--     · request_plan / my_payment_requests        para el docente
--     · admin_list_payments / approve / reject    para administración
--
-- NO integra pasarela. NO implementa subida de comprobantes: eso exige bucket
-- privado, políticas, límites de tamaño y MIME, y URLs firmadas; va aparte.
-- NO retira ADMIN_SECRET.
--
-- ----------------------------------------------------------------------------
-- TRES DECISIONES QUE CONVIENE ENTENDER
-- ----------------------------------------------------------------------------
-- 1. EL PRECIO NO VIAJA DESDE EL NAVEGADOR, NUNCA.
--    `request_plan` recibe sólo el CÓDIGO del plan. El importe, la moneda y la
--    duración los lee de `public.plans` dentro de la propia función. Aunque
--    alguien manipule la petición, no puede comprar un plan por un sol.
--
-- 2. LA SOLICITUD GUARDA UNA INSTANTÁNEA.
--    Se copian importe, moneda, nombre y periodo en el momento de solicitar.
--    Si mañana sube el precio, el historial sigue diciendo lo que se pidió y
--    por cuánto. Sin eso, cambiar el catálogo reescribiría el pasado.
--
-- 3. APROBAR ES UNA SOLA TRANSACCIÓN.
--    Marcar el pago, cerrar la suscripción anterior, crear la nueva y escribir
--    la auditoría ocurren juntos o no ocurren. Nunca puede quedar un pago
--    aprobado sin plan activo, ni al revés.
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
  if to_regclass('public.plans') is null or to_regclass('public.subscriptions') is null then
    raise exception 'ABORTA: falta 002_commercial_core.sql';
  end if;
  if to_regclass('sciverse_private.admin_audit_log') is null then
    raise exception 'ABORTA: falta 005_admin_core.sql';
  end if;
  if to_regprocedure('sciverse_private.require_admin_role(uuid, text)') is null then
    raise exception 'ABORTA: falta 006_admin_actions.sql';
  end if;
end;
$$;


-- ============================================================================
-- 1. PLAN PRO — SEMBRADO INACTIVO A PROPÓSITO
--
--    `is_active = false` significa que NO aparece en el catálogo del docente
--    y que `admin_change_plan` lo rechaza. Es deliberado: los valores de
--    abajo son marcadores, no decisiones comerciales, y no deben llegar a
--    ninguna docente real.
--
--    Para activarlo, ver «CONFIGURACIÓN PENDIENTE» al final del fichero.
-- ============================================================================
insert into public.plans
  (code, name, description, ai_weekly_limit, price_cents, currency,
   billing_period_months, sort_order, is_active)
values
  ('pro', 'Pro', 'CONFIGURACIÓN PENDIENTE: definir descripción comercial.',
   0,      -- CONFIGURACIÓN PENDIENTE: límite semanal de IA
   0,      -- CONFIGURACIÓN PENDIENTE: precio en céntimos de sol
   'PEN', 1, 10, false)
on conflict (code) do nothing;

comment on column public.plans.price_cents is
  'Precio en céntimos. Lo lee el servidor al crear una solicitud; el navegador nunca lo envía.';


-- ============================================================================
-- 2. INSTRUCCIONES DE PAGO
--
--    Fila única, sembrada SIN CONFIGURAR. Mientras `is_configured` sea falso,
--    la aplicación muestra un aviso administrativo en lugar de un número de
--    cuenta inventado. Enseñar datos falsos de pago sería peor que no
--    enseñar nada.
-- ============================================================================
create table if not exists public.payment_settings (
  id             smallint    primary key default 1,
  is_configured  boolean     not null default false,
  method         text,
  receiver_name  text,
  account_number text,
  instructions   text,
  whatsapp       text,
  updated_at     timestamptz not null default now(),

  constraint payment_settings_singleton check (id = 1),
  constraint payment_settings_coherente check (
    not is_configured or (method is not null and instructions is not null))
);

insert into public.payment_settings (id, is_configured) values (1, false)
on conflict (id) do nothing;

alter table public.payment_settings enable row level security;
revoke all on public.payment_settings from public;
revoke all on public.payment_settings from anon, authenticated;
grant select on public.payment_settings to authenticated;

drop policy if exists "Instrucciones de pago visibles" on public.payment_settings;
create policy "Instrucciones de pago visibles"
  on public.payment_settings for select to authenticated using (true);


-- ============================================================================
-- 3. SOLICITUDES DE PAGO
--
--    `review_notes` es privado: no lo ve el docente. Se consigue no dando
--    acceso directo a la tabla — el docente lee por RPC, que elige columnas.
-- ============================================================================
create table if not exists public.payment_requests (
  id                     uuid        primary key default gen_random_uuid(),
  user_id                uuid        not null references auth.users(id) on delete cascade,
  plan_code              text        not null references public.plans(code) on update cascade,

  -- Instantánea del catálogo en el momento de solicitar.
  amount_cents           integer     not null,
  currency               char(3)     not null default 'PEN',
  plan_name              text        not null,
  billing_period_months  integer,

  method                 text        not null,
  reference              text,
  status                 text        not null default 'pending',

  requested_at           timestamptz not null default now(),
  reviewed_at            timestamptz,
  reviewed_by            uuid        references auth.users(id) on delete set null,
  review_notes           text,
  subscription_id        uuid        references public.subscriptions(id) on delete set null,
  updated_at             timestamptz not null default now(),

  constraint payment_requests_status_valid check (
    status in ('pending', 'approved', 'rejected', 'cancelled')),
  constraint payment_requests_method_valid check (
    method in ('yape', 'plin', 'transferencia', 'efectivo', 'otro')),
  constraint payment_requests_amount_min check (amount_cents >= 0),
  constraint payment_requests_review_coherente check (
    (status = 'pending') = (reviewed_at is null)),
  constraint payment_requests_rechazo_con_motivo check (
    status <> 'rejected' or nullif(btrim(coalesce(review_notes, '')), '') is not null)
);

-- Una sola solicitud pendiente por docente y plan. Lo impone la BASE: la API
-- también avisa, pero no depende de que la API acierte.
create unique index if not exists payment_requests_one_pending
  on public.payment_requests (user_id, plan_code)
  where status = 'pending';

create index if not exists payment_requests_bandeja_idx
  on public.payment_requests (status, requested_at desc);
create index if not exists payment_requests_user_idx
  on public.payment_requests (user_id, requested_at desc);

alter table public.payment_requests enable row level security;
revoke all on public.payment_requests from public;
revoke all on public.payment_requests from anon, authenticated;
-- Sin políticas ni grants para el cliente: todo pasa por RPC. Así `review_notes`
-- no puede filtrarse por mucho que cambien las políticas más adelante.

comment on table public.payment_requests is
  'Solicitudes de pago manual. El importe lo fija el servidor desde plans, nunca el cliente.';


-- ============================================================================
-- 4. EL DOCENTE SOLICITA UN PLAN
--
--    Recibe el CÓDIGO del plan y nada más que afecte al dinero.
-- ============================================================================
create or replace function public.request_plan(
  p_plan      text,
  p_method    text default 'yape',
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_req  public.payment_requests%rowtype;
  v_act  record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  if not exists (select 1 from public.docentes where user_id = v_uid) then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  select * into v_plan from public.plans where code = p_plan and is_active;
  if not found then raise exception 'PLAN_NOT_FOUND'; end if;

  -- El gratuito no se solicita: se tiene.
  if v_plan.price_cents = 0 then raise exception 'PLAN_NOT_PURCHASABLE'; end if;

  -- Si ya tiene ese mismo plan vigente, la compra no es una alta: sería una
  -- renovación, y esa decisión se toma aparte para no cobrar dos veces por
  -- error. Ver «RENOVACIÓN» en la documentación del bloque.
  select * into v_act from sciverse_private.effective_plan(v_uid);
  if v_act.plan_code = p_plan and not v_act.is_fallback then
    raise exception 'PLAN_ALREADY_ACTIVE';
  end if;

  begin
    insert into public.payment_requests
      (user_id, plan_code, amount_cents, currency, plan_name,
       billing_period_months, method, reference)
    values
      (v_uid, v_plan.code, v_plan.price_cents, v_plan.currency, v_plan.name,
       v_plan.billing_period_months,
       coalesce(nullif(btrim(coalesce(p_method, '')), ''), 'yape'),
       nullif(btrim(coalesce(p_reference, '')), ''))
    returning * into v_req;
  exception when unique_violation then
    raise exception 'REQUEST_ALREADY_PENDING';
  end;

  insert into sciverse_private.admin_audit_log
    (admin_user_id, admin_role, action, target_user_id, entity_type, entity_id,
     after_data, metadata)
  values
    (null, 'docente', 'PAYMENT_REQUESTED', v_uid, 'payment_request', v_req.id,
     jsonb_build_object('plan', v_req.plan_code,
                        'monto_centimos', v_req.amount_cents,
                        'moneda', v_req.currency),
     jsonb_build_object('metodo', v_req.method));

  return jsonb_build_object(
    'ok', true, 'id', v_req.id, 'plan', v_req.plan_code,
    'plan_nombre', v_req.plan_name, 'monto_centimos', v_req.amount_cents,
    'moneda', v_req.currency, 'estado', v_req.status);
end;
$$;


-- ============================================================================
-- 5. EL DOCENTE VE SUS SOLICITUDES
--    Sin `review_notes`: las notas del administrador son internas.
-- ============================================================================
create or replace function public.my_payment_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id',             r.id,
             'plan',           r.plan_code,
             'plan_nombre',    r.plan_name,
             'monto_centimos', r.amount_cents,
             'moneda',         r.currency,
             'metodo',         r.method,
             'referencia',     r.reference,
             'estado',         r.status,
             'solicitado',     r.requested_at,
             'revisado',       r.reviewed_at)
           order by r.requested_at desc)
      from (select * from public.payment_requests
             where user_id = v_uid
             order by requested_at desc limit 20) r), '[]'::jsonb);
end;
$$;


-- ============================================================================
-- 6. BANDEJA DE ADMINISTRACIÓN
--    Pendientes primero: son las únicas con alguien esperando al otro lado.
-- ============================================================================
create or replace function public.admin_list_payments(
  p_status    text default null,
  p_search    text default null,
  p_page      integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_size   integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_page   integer := greatest(coalesce(p_page, 1), 1);
  v_offset integer := (v_page - 1) * v_size;
  v_term   text := nullif(btrim(coalesce(p_search, '')), '');
  v_state  text := nullif(btrim(coalesce(p_status, '')), '');
  v_total  bigint;
  v_rows   jsonb;
begin
  select count(*) into v_total
    from public.payment_requests r
    join public.docentes d on d.user_id = r.user_id
    left join auth.users u on u.id = r.user_id
   where (v_state is null or r.status = v_state)
     and (v_term is null
          or d.nombres ilike '%' || v_term || '%'
          or d.apellidos ilike '%' || v_term || '%'
          or u.email ilike '%' || v_term || '%');

  select coalesce(jsonb_agg(fila), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
             'id',             r.id,
             'user_id',        r.user_id,
             'docente',        d.nombres || ' ' || d.apellidos,
             'ie',             d.ie,
             'email',          u.email,
             'plan',           r.plan_code,
             'plan_nombre',    r.plan_name,
             'monto_centimos', r.amount_cents,
             'moneda',         r.currency,
             'meses',          r.billing_period_months,
             'metodo',         r.method,
             'referencia',     r.reference,
             'estado',         r.status,
             'solicitado',     r.requested_at,
             'revisado',       r.reviewed_at,
             'notas',          r.review_notes,
             'revisor',        (select dd.nombres || ' ' || dd.apellidos
                                  from public.docentes dd where dd.user_id = r.reviewed_by)
           ) as fila
      from public.payment_requests r
      join public.docentes d on d.user_id = r.user_id
      left join auth.users u on u.id = r.user_id
     where (v_state is null or r.status = v_state)
       and (v_term is null
            or d.nombres ilike '%' || v_term || '%'
            or d.apellidos ilike '%' || v_term || '%'
            or u.email ilike '%' || v_term || '%')
     -- Pendientes arriba, y dentro de cada grupo lo más reciente primero.
     order by (r.status = 'pending') desc, r.requested_at desc
     limit v_size offset v_offset
  ) s;

  return jsonb_build_object(
    'items', v_rows, 'total', v_total, 'page', v_page, 'page_size', v_size,
    'pages', greatest(ceil(v_total::numeric / v_size)::integer, 1),
    'pendientes', (select count(*) from public.payment_requests where status = 'pending'));
end;
$$;


-- ============================================================================
-- 7. APROBAR — TODO EN UNA TRANSACCIÓN
--
--    Marca el pago, cierra la suscripción vigente, crea la nueva y audita.
--    Si algo falla, no queda nada a medias.
-- ============================================================================
create or replace function public.admin_approve_payment(
  p_actor   uuid,
  p_request uuid,
  p_notes   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role   text := sciverse_private.require_admin_role(p_actor, 'admin');
  v_req    public.payment_requests%rowtype;
  v_plan   public.plans%rowtype;
  v_actual public.subscriptions%rowtype;
  v_nueva  public.subscriptions%rowtype;
  v_hasta  timestamptz;
begin
  if p_request is null then raise exception 'REQUEST_REQUIRED'; end if;

  -- Bloquea la solicitud: dos administradores a la vez se serializan aquí.
  select * into v_req from public.payment_requests where id = p_request for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;

  -- El segundo en llegar encuentra que ya no está pendiente y se detiene.
  if v_req.status <> 'pending' then raise exception 'REQUEST_NOT_PENDING'; end if;

  select * into v_plan from public.plans where code = v_req.plan_code;
  if not found then raise exception 'PLAN_NOT_FOUND'; end if;

  -- La vigencia sale del periodo guardado en la solicitud, no del catálogo
  -- actual: si el plan cambió de duración, se respeta lo que se compró.
  v_hasta := case when v_req.billing_period_months is null then null
                  else now() + (v_req.billing_period_months || ' months')::interval end;

  select * into v_actual
    from public.subscriptions
   where user_id = v_req.user_id and status = 'active'
     for update;

  if found then
    update public.subscriptions
       set status = 'cancelled', cancelled_at = now(),
           cancel_reason = 'Reemplazada por pago aprobado', updated_at = now()
     where id = v_actual.id;
  end if;

  insert into public.subscriptions
    (user_id, plan_code, status, source, starts_at, ends_at)
  values
    (v_req.user_id, v_req.plan_code, 'active', 'manual_payment', now(), v_hasta)
  returning * into v_nueva;

  update public.payment_requests
     set status = 'approved', reviewed_at = now(), reviewed_by = p_actor,
         review_notes = nullif(btrim(coalesce(p_notes, '')), ''),
         subscription_id = v_nueva.id, updated_at = now()
   where id = v_req.id;

  -- Un solo evento. `after_data` ya lleva la suscripción creada, así que un
  -- SUBSCRIPTION_ACTIVATED aparte sería el mismo hecho contado dos veces.
  insert into sciverse_private.admin_audit_log
    (admin_user_id, admin_role, action, target_user_id, entity_type, entity_id,
     before_data, after_data, metadata)
  values
    (p_actor, v_role, 'PAYMENT_APPROVED', v_req.user_id, 'payment_request', v_req.id,
     jsonb_build_object('estado', 'pending',
                        'plan_anterior', v_actual.plan_code),
     jsonb_build_object('estado', 'approved',
                        'plan', v_nueva.plan_code,
                        'desde', v_nueva.starts_at,
                        'hasta', v_nueva.ends_at,
                        'suscripcion', v_nueva.id),
     jsonb_build_object('monto_centimos', v_req.amount_cents,
                        'moneda', v_req.currency,
                        'metodo', v_req.method,
                        'notas', nullif(btrim(coalesce(p_notes, '')), '')));

  return jsonb_build_object(
    'ok', true, 'plan', v_nueva.plan_code,
    'desde', v_nueva.starts_at, 'hasta', v_nueva.ends_at);

exception
  when unique_violation then
    raise exception 'CONCURRENT_CHANGE';
end;
$$;


-- ============================================================================
-- 8. RECHAZAR — EXIGE MOTIVO Y NO TOCA LA SUSCRIPCIÓN
-- ============================================================================
create or replace function public.admin_reject_payment(
  p_actor   uuid,
  p_request uuid,
  p_reason  text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role   text := sciverse_private.require_admin_role(p_actor, 'admin');
  v_req    public.payment_requests%rowtype;
  v_motivo text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_request is null then raise exception 'REQUEST_REQUIRED'; end if;
  if v_motivo is null then raise exception 'REASON_REQUIRED'; end if;

  select * into v_req from public.payment_requests where id = p_request for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status <> 'pending' then raise exception 'REQUEST_NOT_PENDING'; end if;

  update public.payment_requests
     set status = 'rejected', reviewed_at = now(), reviewed_by = p_actor,
         review_notes = v_motivo, updated_at = now()
   where id = v_req.id;

  insert into sciverse_private.admin_audit_log
    (admin_user_id, admin_role, action, target_user_id, entity_type, entity_id,
     before_data, after_data, metadata)
  values
    (p_actor, v_role, 'PAYMENT_REJECTED', v_req.user_id, 'payment_request', v_req.id,
     jsonb_build_object('estado', 'pending'),
     jsonb_build_object('estado', 'rejected'),
     jsonb_build_object('motivo', v_motivo,
                        'monto_centimos', v_req.amount_cents));

  -- La suscripción vigente no se toca: un pago rechazado no quita lo que ya
  -- se tenía.
  return jsonb_build_object('ok', true, 'estado', 'rejected');
end;
$$;


-- ============================================================================
-- 9. PERMISOS
--    Revocar de PUBLIC, anon Y authenticated antes de conceder: los
--    privilegios por defecto del proyecto ya los concedieron al crear cada
--    función.
-- ============================================================================
revoke all on function public.request_plan(text, text, text)                        from public, anon, authenticated;
revoke all on function public.my_payment_requests()                                 from public, anon, authenticated;
revoke all on function public.admin_list_payments(text, text, integer, integer)     from public, anon, authenticated;
revoke all on function public.admin_approve_payment(uuid, uuid, text)               from public, anon, authenticated;
revoke all on function public.admin_reject_payment(uuid, uuid, text)                from public, anon, authenticated;

-- El docente sí puede pedir un plan y ver lo suyo.
grant execute on function public.request_plan(text, text, text) to authenticated, service_role;
grant execute on function public.my_payment_requests()          to authenticated, service_role;

-- Lo demás, sólo desde el servidor.
grant execute on function public.admin_list_payments(text, text, integer, integer) to service_role;
grant execute on function public.admin_approve_payment(uuid, uuid, text)           to service_role;
grant execute on function public.admin_reject_payment(uuid, uuid, text)            to service_role;


commit;


-- ============================================================================
-- CONFIGURACIÓN PENDIENTE  ·  ejecutar aparte, cuando el equipo decida
-- ============================================================================
--
-- Nada de esto se ejecuta con la migración: son decisiones comerciales, no
-- de código. Hasta que se hagan, el plan Pro no aparece en el catálogo y la
-- aplicación avisa de que el método de pago no está configurado, en lugar de
-- enseñar un número de cuenta falso.
--
-- 1) PRECIO Y LÍMITE DEL PLAN PRO, y activarlo:
--
--   update public.plans
--      set name                  = '<Nombre comercial>',
--          description           = '<Descripción para la tarjeta>',
--          ai_weekly_limit       = <generaciones por semana>,
--          price_cents           = <precio en céntimos de sol>,
--          billing_period_months = <meses de vigencia>,
--          is_active             = true,
--          updated_at            = now()
--    where code = 'pro';
--
-- 2) INSTRUCCIONES DE PAGO:
--
--   update public.payment_settings
--      set method         = '<yape | plin | transferencia>',
--          receiver_name  = '<Nombre del receptor>',
--          account_number = '<número o cuenta>',
--          instructions   = '<Qué debe hacer la docente, paso a paso>',
--          whatsapp       = '<número de contacto>',
--          is_configured  = true,
--          updated_at     = now()
--    where id = 1;
--
-- 3) Comprobar con supabase/inspect/010_verify_payments.sql.
--
--
-- ============================================================================
-- RENOVACIÓN  ·  todavía no implementada, y a propósito
-- ============================================================================
-- `request_plan` rechaza con PLAN_ALREADY_ACTIVE si el docente ya tiene ese
-- mismo plan vigente. Es la salvaguarda contra cobrar dos veces por lo mismo.
-- Cuando haga falta renovar de verdad, la pieza que falta es distinguir «alta»
-- de «renovación»: la renovación sumaría meses a `ends_at` en vez de crear una
-- suscripción nueva, y debería pedirse cerca del vencimiento. No se adelanta
-- aquí porque todavía no hay ni un plan de pago activo.
--
--
-- ============================================================================
-- PLAN DE ROLLBACK
-- ============================================================================
--
--   begin;
--   drop function if exists public.admin_reject_payment(uuid, uuid, text);
--   drop function if exists public.admin_approve_payment(uuid, uuid, text);
--   drop function if exists public.admin_list_payments(text, text, integer, integer);
--   drop function if exists public.my_payment_requests();
--   drop function if exists public.request_plan(text, text, text);
--   drop table    if exists public.payment_requests;    -- PIERDE LAS SOLICITUDES
--   drop table    if exists public.payment_settings;
--   delete from public.plans where code = 'pro' and not is_active;
--   commit;
--
-- Las suscripciones ya activadas por un pago aprobado NO se revierten: son
-- planes que alguien pagó. Revertir esta migración deja el sistema como
-- estaba en Admin 2, con esas suscripciones intactas.
-- ============================================================================
