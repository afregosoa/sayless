// "hace 5 minutos", "hace 2 días"… (en español). Para fechas pasadas.
const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "";
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "justo ahora";
  if (min < 60) return rtf.format(-min, "minute");
  const hours = Math.floor(min / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 30) return rtf.format(-days, "day");
  const months = Math.floor(days / 30);
  return rtf.format(-Math.min(months, 11), "month");
}
