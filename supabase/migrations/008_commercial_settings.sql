-- ============================================================================
-- 008_commercial_settings.sql   ·   CONFIGURACIÓN COMERCIAL ADMINISTRABLE
--
--                    ⚠️  DISEÑADA · NO EJECUTADA  ⚠️
--
-- DEPENDE DE 002_commercial_core, 003_secure_ai_credits, 005_admin_core,
-- 006_admin_actions y 007_payments  (007 YA ESTÁ EN PRODUCCIÓN).
--
-- PROPÓSITO
--     Que el precio, el límite de IA y los datos de pago se cambien desde el
--     panel de administración, sin migraciones ni despliegues. Hoy esos
--     valores sólo se pueden tocar entrando a Supabase; después de esta
--     migración, no.
--
-- ALCANCE
--     · plans.benefits                      viñetas que ve la docente
--     · public.payment_methods              configuración POR MÉTODO (Yape, Plin…)
--     · payment_settings.manual_payments_enabled
--     · bucket privado `payment-assets`     para el QR
--     · seis RPC de administración          catálogo y pagos
--     · admin_approve_payment               emite SUBSCRIPTION_ACTIVATED aparte
--     · plan Pro activado: S/ 20 · 1 mes · 100 IA/semana
--     · Yape y Plin habilitados a nombre de Keytlin · 931582435
--
-- NO integra pasarela. NO retira ADMIN_SECRET. NO toca Auth ni SMTP.
--
-- ----------------------------------------------------------------------------
-- CUATRO DECISIONES QUE CONVIENE ENTENDER
-- ----------------------------------------------------------------------------
-- 1. LA CONFIGURACIÓN DE PAGO SE VUELVE RELACIONAL.
--    007 guardaba UN método en `payment_settings`. Yape y Plin comparten hoy
--    receptor y número, pero mañana no tienen por qué. `payment_methods` da
--    una fila por método, con su receptor, su número y su QR propios. Lo
--    que sigue siendo global —instrucciones, WhatsApp, interruptor general—
--    se queda en `payment_settings`, que es donde tiene sentido.
--
-- 2. LAS COLUMNAS VIEJAS NO SE BORRAN: SE COPIAN Y SE JUBILAN.
--    `payment_settings.method / receiver_name / account_number` quedan como
--    estaban, con un COMMENT que dice que ya no se leen. Borrar columnas en
--    una tabla que ya está en producción es un riesgo que no compensa por
--    tres campos vacíos. La limpieza está escrita al final del fichero.
--
-- 3. EL QR VIVE EN STORAGE, NUNCA EN POSTGRES.
--    La base guarda una RUTA, validada con expresión regular para que ni
--    siquiera una API comprometida pueda apuntarla a cualquier cosa. El
--    fichero vive en un bucket PRIVADO con límite de 2 MB y lista blanca de
--    MIME impuesta por el propio Storage, no sólo por la API.
--
-- 4. APROBAR UN PAGO PASA A EMITIR DOS EVENTOS.
--    PAYMENT_APPROVED  = el dinero se dio por bueno.
--    SUBSCRIPTION_ACTIVATED = el acceso comercial quedó activo.
--    Son dos hechos distintos aunque hoy ocurran en la misma transacción: el
--    día que haya pasarela, el primero llegará por webhook y el segundo
--    seguirá siendo nuestro. Separarlos ahora evita reescribir el historial.
--
-- GARANTÍAS
--     · No borra solicitudes, suscripciones, planes ni usuarios.
--     · No recrea tablas.            · No desactiva RLS.
--     · Idempotente y transaccional.
--     · La siembra comercial SÓLO se aplica si nadie la ha tocado antes
--       (ver paso 9): re-ejecutar la migración nunca pisa un precio que un
--       administrador haya cambiado desde el panel.
-- ============================================================================

begin;


-- ============================================================================
-- 0. PRECONDICIONES
-- ============================================================================
do $$
begin
  if to_regclass('public.plans') is null
     or to_regclass('public.subscriptions') is null then
    raise exception 'ABORTA: falta 002_commercial_core.sql';
  end if;
  if to_regclass('public.payment_requests') is null
     or to_regclass('public.payment_settings') is null then
    raise exception 'ABORTA: falta 007_payments.sql';
  end if;
  if to_regprocedure('sciverse_private.require_admin_role(uuid, text)') is null then
    raise exception 'ABORTA: falta 006_admin_actions.sql';
  end if;
end;
$$;


