-- Pegar en Supabase > SQL Editor > Run

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  name text not null,
  passes int not null check (passes > 0),          -- pases asignados
  phone text,
  language text not null default 'es',
  attending boolean,                               -- null = aún no responde
  confirmed_count int check (confirmed_count between 0 and passes),
  message text,
  confirmed_at timestamptz
);

-- RLS activado sin políticas: solo el servidor (service_role) accede.
alter table public.guests enable row level security;

-- Ejemplo (borrar o reemplazar):
-- insert into public.guests (name, passes, phone) values ('Familia Pérez', 4, '+521234567890');
