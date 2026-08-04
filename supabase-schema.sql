-- Ejecuta esto en Supabase: Dashboard → SQL Editor → New query → pega y "Run"

create table if not exists docentes (
  id uuid primary key default gen_random_uuid(),
  nombres text not null,
  apellidos text not null,
  ie text not null,
  celular text,
  correo text not null,
  created_at timestamptz default now()
);

-- Activa Row Level Security (obligatorio en Supabase para tablas públicas)
alter table docentes enable row level security;

-- Permite que cualquiera pueda REGISTRARSE (insertar su propio registro)
-- desde el formulario público del sitio.
create policy "Cualquiera puede registrarse"
  on docentes for insert
  to anon
  with check (true);

-- OJO: a propósito NO se crea una policy de "select" para el rol anon.
-- Eso significa que nadie puede leer la tabla directamente desde el
-- navegador con la clave pública — solo se puede insertar. Para ver la
-- lista de docentes registrados, el panel de administración (api/list-docentes.js)
-- usa la clave "service role" (secreta, solo en el servidor) que sí puede
-- leer todo, sin exponer los datos al público.
