# SayLess

Plataforma de invitaciones digitales con confirmación de asistencia (RSVP). Cada cliente crea y edita sus eventos
por su cuenta, paga al publicar y administra a sus invitados.

Next.js 16 · Supabase (Postgres, Auth, Storage) · Stripe · Tailwind 4.

## Puesta en marcha

```bash
npm install
cp .env.local.example .env.local   # o crea .env.local con las variables de abajo
npm run dev
```

### Variables de entorno

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente de Supabase (sesión del usuario, sujeta a RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor: parte pública, webhooks y acciones de operador |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | Cobro al publicar |
| `NEXT_PUBLIC_SITE_URL` | URL pública (producción), para enlaces de retorno |

### Base de datos

Ejecuta en el SQL Editor de Supabase, **en orden**: `supabase/schema.sql` y luego `001` a `010`.
`010` requiere activar la extensión `pg_cron`.

### Inicio de sesión sin correo (solo desarrollo)

```bash
node --env-file=.env.local scripts/dev-login-link.mjs tu@correo.com
```

### Hacerte superadmin

```sql
update public.profiles set is_superadmin = true where email = 'tu@correo.com';
```

## Estructura

- `/[slug]` y `/[slug]/[codigo]`: invitación pública y enlace personal de cada invitado.
- `/app`: panel del cliente (eventos, editor, invitados, colaboradores).
- `/admin`: panel del operador (clientes, estados, pagos, retención).
- `src/proxy.ts`: refresca la sesión y protege `/app` y `/admin`.
