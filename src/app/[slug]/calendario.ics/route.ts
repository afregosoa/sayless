import { icsFile } from "@/lib/calendar";
import { getPublicEvent } from "@/lib/events";
import { siteUrl } from "@/lib/site-url";

// /<slug>/calendario.ics -> archivo de calendario del evento (Apple Calendar, Outlook y demás).
// Solo eventos publicados: los borradores devuelven 404, igual que la invitación.
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const event = await getPublicEvent(slug);
  if (!event?.calendar) return new Response("No encontrado", { status: 404 });

  const body = icsFile(event.calendar, `${await siteUrl()}/${event.slug}`);
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${event.slug}.ics"`,
      // Cinco minutos: si el cliente cambia la hora, el cambio llega pronto.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
