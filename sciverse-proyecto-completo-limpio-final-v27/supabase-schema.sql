-- SciVerse / Teaching TIC: registro de docentes con confirmación por correo.
-- Ejecuta TODO este archivo en Supabase: SQL Editor → New query → Run.

create table if not exists public.docentes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  nombres text not null,
  apellidos text not null,
  ie text not null,
  celular text,
  nivel text not null default 'primaria' check (nivel in ('primaria', 'secundaria')),
  correo text not null unique,
  plan text not null default 'gratuito',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Permite actualizar instalaciones anteriores de la tabla sin eliminar registros.
alter table public.docentes add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.docentes add column if not exists plan text not null default 'gratuito';
alter table public.docentes add column if not exists activo boolean not null default true;
alter table public.docentes add column if not exists nivel text not null default 'primaria';
create unique index if not exists docentes_user_id_key on public.docentes(user_id) where user_id is not null;
create unique index if not exists docentes_correo_key on public.docentes(lower(correo));
create unique index if not exists docentes_correo_exact_key on public.docentes(correo);

alter table public.docentes enable row level security;

drop policy if exists "Cualquiera puede registrarse" on public.docentes;
drop policy if exists "Docente lee su perfil" on public.docentes;
drop policy if exists "Docente actualiza su perfil" on public.docentes;

create policy "Docente lee su perfil"
  on public.docentes for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Docente actualiza su perfil"
  on public.docentes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Crea automáticamente el perfil cuando alguien se registra en Supabase Auth.
create or replace function public.crear_perfil_docente()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.docentes (user_id, nombres, apellidos, ie, celular, nivel, correo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombres', 'Docente'),
    coalesce(new.raw_user_meta_data ->> 'apellidos', ''),
    coalesce(new.raw_user_meta_data ->> 'ie', 'Sin especificar'),
    new.raw_user_meta_data ->> 'celular',
    coalesce(new.raw_user_meta_data ->> 'nivel', 'primaria'),
    new.email
  )
  on conflict (correo) do update set
    user_id = excluded.user_id,
    nombres = excluded.nombres,
    apellidos = excluded.apellidos,
    ie = excluded.ie,
    celular = excluded.celular,
    nivel = excluded.nivel;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute procedure public.crear_perfil_docente();
