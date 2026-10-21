// PDF del plano de mesas: página 1 con el dibujo del salón y, después, el listado por mesa y un listado alfabético.
// Se genera en el navegador (pdf-lib, sin servidor) con el estado actual del plano, aunque aún no se haya guardado.
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { ITEM_INFO, SEAT, tableGeometry, type ItemKind, type TableShape } from "./salon";

export type PdfPerson = { label: string; initials: string; hue: number; attending: boolean | null };
export type PdfTable = {
  name: string; capacity: number; x: number; y: number; shape: TableShape; rotation: number; people: PdfPerson[];
};
export type PdfItem = { kind: ItemKind; label: string; x: number; y: number; w: number; h: number; rotation: number };
export type PdfInput = {
  title: string;
  tables: PdfTable[];
  items: PdfItem[];
  unseated: PdfPerson[];            // personas que asisten (o aún no responden) y no tienen mesa
  everyone: { name: string; table: string | null }[]; // para el listado alfabético
  generatedAt?: Date;
};

// Carta horizontal (puntos PDF).
const PW = 792, PH = 612, M = 36;
const seated = (p: PdfPerson) => p.attending !== false;

const clean = (font: PDFFont, text: string) => {
  // Las fuentes estándar del PDF no traen todos los caracteres (emojis, alfabetos raros): se sustituyen por "?".
  let set: number[] | null = null;
  try { set = font.getCharacterSet(); } catch { set = null; }
  return [...text].map((ch) => (set && !set.includes(ch.codePointAt(0)!) ? "?" : ch)).join("");
};

function hsl(h: number, s: number, l: number) {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgb(f(0), f(8), f(4));
}