-- ============================================================================
-- 1. BENEFICIOS VISIBLES DEL PLAN
--
--    Columna propia y no `features`: `features` documenta interruptores que
--    el backend podría llegar a interpretar; esto es texto de escaparate y
--    nada más. Mezclarlos invita a que alguien acabe decidiendo permisos
--    leyendo una viñeta de marketing.
-- ============================================================================
alter table public.plans
  add column if not exists benefits text[] not null default '{}'::text[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plans_benefits_max') then
    alter table public.plans
      add constraint plans_benefits_max
      check (coalesce(array_length(benefits, 1), 0) <= 8);
  end if;
end;
$$;

comment on column public.plans.benefits is
  'Viñetas que ve la docente en la tarjeta del plan. Sólo presentación: el backend no decide nada con esto.';


-- ============================================================================
-- 2. CONFIGURACIÓN POR MÉTODO DE PAGO
--
--    Los códigos son los mismos que acepta `payment_requests.method`, para
--    que no puedan divergir. Un método no se puede habilitar sin receptor ni
--    número: enseñar un método de pago vacío es peor que no ofrecerlo.
-- ============================================================================
create table if not exists public.payment_methods (
  code           text        primary key,
  label          text        not null,
  receiver_name  text,
  account_number text,
  instructions   text,
  qr_path        text,
  qr_updated_at  timestamptz,
  is_enabled     boolean     not null default false,
  sort_order     integer     not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint payment_methods_code_valid check (
    code in ('yape', 'plin', 'transferencia', 'efectivo', 'otro')),
  constraint payment_methods_completo check (
    not is_enabled or (
      nullif(btrim(coalesce(receiver_name, '')), '') is not null and
      nullif(btrim(coalesce(account_number, '')), '') is not null)),
  -- La ruta del QR la escribe el servidor con un patrón fijo. Que la BASE lo
  -- exija significa que ni un fallo en la API puede apuntarla a otro sitio.
  constraint payment_methods_qr_path_valid check (
    qr_path is null or
    qr_path ~ '^qr/[a-z]+/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$')
);

create index if not exists payment_methods_visible_idx
  on public.payment_methods (is_enabled, sort_order);

comment on table public.payment_methods is
  'Un método de pago manual por fila. Yape y Plin pueden compartir número hoy y separarse mañana sin migración.';
comment on column public.payment_methods.qr_path is
  'Ruta dentro del bucket privado payment-assets. Nunca la imagen: Postgres no guarda binarios aquí.';

-- Filas base. Deshabilitadas: la siembra comercial del paso 9 decide cuáles
-- se encienden y con qué datos.
insert into public.payment_methods (code, label, sort_order) values
  ('yape',          'Yape',          10),
  ('plin',          'Plin',          20),
  ('transferencia', 'Transferencia', 30)
on conflict (code) do nothing;

-- RLS: la docente lee sólo los métodos habilitados; nadie escribe desde el
-- navegador. Obligatorio revocar de anon Y authenticated antes de conceder:
-- los ALTER DEFAULT PRIVILEGES del proyecto ya les dieron ALL al crear la
-- tabla, y revocar de PUBLIC no quita esas concesiones explícitas.
alter table public.payment_methods enable row level security;
revoke all on public.payment_methods from public;
revoke all on public.payment_methods from anon, authenticated;
grant select on public.payment_methods to authenticated;

drop policy if exists "Metodos de pago habilitados" on public.payment_methods;
create policy "Metodos de pago habilitados"
  on public.payment_methods for select to authenticated using (is_enabled);


-- ============================================================================
-- 3. AJUSTES GLOBALES DE PAGO
--
--    `manual_payments_enabled` es el interruptor general. Apagarlo esconde el
--    flujo de pago entero sin borrar nada y sin tocar el catálogo: útil el día
--    que haya que parar los pagos manuales una tarde.
-- ============================================================================
alter table public.payment_settings
  add column if not exists manual_payments_enabled boolean not null default true;

-- La coherencia ya no puede exigir `method`: el método vive en payment_methods.
alter table public.payment_settings
  drop constraint if exists payment_settings_coherente;
alter table public.payment_settings
  add constraint payment_settings_coherente check (
    not is_configured or nullif(btrim(coalesce(instructions, '')), '') is not null);

-- Si 007 llegó a configurarse a mano, esos datos se conservan pasándolos al
-- método correspondiente. Hoy están vacíos, pero la migración no lo da por
-- hecho.
update public.payment_methods m
   set receiver_name  = coalesce(m.receiver_name,  s.receiver_name),
       account_number = coalesce(m.account_number, s.account_number),
       updated_at     = now()
  from public.payment_settings s
 where s.id = 1
   and s.method is not null
   and m.code = s.method
   and (m.receiver_name is null or m.account_number is null);

comment on column public.payment_settings.method is
  'JUBILADA en 008. El método vive en public.payment_methods. No la lee ningún código.';
comment on column public.payment_settings.receiver_name is
  'JUBILADA en 008. Ver public.payment_methods.receiver_name.';
comment on column public.payment_settings.account_number is
  'JUBILADA en 008. Ver public.payment_methods.account_number.';
comment on column public.payment_settings.manual_payments_enabled is
  'Interruptor general del pago manual. Falso esconde el flujo sin borrar la configuración.';


-- ============================================================================
-- 4. BUCKET DEL QR
--
--    PRIVADO. El límite de tamaño y la lista de MIME los impone el propio
--    Storage, además de la API: dos cerraduras distintas para la misma
--    puerta. La docente puede firmar una URL de lectura porque hay política
--    de SELECT; no hay ninguna política de INSERT, UPDATE ni DELETE, así que
--    escribir sólo puede hacerlo `service_role`, que salta RLS.
--
--    Va dentro de un bloque con captura de excepción a propósito: en algunos
--    proyectos el rol del editor SQL no puede tocar el esquema `storage`. Si
--    ocurre, la migración NO se pierde entera — el resto de la configuración
--    comercial se aplica igual y el inspector 011 avisa de que el bucket
--    quedó pendiente de crear desde el panel de Storage.
-- ============================================================================
do $$
begin
  begin
    insert into storage.buckets
      (id, name, public, file_size_limit, allowed_mime_types)
    values
      ('payment-assets', 'payment-assets', false, 2097152,
       array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do update
      set public           = false,
          file_size_limit  = 2097152,
          allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];
  exception when others then
    raise warning '[sciverse] No se pudo crear el bucket payment-assets (%). Créalo a mano: Storage → New bucket → payment-assets, privado, 2 MB, image/png image/jpeg image/webp.', sqlerrm;
  end;

  begin
    drop policy if exists "QR de pago visible para docentes" on storage.objects;
    create policy "QR de pago visible para docentes"
      on storage.objects for select to authenticated
      using (bucket_id = 'payment-assets');
  exception when others then
    raise warning '[sciverse] No se pudo crear la politica de lectura del QR (%). Créala desde Storage → payment-assets → Policies: SELECT para authenticated.', sqlerrm;
  end;
end;
$$;


-- ============================================================================
-- 4 bis. EL INTERRUPTOR GENERAL TIENE QUE VALER DE VERDAD
--
--    `manual_payments_enabled` no puede ser sólo un `if` en React: apagarlo
--    debe impedir que se creen solicitudes aunque alguien llame al endpoint a
--    mano. Se redefine `request_plan` de 007 con la MISMA firma —así conserva
--    sus permisos— añadiendo dos comprobaciones y nada más:
--
--      · los pagos manuales están abiertos
--      · si el método elegido está en el catálogo, está habilitado
--
--    Lo demás es idéntico a 007: el precio se sigue leyendo de `public.plans`
--    dentro de la función y el navegador sigue enviando sólo el código.
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
  v_uid    uuid := auth.uid();
  v_plan   public.plans%rowtype;
  v_req    public.payment_requests%rowtype;
  v_act    record;
  v_metodo text := coalesce(nullif(btrim(coalesce(p_method, '')), ''), 'yape');
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  if not exists (select 1 from public.docentes where user_id = v_uid) then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  -- NUEVO EN 008 · la venta puede estar cerrada.
  if not exists (select 1 from public.payment_settings
                  where id = 1 and manual_payments_enabled) then
    raise exception 'PAYMENTS_CLOSED';
  end if;

  -- NUEVO EN 008 · no se acepta un método que administración apagó.
  -- Sólo se comprueba si el método está en el catálogo: `efectivo` y `otro`
  -- no tienen fila y siguen valiendo como etiqueta.
  if exists (select 1 from public.payment_methods
              where code = v_metodo and not is_enabled) then
    raise exception 'METHOD_NOT_AVAILABLE';
  end if;

  select * into v_plan from public.plans where code = p_plan and is_active;
  if not found then raise exception 'PLAN_NOT_FOUND'; end if;

  -- El gratuito no se solicita: se tiene.
  if v_plan.price_cents = 0 then raise exception 'PLAN_NOT_PURCHASABLE'; end if;

  -- Si ya tiene ese mismo plan vigente, la compra no es un alta: sería una
  -- renovación, y esa decisión se toma aparte para no cobrar dos veces.
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
       v_plan.billing_period_months, v_metodo,
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
-- 5. CATÁLOGO PARA ADMINISTRACIÓN
--
--    Hace falta una RPC y no basta con leer `plans`: la política del catálogo
--    sólo deja ver los planes ACTIVOS, y administración necesita ver también
--    los apagados para poder encenderlos.
--
--    `support` puede leer. Editar es otra cosa (paso 6).
-- ============================================================================
create or replace function public.admin_list_plans(p_actor uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := sciverse_private.require_admin_role(p_actor, 'support');
begin
  return jsonb_build_object(
    'role', v_role,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code',        p.code,
               'name',        p.name,
               'description', p.description,
               'benefits',    to_jsonb(p.benefits),
               'price_cents', p.price_cents,
               'currency',    p.currency,
               'months',      p.billing_period_months,
               'ai_limit',    p.ai_weekly_limit,
               'is_active',   p.is_active,
               'sort_order',  p.sort_order,
               'updated_at',  p.updated_at,
               'suscritos',   (select count(*) from public.subscriptions s
                                where s.plan_code = p.code and s.status = 'active'))
             order by p.sort_order, p.code)
        from public.plans p), '[]'::jsonb));
