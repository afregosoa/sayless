import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-server";
import type Stripe from "stripe";

// Stripe avisa aquí cuando un pago se completa. Es la ÚNICA vía por la que un evento pasa a "pagado y publicado".
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Webhook no configurado", { status: 400 });

  // Se necesita el cuerpo EXACTO (sin parsear) para verificar la firma.
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Firma inválida", { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === "paid") {
      const ok = await fulfill(session);
      if (!ok) return new Response("Error al registrar el pago", { status: 500 }); // Stripe reintenta
    }
  }
  return new Response("ok");
}

async function fulfill(session: Stripe.Checkout.Session): Promise<boolean> {
  const eventId = z.uuid().safeParse(session.metadata?.event_id ?? session.client_reference_id);
  const db = supabaseAdmin();

  // 1) Marcar pagado y publicar. Es idempotente: solo actúa si aún no estaba pagado.
  let matched: string | null = null;
  if (eventId.success) {
    const { data, error } = await db
      .from("events")
      .update({ paid_at: new Date().toISOString(), status: "published" })
      .eq("id", eventId.data)
      .is("paid_at", null)
      .select("id");
    if (error) {
      console.error("Stripe webhook: no se pudo actualizar el evento", error);
      return false;
    }
    matched = data?.[0]?.id ?? null;
    // Si no coincidió ninguna fila, o ya estaba pagado (reintento) o el evento ya no existe.
    if (!matched) {
      const { data: existing } = await db.from("events").select("id").eq("id", eventId.data).maybeSingle();
      matched = existing?.id ?? null;
    }
  }

  // 2) Guardar el registro del pago (único por sesión: los reintentos no duplican).
  const { error } = await db.from("payments").upsert(
    {
      event_id: matched,
      metadata_event_id: session.metadata?.event_id ?? session.client_reference_id ?? null,
      stripe_session_id: session.id,
      stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
      amount_total: session.amount_total ?? 0,
      currency: session.currency ?? "mxn",
      customer_email: session.customer_details?.email ?? session.customer_email ?? null,
    },
    { onConflict: "stripe_session_id", ignoreDuplicates: true },
  );
  if (error) {
    console.error("Stripe webhook: no se pudo registrar el pago", error);
    return false;
  }
  if (!matched) console.error("Stripe webhook: pago sin evento válido, revisar a mano", session.id);
  return true;
}