function rotatePoint(px: number, py: number, cx: number, cy: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  const dx = px - cx, dy = py - cy;
  return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) };
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last.length > 1 && font.widthOfTextAtSize(`${last}…`, size) > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}...`;
  }
  return lines;
}

export async function buildSeatingPdf(input: PdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.13, 0.14, 0.12), muted = rgb(0.45, 0.46, 0.42), line = rgb(0.75, 0.75, 0.72);

  const text = (page: PDFPage, s: string, x: number, yTop: number, size: number, f = font, color = ink, align: "left" | "center" | "right" = "left") => {
    const t = clean(f, s);
    const w = f.widthOfTextAtSize(t, size);
    const px = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    page.drawText(t, { x: px, y: PH - yTop - size * 0.78, size, font: f, color });
  };
  // Los trazos se calculan con y hacia abajo (como en pantalla); drawSvgPath usa ese mismo sentido.
  const poly = (page: PDFPage, pts: { x: number; y: number }[], o: { fill?: ReturnType<typeof rgb>; stroke?: ReturnType<typeof rgb>; width?: number; dash?: number[] }) => {
    const d = `M ${pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")} Z`;
    page.drawSvgPath(d, { x: 0, y: PH, color: o.fill, borderColor: o.stroke, borderWidth: o.width ?? 0.8, borderDashArray: o.dash });
  };

  // ───────────── Página 1: dibujo del salón ─────────────
  const plan = doc.addPage([PW, PH]);
  const seatsOf = (t: PdfTable) => Math.max(t.capacity, t.people.filter(seated).length);

  // Encuadre: caja que contiene todo lo dibujado (con las mesas ya giradas), para aprovechar la hoja.
  type Box = { x0: number; y0: number; x1: number; y1: number };
  const box: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (x: number, y: number) => { box.x0 = Math.min(box.x0, x); box.y0 = Math.min(box.y0, y); box.x1 = Math.max(box.x1, x); box.y1 = Math.max(box.y1, y); };
  const corners = (x: number, y: number, w: number, h: number, rot: number) => {
    const c = { x: x + w / 2, y: y + h / 2 };
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => rotatePoint(px, py, c.x, c.y, rot));
  };
  const geos = input.tables.map((t) => tableGeometry(seatsOf(t), t.shape));
  input.tables.forEach((t, i) => corners(t.x, t.y, geos[i].width, geos[i].height, t.rotation).forEach((p) => grow(p.x, p.y)));
  input.items.forEach((it) => corners(it.x, it.y, it.w, it.h, it.rotation).forEach((p) => grow(p.x, p.y)));
  if (!isFinite(box.x0)) { box.x0 = 0; box.y0 = 0; box.x1 = 1200; box.y1 = 800; }

  const pad = 16;
  const bw = box.x1 - box.x0 + pad * 2, bh = box.y1 - box.y0 + pad * 2;
  const areaTop = M + 40, areaH = PH - areaTop - M - 8, areaW = PW - 2 * M;
  const s = Math.min(areaW / bw, areaH / bh);
  const ox = M + (areaW - bw * s) / 2, oy = areaTop + (areaH - bh * s) / 2;
  const X = (x: number) => ox + (x - box.x0 + pad) * s;
  const Y = (y: number) => oy + (y - box.y0 + pad) * s;

  text(plan, input.title || "Plano de mesas", M, M, 16, bold);
  const nSeated = input.tables.reduce((n, t) => n + t.people.filter(seated).length, 0);
  text(plan, `Plano de mesas · ${input.tables.length} mesas · ${nSeated} personas sentadas`, M, M + 21, 9, font, muted);
  text(plan, (input.generatedAt ?? new Date()).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }), PW - M, M + 3, 9, font, muted, "right");

  // Elementos del salón (debajo de las mesas)
  for (const it of input.items) {
    const pts = corners(it.x, it.y, it.w, it.h, it.rotation).map((p) => ({ x: X(p.x), y: Y(p.y) }));
    const dance = it.kind === "dance";
    poly(plan, pts, { fill: dance ? rgb(0.86, 0.88, 0.8) : rgb(0.93, 0.93, 0.9), stroke: rgb(0.5, 0.5, 0.46), width: 0.8, dash: it.kind === "stage" ? undefined : [3, 2] });
    const c = rotatePoint(it.x + it.w / 2, it.y + it.h / 2, it.x + it.w / 2, it.y + it.h / 2, 0);
    const label = it.label || ITEM_INFO[it.kind].label;
    const size = Math.max(6, Math.min(11, 12 * s));
    const lines = wrap(font, clean(font, label), size, Math.max(20, Math.min(it.w, it.h > it.w ? it.h : it.w) * s - 6), 2);
    lines.forEach((l, i) => text(plan, l, X(c.x), Y(c.y) - (lines.length * size) / 2 + i * size * 1.1, size, font, ink, "center"));
  }

  // Mesas
  input.tables.forEach((t, i) => {
    const g = geos[i];
    const c = { x: t.x + g.width / 2, y: t.y + g.height / 2 };
    const tx = t.x + g.table.left, ty = t.y + g.table.top;
    const tableOver = t.people.filter(seated).length > t.capacity;
    const stroke = tableOver ? rgb(0.72, 0.25, 0.2) : ink;

    if (g.round) {
      const m = rotatePoint(tx + g.table.width / 2, ty + g.table.height / 2, c.x, c.y, t.rotation);
      plan.drawCircle({ x: X(m.x), y: PH - Y(m.y), size: (g.table.width / 2) * s, color: rgb(1, 1, 1), borderColor: stroke, borderWidth: 1 });
    } else {
      const pts = corners(tx, ty, g.table.width, g.table.height, 0).map((p) => rotatePoint(p.x, p.y, c.x, c.y, t.rotation)).map((p) => ({ x: X(p.x), y: Y(p.y) }));
      poly(plan, pts, { fill: rgb(1, 1, 1), stroke, width: 1 });
    }

    // Sillas
    const people = t.people.filter(seated);
    g.seats.forEach((st, k) => {
      const m = rotatePoint(t.x + st.left + SEAT / 2, t.y + st.top + SEAT / 2, c.x, c.y, t.rotation);
      const p = people[k];
      const r = (SEAT / 2 - 2) * s;
      if (!p) {
        plan.drawCircle({ x: X(m.x), y: PH - Y(m.y), size: r, borderColor: line, borderWidth: 0.6, borderDashArray: [2, 2] });
        return;
      }
      plan.drawCircle({
        x: X(m.x), y: PH - Y(m.y), size: r, color: hsl(p.hue, 0.38, 0.74), borderColor: hsl(p.hue, 0.3, 0.4), borderWidth: 0.7,
        borderDashArray: p.attending === null ? [2, 1.5] : undefined,
      });
      text(plan, p.initials, X(m.x), Y(m.y) - Math.max(5, 11 * s) / 2 + 0.3, Math.max(5, 11 * s), bold, ink, "center");
    });

    // Nombre y conteo en el centro de la mesa (siempre horizontal, para que se lea)
    const cm = rotatePoint(tx + g.table.width / 2, ty + g.table.height / 2, c.x, c.y, t.rotation);
    const size = Math.max(6, Math.min(11, 13 * s));
    const lines = wrap(bold, clean(bold, t.name), size, Math.max(24, g.table.width * s * 0.86), 2);
    const total = lines.length * size * 1.1 + size;
    lines.forEach((l, k) => text(plan, l, X(cm.x), Y(cm.y) - total / 2 + k * size * 1.1, size, bold, ink, "center"));
    text(plan, `${people.length}/${t.capacity}`, X(cm.x), Y(cm.y) - total / 2 + lines.length * size * 1.1, size * 0.9, font, tableOver ? rgb(0.72, 0.25, 0.2) : muted, "center");
  });

  // ───────────── Listados ─────────────
  const COLS = 3, GAP = 18, COLW = (PW - 2 * M - GAP * (COLS - 1)) / COLS;
  const BOTTOM = PH - M - 8;
  let page: PDFPage | null = null;
  let col = 0, y = 0;
  let heading = "";

  const newPage = (title: string, cont = false) => {
    page = doc.addPage([PW, PH]);
    text(page, `${title}${cont ? " (continuación)" : ""}`, M, M, 14, bold);
    text(page, input.title || "", PW - M, M + 3, 9, font, muted, "right");
    heading = title;
    col = 0; y = M + 28;
  };
  // Avanza a la siguiente columna (o página) si no caben `need` puntos de alto.
  const room = (need: number) => {
    if (!page) return;
    if (y + need > BOTTOM) {
      col += 1; y = M + 28;
      if (col >= COLS) newPage(heading, true);
    }
  };
  const colX = () => M + col * (COLW + GAP);

  newPage("Listado por mesa");
  const block = (title: string, count: string, rows: { text: string; muted?: boolean; hue?: number }[], over = false) => {
    room(16 + 12);
    text(page!, title, colX(), y, 10.5, bold, over ? rgb(0.72, 0.25, 0.2) : ink);
    text(page!, count, colX() + COLW, y + 1, 8.5, font, muted, "right");
    page!.drawLine({ start: { x: colX(), y: PH - y - 14 }, end: { x: colX() + COLW, y: PH - y - 14 }, thickness: 0.5, color: line });
    y += 18;
    for (const r of rows) {
      room(12);
      if (r.hue !== undefined) page!.drawCircle({ x: colX() + 3, y: PH - y - 4.5, size: 2.6, color: hsl(r.hue, 0.38, 0.62) });
      const label = clean(font, r.text);
      let shown = label;
      while (shown.length > 1 && font.widthOfTextAtSize(shown, 9) > COLW - 10) shown = shown.slice(0, -1);
      text(page!, shown === label ? shown : `${shown.trimEnd()}…`, colX() + 10, y, 9, font, r.muted ? muted : ink);
      y += 11.5;
    }
    y += 8;
  };

  for (const t of input.tables) {
    const rows = t.people.map((p) => (p.attending === false
      ? { text: `${p.label} (no asiste)`, muted: true }
      : { text: p.attending === null ? `${p.label} (por confirmar)` : p.label, hue: p.hue }));
    const n = t.people.filter(seated).length;
    block(t.name, `${n}/${t.capacity}`, rows.length ? rows : [{ text: "Sin invitados", muted: true }], n > t.capacity);
  }
  if (input.unseated.length) {
    block("Sin mesa", `${input.unseated.length}`, input.unseated.map((p) => ({ text: p.attending === null ? `${p.label} (por confirmar)` : p.label, hue: p.hue })));
  }

  // Listado alfabético: para consultar rápido "¿en qué mesa está…?" (por ejemplo, en la entrada).
  newPage("Invitados por orden alfabético");
  const sorted = [...input.everyone].sort((a, b) => a.name.localeCompare(b.name, "es"));
  let letter = "";
  for (const r of sorted) {
    const first = r.name.trim().charAt(0).toLocaleUpperCase("es");
    if (first !== letter) {
      letter = first;
      room(26);
      text(page!, letter, colX(), y + 3, 10, bold, muted);
      y += 17;
    }
    room(12);
    const table = r.table ?? "sin mesa";
    const tw = font.widthOfTextAtSize(clean(font, table), 9);
    let name = clean(font, r.name);
    while (name.length > 1 && font.widthOfTextAtSize(name, 9) > COLW - tw - 12) name = name.slice(0, -1);
    text(page!, name === clean(font, r.name) ? name : `${name.trimEnd()}…`, colX(), y, 9);
    text(page!, table, colX() + COLW, y, 9, r.table ? bold : font, r.table ? ink : muted, "right");
    y += 11.5;
  }

  // Pie de página con numeración
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const foot = `Sayless · Página ${i + 1} de ${pages.length}`;
    p.drawText(foot, { x: PW / 2 - font.widthOfTextAtSize(foot, 8) / 2, y: 18, size: 8, font, color: muted });
  });

  doc.setTitle(`Plano de mesas · ${input.title}`);
  doc.setProducer("Sayless");
  return doc.save();
}