end;
$$;


-- ============================================================================
-- 6. EDITAR UN PLAN
--
--    Recibe un parche JSON con lista blanca explícita de campos. Un parche y
--    no quince parámetros porque los campos comerciales van a crecer, y
--    porque así la firma —y por tanto los permisos— no cambia cada vez.
--
--    Lo que NO se puede tocar, a propósito:
--      · `code`      es la clave por la que apuntan suscripciones y solicitudes
--      · `features`  son interruptores técnicos, no configuración comercial
--
--    Y dos reglas sobre el plan gratuito: no se apaga y no se le pone precio.
--    Es el plan al que cae todo el mundo cuando algo falla; si desapareciera
--    del catálogo, la caída dejaría de ser segura.
-- ============================================================================
create or replace function public.admin_update_plan(
  p_actor  uuid,
  p_code   text,
  p_patch  jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role   text := sciverse_private.require_admin_role(p_actor, 'admin');
  v_plan   public.plans%rowtype;
  v_clave  text;
  v_antes  jsonb;
  v_desp   jsonb;
  v_ben    text[];
begin
  if p_code is null or p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'PATCH_INVALID';
  end if;

  for v_clave in select jsonb_object_keys(p_patch) loop
    if v_clave not in ('name', 'description', 'benefits', 'price_cents', 'currency',
                       'billing_period_months', 'ai_weekly_limit', 'is_active',
                       'sort_order') then
      raise exception 'UNKNOWN_FIELD';
    end if;
  end loop;

  select * into v_plan from public.plans where code = p_code for update;
  if not found then raise exception 'PLAN_NOT_FOUND'; end if;

  v_antes := jsonb_build_object(
    'name', v_plan.name, 'description', v_plan.description,
    'benefits', to_jsonb(v_plan.benefits), 'price_cents', v_plan.price_cents,
    'currency', v_plan.currency, 'billing_period_months', v_plan.billing_period_months,
    'ai_weekly_limit', v_plan.ai_weekly_limit, 'is_active', v_plan.is_active,
    'sort_order', v_plan.sort_order);

  -- ---- validación campo a campo -------------------------------------------
  if p_patch ? 'name' then
    v_plan.name := nullif(btrim(p_patch->>'name'), '');
    if v_plan.name is null or length(v_plan.name) > 60 then raise exception 'NAME_INVALID'; end if;
  end if;

  if p_patch ? 'description' then
    v_plan.description := nullif(btrim(coalesce(p_patch->>'description', '')), '');
    if length(coalesce(v_plan.description, '')) > 240 then raise exception 'DESCRIPTION_TOO_LONG'; end if;
  end if;

  if p_patch ? 'benefits' then
    if jsonb_typeof(p_patch->'benefits') <> 'array' then raise exception 'BENEFITS_INVALID'; end if;
    select coalesce(array_agg(left(btrim(x), 120)), '{}'::text[])
      into v_ben
      from jsonb_array_elements_text(p_patch->'benefits') as t(x)
     where btrim(x) <> '';
    if coalesce(array_length(v_ben, 1), 0) > 8 then raise exception 'BENEFITS_TOO_MANY'; end if;
    v_plan.benefits := v_ben;
  end if;

  if p_patch ? 'price_cents' then
    v_plan.price_cents := (p_patch->>'price_cents')::integer;
    if v_plan.price_cents < 0 or v_plan.price_cents > 1000000 then raise exception 'PRICE_OUT_OF_RANGE'; end if;
  end if;

  if p_patch ? 'currency' then
    v_plan.currency := upper(btrim(coalesce(p_patch->>'currency', '')));
    if v_plan.currency not in ('PEN', 'USD') then raise exception 'CURRENCY_INVALID'; end if;
  end if;

  if p_patch ? 'billing_period_months' then
    v_plan.billing_period_months := nullif(p_patch->>'billing_period_months', '')::integer;
    if v_plan.billing_period_months is not null
       and (v_plan.billing_period_months < 1 or v_plan.billing_period_months > 36) then
      raise exception 'DURATION_OUT_OF_RANGE';
    end if;
  end if;

  if p_patch ? 'ai_weekly_limit' then
    v_plan.ai_weekly_limit := (p_patch->>'ai_weekly_limit')::integer;
    if v_plan.ai_weekly_limit < 0 or v_plan.ai_weekly_limit > 10000 then raise exception 'LIMIT_OUT_OF_RANGE'; end if;
  end if;

  if p_patch ? 'is_active' then
    v_plan.is_active := (p_patch->>'is_active')::boolean;
  end if;

  if p_patch ? 'sort_order' then
    v_plan.sort_order := (p_patch->>'sort_order')::integer;
    if v_plan.sort_order < 0 or v_plan.sort_order > 999 then raise exception 'SORT_OUT_OF_RANGE'; end if;
  end if;

  -- ---- el plan gratuito es la red de seguridad -----------------------------
  if p_code = 'free' then
    if not v_plan.is_active then raise exception 'FREE_PLAN_REQUIRED'; end if;
    if v_plan.price_cents <> 0 then raise exception 'FREE_PLAN_MUST_BE_FREE'; end if;
  end if;

  -- Un plan de pago sin duración vendería una vigencia indefinida por error.
  if v_plan.price_cents > 0 and v_plan.billing_period_months is null then
    raise exception 'PAID_PLAN_NEEDS_DURATION';
  end if;

  -- APAGAR UN PLAN CON GENTE DENTRO DEGRADA A ESA GENTE.
  -- `effective_plan` trata un plan inactivo como si no existiera y cae al
  -- gratuito. Desactivar Pro con suscripciones vivas dejaría sin lo que
  -- pagaron a todas ellas, en silencio y de golpe. Se bloquea.
  if v_antes->>'is_active' = 'true' and not v_plan.is_active
     and exists (select 1 from public.subscriptions
                  where plan_code = p_code and status = 'active') then
    raise exception 'PLAN_HAS_ACTIVE_SUBSCRIBERS';
  end if;

  v_desp := jsonb_build_object(
    'name', v_plan.name, 'description', v_plan.description,
    'benefits', to_jsonb(v_plan.benefits), 'price_cents', v_plan.price_cents,
    'currency', v_plan.currency, 'billing_period_months', v_plan.billing_period_months,
    'ai_weekly_limit', v_plan.ai_weekly_limit, 'is_active', v_plan.is_active,
    'sort_order', v_plan.sort_order);

  -- Doble clic: nada que escribir, nada que auditar.
  if v_antes = v_desp then
    return jsonb_build_object('ok', true, 'sin_cambios', true, 'code', p_code);
  end if;

  update public.plans
     set name = v_plan.name, description = v_plan.description,
         benefits = v_plan.benefits, price_cents = v_plan.price_cents,
         currency = v_plan.currency,
         billing_period_months = v_plan.billing_period_months,
         ai_weekly_limit = v_plan.ai_weekly_limit,
         is_active = v_plan.is_active, sort_order = v_plan.sort_order,
         updated_at = now()
   where code = p_code;

  insert into sciverse_private.admin_audit_log
    (admin_user_id, admin_role, action, entity_type, before_data, after_data, metadata)
  values
    (p_actor, v_role, 'PLAN_UPDATED', 'plan', v_antes, v_desp,
     jsonb_build_object('plan', p_code,
                        'motivo', nullif(btrim(coalesce(p_reason, '')), '')));

  return jsonb_build_object('ok', true, 'sin_cambios', false, 'code', p_code);
end;
$$;


-- ============================================================================
-- 7. CONFIGURACIÓN DE PAGOS · LECTURA Y ESCRITURA
-- ============================================================================

-- ---- 7.1 leer (support incluido) -------------------------------------------
create or replace function public.admin_payment_config(p_actor uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := sciverse_private.require_admin_role(p_actor, 'support');
  v_cfg  public.payment_settings%rowtype;
begin
  select * into v_cfg from public.payment_settings where id = 1;

  return jsonb_build_object(
    'role', v_role,
    'settings', jsonb_build_object(
      'is_configured',           coalesce(v_cfg.is_configured, false),
      'manual_payments_enabled', coalesce(v_cfg.manual_payments_enabled, false),
      'instructions',            v_cfg.instructions,
      'whatsapp',                v_cfg.whatsapp,
      'updated_at',              v_cfg.updated_at),
    'methods', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code',           m.code,
               'label',          m.label,
               'receiver_name',  m.receiver_name,
               'account_number', m.account_number,
               'instructions',   m.instructions,
               'qr_path',        m.qr_path,
               'qr_updated_at',  m.qr_updated_at,
               'is_enabled',     m.is_enabled,
               'sort_order',     m.sort_order,
               'updated_at',     m.updated_at)
             order by m.sort_order, m.code)
        from public.payment_methods m), '[]'::jsonb));
