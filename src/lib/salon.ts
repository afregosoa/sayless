// Plano del salón: geometría compartida entre el lienzo y las acciones del servidor.
// Coordenadas en "unidades del lienzo": 1200 de ancho; el alto crece según el contenido (mínimo 800).
export const CANVAS_W = 1200;
export const CANVAS_MIN_H = 800;
export const CANVAS_MAX_Y = 2400;
export const GRID = 20;
export const SEAT = 34;
export const MAX_ITEMS = 60;

export const TABLE_SHAPES = ["auto", "round", "rect", "head"] as const;
export type TableShape = (typeof TABLE_SHAPES)[number];
export const SHAPE_LABELS: Record<TableShape, string> = {
  auto: "Automática", round: "Redonda", rect: "Rectangular", head: "De honor",
};

export const ITEM_KINDS = ["dance", "stage", "bar", "entrance", "gifts", "dj", "restrooms", "other"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export const ITEM_INFO: Record<ItemKind, { label: string; w: number; h: number; icon: string }> = {
  dance: { label: "Pista de baile", w: 240, h: 180, icon: "♫" },
  stage: { label: "Escenario", w: 260, h: 90, icon: "▭" },
  bar: { label: "Barra", w: 200, h: 50, icon: "🍸" },
  entrance: { label: "Entrada", w: 110, h: 44, icon: "⇥" },
  gifts: { label: "Mesa de regalos", w: 130, h: 50, icon: "🎁" },
  dj: { label: "Cabina de DJ", w: 110, h: 60, icon: "🎧" },
  restrooms: { label: "Baños", w: 90, h: 60, icon: "WC" },
  other: { label: "Otro", w: 120, h: 70, icon: "•" },
};

export const snap = (v: number, on: boolean) => (on ? Math.round(v / GRID) * GRID : Math.round(v));
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Medidas y posición de las sillas de una mesa según su forma y cuántos lugares dibuja. */
export function tableGeometry(seats: number, shape: TableShape) {
  const kind = shape === "auto" ? (seats <= 14 ? "round" : "rect") : shape;
  if (kind === "round") {
    const table = Math.max(84, Math.round((seats * (SEAT + 6)) / Math.PI) - SEAT);
    const radius = table / 2 + SEAT / 2 + 6;
    const size = Math.round((radius + SEAT / 2 + 8) * 2);
    const c = size / 2;
    return {
      width: size, height: size, round: true,
      table: { width: table, height: table, left: c - table / 2, top: c - table / 2 },
      seats: Array.from({ length: seats }, (_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / seats;
        return { left: c + radius * Math.cos(a) - SEAT / 2, top: c + radius * Math.sin(a) - SEAT / 2 };
      }),
    };
  }
  const tableH = 64;
  const row = (n: number, width: number, y: number) =>
    Array.from({ length: n }, (_, i) => ({ left: (width - n * (SEAT + 6)) / 2 + i * (SEAT + 6) + 3, top: y }));
  if (kind === "head") {
    // Mesa de honor: todos los lugares de un solo lado (de cara a los invitados).
    const width = Math.max(seats, 2) * (SEAT + 6) + 16;
    return {
      width, height: tableH + SEAT + 18, round: false,
      table: { width: width - 24, height: tableH, left: 12, top: SEAT + 14 },
      seats: row(seats, width, 4),
    };
  }
  const top = Math.ceil(seats / 2);
  const width = Math.max(top, 2) * (SEAT + 6) + 16;
  return {
    width, height: tableH + 2 * (SEAT + 14), round: false,
    table: { width: width - 24, height: tableH, left: 12, top: SEAT + 14 },
    seats: [...row(top, width, 4), ...row(seats - top, width, SEAT + 14 + tableH + 10)],
  };
}

/** Coloca en filas (de izquierda a derecha) las piezas que no tienen posición, debajo de lo que ya existe. */
export function arrangeInRows(
  boxes: { id: string; w: number; h: number }[],
  startY: number,
): Record<string, { x: number; y: number }> {
  const gap = 36, margin = 40;
  const out: Record<string, { x: number; y: number }> = {};
  let x = margin, y = startY, rowH = 0;
  for (const b of boxes) {
    if (x + b.w > CANVAS_W - margin && x > margin) { x = margin; y += rowH + gap; rowH = 0; }
    out[b.id] = { x: snap(x, true), y: snap(y, true) };
    x += b.w + gap;
    rowH = Math.max(rowH, b.h);
  }
  return out;
}
