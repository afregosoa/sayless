// Las mesas se asignan por persona (guest_members). Una invitación (familia o grupo) tiene una persona por pase;
// quien no asiste no ocupa lugar. Mientras alguien no responde, se cuenta como previsión.
export const MAX_TABLES = 80;

export type SeatMember = { id: string; name: string | null; attending: boolean | null; table_id: string | null };

/** ¿Ocupa un lugar? Todos menos quien confirmó que no asiste. */
export const takesSeat = (m: { attending: boolean | null }) => m.attending !== false;

/** Nombre de la persona, o "Lugar N" (con el nombre de su invitación) si aún no tiene. */
export function memberLabel(m: { name: string | null }, position: number, group: string): string {
  return m.name ?? `Lugar ${position} · ${group}`;
}

/** "Ana, Luis (no asiste), +2 sin nombre" */
export function peopleSummary(members: Pick<SeatMember, "name" | "attending">[], passes: number): string {
  const named = members.filter((m) => m.name);
  const unnamed = Math.max(0, Math.max(members.length, passes) - named.length);
  const parts = named.map((m) => (m.attending === false ? `${m.name} (no)` : m.name!));
  if (unnamed > 0) parts.push(`+${unnamed} sin nombre`);
  return parts.join(", ");
}

/** "Mesa 1", o "Mesa 1 (2), Mesa 2 (1)" si la invitación está repartida; "" si nadie tiene mesa. */
export function tableSummary(members: SeatMember[], tableName: Map<string, string>): string {
  const counts = new Map<string, number>();
  for (const m of members) {
    if (!takesSeat(m) || !m.table_id) continue;
    counts.set(m.table_id, (counts.get(m.table_id) ?? 0) + 1);
  }
  const rows = [...counts.entries()].map(([id, n]) => ({ label: tableName.get(id) ?? "—", n }));
  if (rows.length === 0) return "";
  const active = members.filter(takesSeat).length;
  const seated = rows.reduce((a, r) => a + r.n, 0);
  const text = rows.length === 1 && seated === active ? rows[0].label : rows.map((r) => `${r.label} (${r.n})`).join(", ");
  return seated < active && rows.length === 1 ? `${text} (${seated})` : text;
}