end;
$$;


-- ---- 7.2 ajustes globales ---------------------------------------------------
create or replace function public.admin_update_payment_settings(
  p_actor  uuid,
  p_patch  jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role  text := sciverse_private.require_admin_role(p_actor, 'admin');
  v_cfg   public.payment_settings%rowtype;
  v_clave text;
  v_antes jsonb;
  v_desp  jsonb;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'PATCH_INVALID';
  end if;

  for v_clave in select jsonb_object_keys(p_patch) loop
    if v_clave not in ('instructions', 'whatsapp',
                       'manual_payments_enabled', 'is_configured') then
      raise exception 'UNKNOWN_FIELD';
    end if;
  end loop;

  select * into v_cfg from public.payment_settings where id = 1 for update;
  if not found then raise exception 'SETTINGS_NOT_FOUND'; end if;

  v_antes := jsonb_build_object(
    'instructions', v_cfg.instructions, 'whatsapp', v_cfg.whatsapp,
    'manual_payments_enabled', v_cfg.manual_payments_enabled,
    'is_configured', v_cfg.is_configured);

  if p_patch ? 'instructions' then
    v_cfg.instructions := nullif(btrim(coalesce(p_patch->>'instructions', '')), '');
    if length(coalesce(v_cfg.instructions, '')) > 600 then raise exception 'INSTRUCTIONS_TOO_LONG'; end if;
  end if;

  -- Vacío significa «todavía no hay uno oficial», y es un estado válido: la
  -- aplicación simplemente no menciona WhatsApp. Nunca se inventa un número.
  if p_patch ? 'whatsapp' then
    v_cfg.whatsapp := nullif(btrim(coalesce(p_patch->>'whatsapp', '')), '');
    if v_cfg.whatsapp is not null and v_cfg.whatsapp !~ '^[0-9 +()-]{6,24}$' then
      raise exception 'WHATSAPP_INVALID';
    end if;
  end if;

  if p_patch ? 'manual_payments_enabled' then
    v_cfg.manual_payments_enabled := (p_patch->>'manual_payments_enabled')::boolean;
  end if;

  if p_patch ? 'is_configured' then
    v_cfg.is_configured := (p_patch->>'is_configured')::boolean;
  end if;

  if v_cfg.is_configured
     and nullif(btrim(coalesce(v_cfg.instructions, '')), '') is null then
    raise exception 'INSTRUCTIONS_REQUIRED';
  end if;

  v_desp := jsonb_build_object(
    'instructions', v_cfg.instructions, 'whatsapp', v_cfg.whatsapp,
    'manual_payments_enabled', v_cfg.manual_payments_enabled,
    'is_configured', v_cfg.is_configured);

  if v_antes = v_desp then
    return jsonb_build_object('ok', true, 'sin_cambios', true);
  end if;

  update public.payment_settings
     set instructions            = v_cfg.instructions,
         whatsapp                = v_cfg.whatsapp,
         manual_payments_enabled = v_cfg.manual_payments_enabled,
         is_configured           = v_cfg.is_configured,
         updated_at              = now()
   where id = 1;

  insert into sciverse_private.admin_audit_log
    (admin_user_id, admin_role, action, entity_type, before_data, after_data, metadata)
  values
    (p_actor, v_role, 'PAYMENT_SETTINGS_UPDATED', 'payment_settings',
     v_antes, v_desp,
     jsonb_build_object('motivo', nullif(btrim(coalesce(p_reason, '')), '')));

  return jsonb_build_object('ok', true, 'sin_cambios', false);
end;
$$;


-- ---- 7.3 un método concreto -------------------------------------------------
create or replace function public.admin_update_payment_method(
  p_actor  uuid,
  p_code   text,
  p_patch  jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role  text := sciverse_private.require_admin_role(p_actor, 'admin');
  v_m     public.payment_methods%rowtype;
  v_clave text;
  v_antes jsonb;
  v_desp  jsonb;
begin
  if p_code is null or p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'PATCH_INVALID';
  end if;

  for v_clave in select jsonb_object_keys(p_patch) loop
    if v_clave not in ('label', 'receiver_name', 'account_number',
                       'instructions', 'is_enabled', 'sort_order') then
      raise exception 'UNKNOWN_FIELD';
    end if;
  end loop;

  select * into v_m from public.payment_methods where code = p_code for update;
  if not found then raise exception 'METHOD_NOT_FOUND'; end if;

  v_antes := jsonb_build_object(
    'label', v_m.label, 'receiver_name', v_m.receiver_name,
    'account_number', v_m.account_number, 'instructions', v_m.instructions,
    'is_enabled', v_m.is_enabled, 'sort_order', v_m.sort_order);

  if p_patch ? 'label' then
    v_m.label := nullif(btrim(p_patch->>'label'), '');
    if v_m.label is null or length(v_m.label) > 40 then raise exception 'LABEL_INVALID'; end if;
  end if;

  if p_patch ? 'receiver_name' then
    v_m.receiver_name := nullif(btrim(coalesce(p_patch->>'receiver_name', '')), '');
    if length(coalesce(v_m.receiver_name, '')) > 80 then raise exception 'RECEIVER_TOO_LONG'; end if;
  end if;

  if p_patch ? 'account_number' then
    v_m.account_number := nullif(btrim(coalesce(p_patch->>'account_number', '')), '');
    if v_m.account_number is not null and v_m.account_number !~ '^[0-9 +()-]{6,40}$' then
      raise exception 'ACCOUNT_INVALID';
    end if;
  end if;

  if p_patch ? 'instructions' then
    v_m.instructions := nullif(btrim(coalesce(p_patch->>'instructions', '')), '');
    if length(coalesce(v_m.instructions, '')) > 400 then raise exception 'INSTRUCTIONS_TOO_LONG'; end if;
  end if;

  if p_patch ? 'is_enabled' then
    v_m.is_enabled := (p_patch->>'is_enabled')::boolean;
  end if;

  if p_patch ? 'sort_order' then
    v_m.sort_order := (p_patch->>'sort_order')::integer;
    if v_m.sort_order < 0 or v_m.sort_order > 999 then raise exception 'SORT_OUT_OF_RANGE'; end if;
  end if;

  -- La restricción de la tabla lo impediría igual; se comprueba aquí para
  -- devolver un error que se pueda traducir a algo legible.
  if v_m.is_enabled and (v_m.receiver_name is null or v_m.account_number is null) then
    raise exception 'METHOD_INCOMPLETE';
  end if;

  v_desp := jsonb_build_object(
    'label', v_m.label, 'receiver_name', v_m.receiver_name,
    'account_number', v_m.account_number, 'instructions', v_m.instructions,
    'is_enabled', v_m.is_enabled, 'sort_order', v_m.sort_order);

  if v_antes = v_desp then
    return jsonb_build_object('ok', true, 'sin_cambios', true, 'code', p_code);
  end if;

  update public.payment_methods
     set label = v_m.label, receiver_name = v_m.receiver_name,
         account_number = v_m.account_number, instructions = v_m.instructions,
         is_enabled = v_m.is_enabled, sort_order = v_m.sort_order,
         updated_at = now()
   where code = p_code;

  insert into sciverse_private.admin_audit_log
    (admin_user_id, admin_role, action, entity_type, before_data, after_data, metadata)
  values
    (p_actor, v_role, 'PAYMENT_METHOD_UPDATED', 'payment_method', v_antes, v_desp,
     jsonb_build_object('metodo', p_code,
                        'motivo', nullif(btrim(coalesce(p_reason, '')), '')));

  return jsonb_build_object('ok', true, 'sin_cambios', false, 'code', p_code);
end;
$$;


-- ---- 7.4 apuntar el QR ------------------------------------------------------
--
--    Devuelve la ruta ANTERIOR para que la API pueda borrar el fichero viejo
--    DESPUÉS de que este cambio esté confirmado. En ese orden: si se borrase
--    antes y la transacción fallara, el método se quedaría apuntando a un
--    fichero que ya no existe.
create or replace function public.admin_set_payment_qr(
  p_actor uuid,
  p_code  text,
  p_path  text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role   text := sciverse_private.require_admin_role(p_actor, 'admin');
  v_m      public.payment_methods%rowtype;
  v_previa text;
  v_nueva  text := nullif(btrim(coalesce(p_path, '')), '');
begin
  if p_code is null then raise exception 'METHOD_NOT_FOUND'; end if;

  select * into v_m from public.payment_methods where code = p_code for update;
  if not found then raise exception 'METHOD_NOT_FOUND'; end if;

  -- La restricción de la tabla vuelve a comprobarlo; esto sólo da un error
  -- con nombre en vez de un fallo de check.
  if v_nueva is not null and v_nueva !~
     ('^qr/' || p_code || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$') then
    raise exception 'QR_PATH_INVALID';
  end if;

  v_previa := v_m.qr_path;
  if v_previa is not distinct from v_nueva then
    return jsonb_build_object('ok', true, 'sin_cambios', true,
                              'qr_path', v_nueva, 'anterior', null);
  end if;

  update public.payment_methods
     set qr_path = v_nueva, qr_updated_at = case when v_nueva is null then null else now() end,
         updated_at = now()
   where code = p_code;

  insert into sciverse_private.admin_audit_log
    (admin_user_id, admin_role, action, entity_type, before_data, after_data, metadata)
  values
    (p_actor, v_role, 'PAYMENT_QR_UPDATED', 'payment_method',
     jsonb_build_object('qr_path', v_previa),
     jsonb_build_object('qr_path', v_nueva),
     jsonb_build_object('metodo', p_code));

  return jsonb_build_object('ok', true, 'sin_cambios', false,
                            'qr_path', v_nueva, 'anterior', v_previa);
end;
$$;


-- ============================================================================
-- 8. APROBAR UN PAGO — AHORA CON DOS EVENTOS
--
--    Mismo cuerpo transaccional que en 007 (bloqueo de la solicitud, cierre
--    de la suscripción anterior, alta de la nueva). Lo único que cambia es
--    que la auditoría registra los dos hechos por separado.
--
--    `create or replace` con la MISMA firma: los permisos concedidos en 007
--    se conservan y no hay ventana sin función.
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

  -- EVENTO 1 · el dinero se dio por bueno.
  insert into sciverse_private.admin_audit_log
    (admin_user_id, admin_role, action, target_user_id, entity_type, entity_id,
     before_data, after_data, metadata)
  values
    (p_actor, v_role, 'PAYMENT_APPROVED', v_req.user_id, 'payment_request', v_req.id,
     jsonb_build_object('estado', 'pending'),
     jsonb_build_object('estado', 'approved'),
     jsonb_build_object('monto_centimos', v_req.amount_cents,
                        'moneda', v_req.currency,
                        'metodo', v_req.method,
                        'referencia', v_req.reference,
                        'notas', nullif(btrim(coalesce(p_notes, '')), '')));

  -- EVENTO 2 · el acceso comercial quedó activo. Hoy ocurre en la misma
  -- transacción; el día que haya pasarela, el evento 1 llegará por webhook y
  -- éste seguirá siendo nuestro. Por eso van separados desde ahora.
  insert into sciverse_private.admin_audit_log
    (admin_user_id, admin_role, action, target_user_id, entity_type, entity_id,
     before_data, after_data, metadata)
  values
    (p_actor, v_role, 'SUBSCRIPTION_ACTIVATED', v_req.user_id, 'subscription', v_nueva.id,
     jsonb_build_object('plan', v_actual.plan_code,
                        'suscripcion', v_actual.id),
     jsonb_build_object('plan', v_nueva.plan_code,
                        'desde', v_nueva.starts_at,
                        'hasta', v_nueva.ends_at,
                        'limite_ia', v_plan.ai_weekly_limit,
                        'suscripcion', v_nueva.id),
     jsonb_build_object('origen', 'manual_payment',
                        'solicitud', v_req.id));

  return jsonb_build_object(
    'ok', true, 'plan', v_nueva.plan_code,
    'desde', v_nueva.starts_at, 'hasta', v_nueva.ends_at,
    'limite_ia', v_plan.ai_weekly_limit);

exception
  when unique_violation then
    raise exception 'CONCURRENT_CHANGE';
end;
$$;


-- ============================================================================
-- 9. CONFIGURACIÓN COMERCIAL DECIDIDA POR EL EQUIPO
--
--    Plan Pro   ·  S/ 20.00  ·  1 mes  ·  100 generaciones por semana
--    Yape y Plin habilitados  ·  Keytlin  ·  931582435
--    WhatsApp   ·  vacío a propósito: todavía no hay número oficial y no se
--                  inventa ninguno. Se rellena desde el panel cuando lo haya.
--
--    LA CONDICIÓN `where ... price_cents = 0 and not is_active` NO ES ADORNO.
--    Sólo siembra si el plan sigue siendo el marcador que dejó 007. Si un
--    administrador ya cambió el precio desde el panel, volver a ejecutar esta
--    migración no lo pisa. Ése es justamente el objetivo del bloque: que los
--    precios vivan en el panel, no en los ficheros SQL.
--
--    100/semana es un TECHO ANTIABUSO inicial, no una promesa de «ilimitado».
--    Cambiarlo no requiere migración ni despliegue: Administración → Planes.
-- ============================================================================
update public.plans
   set name                  = 'Pro',
       description           = 'Plan mensual con 100 creaciones con IA por semana.',
       benefits              = array[
         '100 creaciones con IA por semana',
         'Sesiones de aprendizaje, fichas, instrumentos y proyectos STEAM',
         'Exportación a Word de todo lo que crees',
         'Vigencia de 1 mes desde la activación'],
       ai_weekly_limit       = 100,
       price_cents           = 2000,
       currency              = 'PEN',
       billing_period_months = 1,
       sort_order            = 10,
       is_active             = true,
       updated_at            = now()
 where code = 'pro'
   and price_cents = 0
   and not is_active;

-- Viñetas del gratuito, sólo si nadie las ha escrito ya.
update public.plans
   set benefits = array[
         '5 creaciones con IA por semana',
         'Acceso a todas las herramientas',
         'Exportación a Word'],
       updated_at = now()
 where code = 'free'
   and coalesce(array_length(benefits, 1), 0) = 0;

-- Métodos: sólo si el método sigue sin configurar.
update public.payment_methods
   set receiver_name  = 'Keytlin',
       account_number = '931582435',
       is_enabled     = true,
       updated_at     = now()
 where code in ('yape', 'plin')
   and receiver_name is null
   and account_number is null;

-- Ajustes globales: sólo mientras sigan sin configurar.
update public.payment_settings
   set instructions = 'Realiza el pago y registra tu solicitud. La activación del plan se realiza previa verificación del equipo de SciVerse.',
       manual_payments_enabled = true,
       is_configured           = true,
       updated_at              = now()
 where id = 1
   and not is_configured;


-- ============================================================================
-- 10. PERMISOS
--
--     Revocar de PUBLIC, anon Y authenticated antes de conceder: los
--     privilegios por defecto del proyecto ya los concedieron al crear cada
--     función. Las seis nuevas son de administración: sólo `service_role`,
--     que es la única identidad que vive en el servidor.
-- ============================================================================
revoke all on function public.admin_list_plans(uuid)                          from public, anon, authenticated;
revoke all on function public.admin_update_plan(uuid, text, jsonb, text)      from public, anon, authenticated;
revoke all on function public.admin_payment_config(uuid)                      from public, anon, authenticated;
revoke all on function public.admin_update_payment_settings(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.admin_update_payment_method(uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.admin_set_payment_qr(uuid, text, text)          from public, anon, authenticated;

grant execute on function public.admin_list_plans(uuid)                           to service_role;
grant execute on function public.admin_update_plan(uuid, text, jsonb, text)       to service_role;
grant execute on function public.admin_payment_config(uuid)                       to service_role;
grant execute on function public.admin_update_payment_settings(uuid, jsonb, text) to service_role;
grant execute on function public.admin_update_payment_method(uuid, text, jsonb, text) to service_role;
grant execute on function public.admin_set_payment_qr(uuid, text, text)           to service_role;

-- Las dos funciones REEMPLAZADAS conservan su firma y, con ella, los permisos
-- que les dio 007. Se reafirman igualmente: cuesta nada y deja el estado final
-- escrito en un solo sitio.
revoke all on function public.admin_approve_payment(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_approve_payment(uuid, uuid, text) to service_role;

revoke all on function public.request_plan(text, text, text) from public, anon, authenticated;
grant execute on function public.request_plan(text, text, text) to authenticated, service_role;


commit;


-- ============================================================================
-- QUÉ HACE FALTA EN STORAGE  ·  comprobar en el panel
-- ============================================================================
--
-- El paso 4 intenta dejarlo hecho. Si el editor SQL no tuvo permisos sobre el
-- esquema `storage`, habrá salido un WARNING y hay que hacerlo a mano:
--
--   1) Storage → New bucket
--        Name:              payment-assets
--        Public bucket:     NO   (privado)
--        File size limit:   2 MB
--        Allowed MIME:      image/png, image/jpeg, image/webp
--
--   2) Storage → payment-assets → Policies → New policy
--        Operation:  SELECT
--        Target roles: authenticated
--        USING:      bucket_id = 'payment-assets'
--
--   3) NINGUNA política de INSERT, UPDATE ni DELETE. Así sólo escribe
--      `service_role`, que salta RLS y sólo existe en el servidor. Una
--      política de escritura para `authenticated` convertiría el bucket en
--      un almacén público para cualquier docente.
--
-- El inspector 011 dice si el bucket y la política quedaron bien.
--
--
-- ============================================================================
-- LIMPIEZA PENDIENTE  ·  opcional, cuando haya confianza
-- ============================================================================
-- Las tres columnas jubiladas del paso 3 no las lee nadie. Cuando se quiera
-- retirar la deuda:
--
--   begin;
--   alter table public.payment_settings drop column method;
--   alter table public.payment_settings drop column receiver_name;
--   alter table public.payment_settings drop column account_number;
--   commit;
--
-- No se hace aquí porque borrar columnas de una tabla que ya está en
-- producción no aporta nada hoy y no se puede deshacer.
--
--
-- ============================================================================
-- PLAN DE ROLLBACK
-- ============================================================================
--
--   begin;
--   drop function if exists public.admin_set_payment_qr(uuid, text, text);
--   drop function if exists public.admin_update_payment_method(uuid, text, jsonb, text);
--   drop function if exists public.admin_update_payment_settings(uuid, jsonb, text);
--   drop function if exists public.admin_payment_config(uuid);
--   drop function if exists public.admin_update_plan(uuid, text, jsonb, text);
--   drop function if exists public.admin_list_plans(uuid);
--   drop table    if exists public.payment_methods;
--   alter table public.plans drop column if exists benefits;
--   alter table public.payment_settings drop column if exists manual_payments_enabled;
--   -- y volver a aplicar el paso 7 de 007_payments.sql para que
--   -- admin_approve_payment deje de emitir SUBSCRIPTION_ACTIVATED.
--   commit;
--
-- NO revierte el precio del plan Pro ni las suscripciones ya activadas: son
-- decisiones comerciales tomadas y planes que alguien pagó. Si además se
-- quiere apagar la venta, basta con `is_active = false` en el plan `pro`.
-- ============================================================================
