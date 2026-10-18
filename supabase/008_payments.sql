-- Migración 008: registro de pagos (Stripe).
-- Pegar en Supabase > SQL Editor > Run. Idempotente.
-- Solo el servidor (service_role) lee y escribe esta tabla: los clientes no tienen acceso.

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  metadata_event_id text,                       -- id que venía en Stripe, por si el evento ya no existe
  stripe_session_id text not null unique,       -- evita registrar dos veces el mismo pago
  stripe_payment_intent text,
  amount_total integer not null,                -- en centavos
  currency text not null,
  customer_email text,
  created_at timestamptz not null default now()
);

create index if not exists payments_event_idx on public.payments(event_id);

alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
