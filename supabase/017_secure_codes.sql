-- Migración 017: códigos de invitación más difíciles de adivinar + límite de intentos fallidos.
-- Pegar en Supabase > SQL Editor > Run. Idempotente. Requiere 001–016.
--
--  * Los códigos NUEVOS pasan de 8 caracteres hexadecimales (32 bits) a 10 caracteres de un alfabeto sin confusiones
--    (sin 0/O, 1/I/L): unos 49 bits. Se generan con aleatoriedad criptográfica.
--  * Los códigos que ya existen NO se cambian (los enlaces que ya enviaste siguen funcionando).
--  * rate_limits: cuenta intentos fallidos por dirección para frenar a quien pruebe códigos en masa. Solo la usa el servidor.

begin;

-- ───────────── Código aleatorio de 10 caracteres ─────────────
-- Alfabeto de 31 símbolos. Se usan 10 bytes de un uuid v4, saltando los bytes 6 y 8 (que traen bits fijos de versión).
create or replace function public.gen_guest_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  picks constant int[] := array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11];
  code text := '';
  i int;
begin
  foreach i in array picks loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
  end loop;
  return code;
end;
$$;

alter table public.guests alter column code set default public.gen_guest_code();

-- ───────────── Límite de intentos ─────────────
create table if not exists public.rate_limits (
  key text primary key,
  hits int not null default 0,
  window_start timestamptz not null default now()
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Suma un intento a la clave; si la ventana ya venció, empieza de nuevo. Devuelve los intentos de la ventana.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v int;
begin
  insert into public.rate_limits as r (key, hits, window_start) values (p_key, 1, now())
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v;

  if random() < 0.01 then -- limpieza ocasional de filas viejas
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v;
end;
$$;

-- Cuántos intentos lleva la clave dentro de la ventana (sin sumar uno).
create or replace function public.rate_limit_count(p_key text, p_window_seconds int)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select r.hits from public.rate_limits r
     where r.key = p_key and r.window_start >= now() - make_interval(secs => p_window_seconds)),
    0);
$$;

-- Solo el servidor (service_role) puede usarlas.
revoke all on function public.rate_limit_hit(text, int) from public, anon, authenticated;
revoke all on function public.rate_limit_count(text, int) from public, anon, authenticated;

commit;
