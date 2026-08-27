-- ============================================================
-- SciVerse Freemium — 5 generaciones IA por semana
-- Ejecutar UNA VEZ en Supabase > SQL Editor > New query > Run
-- ============================================================

alter table public.docentes
  add column if not exists ai_weekly_limit integer not null default 5,
  add column if not exists ai_week_used integer not null default 0,
  add column if not exists ai_week_start date;

-- Asegura valores correctos para usuarios ya existentes.
update public.docentes
set
  ai_weekly_limit = coalesce(ai_weekly_limit, 5),
  ai_week_used = coalesce(ai_week_used, 0),
  ai_week_start = coalesce(
    ai_week_start,
    date_trunc('week', timezone('America/Lima', now()))::date
  );

alter table public.docentes
  alter column ai_week_start
  set default date_trunc('week', timezone('America/Lima', now()))::date;

alter table public.docentes
  drop constraint if exists docentes_ai_weekly_limit_check;

alter table public.docentes
  add constraint docentes_ai_weekly_limit_check
  check (ai_weekly_limit >= 0);

alter table public.docentes
  drop constraint if exists docentes_ai_week_used_check;

alter table public.docentes
  add constraint docentes_ai_week_used_check
  check (ai_week_used >= 0);

-- ------------------------------------------------------------
-- Estado actual de créditos
-- ------------------------------------------------------------
create or replace function public.get_ai_credit_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_doc public.docentes%rowtype;
  v_week_start date := date_trunc('week', timezone('America/Lima', now()))::date;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
  into v_doc
  from public.docentes
  where user_id = v_uid;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_doc.ai_week_start is distinct from v_week_start then
    update public.docentes
    set ai_week_start = v_week_start,
        ai_week_used = 0
    where user_id = v_uid
    returning * into v_doc;
  end if;

  return jsonb_build_object(
    'plan', v_doc.plan,
    'limit', v_doc.ai_weekly_limit,
    'used', v_doc.ai_week_used,
    'remaining', greatest(v_doc.ai_weekly_limit - v_doc.ai_week_used, 0),
    'week_start', v_doc.ai_week_start,
    'next_reset', v_week_start + 7,
    'active', v_doc.activo
  );
end;
$$;

-- ------------------------------------------------------------
-- Consume 1 crédito de forma atómica.
-- IMPORTANTE: usa FOR UPDATE para evitar doble consumo concurrente.
-- ------------------------------------------------------------
create or replace function public.consume_ai_credit()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_doc public.docentes%rowtype;
  v_week_start date := date_trunc('week', timezone('America/Lima', now()))::date;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
  into v_doc
  from public.docentes
  where user_id = v_uid
  for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if not v_doc.activo then
    raise exception 'ACCOUNT_INACTIVE';
  end if;

  if v_doc.ai_week_start is distinct from v_week_start then
    update public.docentes
    set ai_week_start = v_week_start,
        ai_week_used = 0
    where user_id = v_uid
    returning * into v_doc;
  end if;

  if v_doc.ai_week_used >= v_doc.ai_weekly_limit then
    return jsonb_build_object(
      'ok', false,
      'reason', 'WEEKLY_LIMIT_REACHED',
      'plan', v_doc.plan,
      'limit', v_doc.ai_weekly_limit,
      'used', v_doc.ai_week_used,
      'remaining', 0,
      'week_start', v_doc.ai_week_start,
      'next_reset', v_week_start + 7
    );
  end if;

  update public.docentes
  set ai_week_used = ai_week_used + 1
  where user_id = v_uid
  returning * into v_doc;

  return jsonb_build_object(
    'ok', true,
    'plan', v_doc.plan,
    'limit', v_doc.ai_weekly_limit,
    'used', v_doc.ai_week_used,
    'remaining', greatest(v_doc.ai_weekly_limit - v_doc.ai_week_used, 0),
    'week_start', v_doc.ai_week_start,
    'next_reset', v_week_start + 7
  );
end;
$$;

-- ------------------------------------------------------------
-- Devuelve 1 crédito si Gemini o el backend falla.
-- ------------------------------------------------------------
create or replace function public.refund_ai_credit()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_doc public.docentes%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.docentes
  set ai_week_used = greatest(ai_week_used - 1, 0)
  where user_id = v_uid
  returning * into v_doc;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'ok', true,
    'limit', v_doc.ai_weekly_limit,
    'used', v_doc.ai_week_used,
    'remaining', greatest(v_doc.ai_weekly_limit - v_doc.ai_week_used, 0)
  );
end;
$$;

-- Solo usuarios autenticados pueden ejecutar estas funciones.
revoke all on function public.get_ai_credit_status() from public;
revoke all on function public.consume_ai_credit() from public;
revoke all on function public.refund_ai_credit() from public;

grant execute on function public.get_ai_credit_status() to authenticated;
grant execute on function public.consume_ai_credit() to authenticated;
grant execute on function public.refund_ai_credit() to authenticated;
