import "server-only";
import { cacheLife } from "next/cache";
import { getStripe } from "./stripe";

/** Precio por evento tal como está en Stripe (ej. "$699.00 MXN"), para mostrarlo en pantalla. */
export async function getPriceLabel(): Promise<string | null> {
  "use cache";
  cacheLife("hours");

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId || !process.env.STRIPE_SECRET_KEY) return null;
  try {
    const price = await getStripe().prices.retrieve(priceId);
    if (price.unit_amount == null) return null;
    return `${new Intl.NumberFormat("es-MX", { style: "currency", currency: price.currency.toUpperCase() }).format(price.unit_amount / 100)} ${price.currency.toUpperCase()}`;
  } catch {
    return null;
  }
}
