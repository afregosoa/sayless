"use client";

import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  arrangeInRows, CANVAS_MAX_Y, CANVAS_MIN_H, CANVAS_W, clamp, GRID, ITEM_INFO, ITEM_KINDS, SHAPE_LABELS, snap,
  TABLE_SHAPES, tableGeometry, type ItemKind, type TableShape,
} from "@/lib/salon";
import { assignGroup, assignMember } from "./actions";
import { addLayoutItem, deleteLayoutItem, saveTablePositions, updateLayoutItem, updateTableLayout, type LayoutItem } from "./layout-actions";
import { TableTools } from "./seating-controls";

export type BoardTable = {
  id: string; name: string; capacity: number; x: number | null; y: number | null; shape: TableShape; rotation: number;
};
export type BoardPerson = {
  id: string; guestId: string; guestName: string; name: string | null; position: number; attending: boolean | null; tableId: string | null;
};
export type BoardItem = LayoutItem;

type Mode = "sentar" | "salon";
type Selection = { kind: "table" | "item"; id: string } | null;
type TableLook = { x: number | null; y: number | null; shape: TableShape; rotation: number };
type Placed = { x: number; y: number };

const takesSeat = (p: { attending: boolean | null }) => p.attending !== false;
const label = (p: BoardPerson) => p.name ?? `Lugar ${p.position} · ${p.guestName}`;

// Color estable por invitación (familia o grupo), para reconocer de un vistazo quiénes van juntos.
function hue(guestId: string) {
  let h = 0;
  for (const ch of guestId) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
function initials(p: BoardPerson) {
  if (!p.name) return `L${p.position}`;
  const words = p.name.trim().split(/\s+/);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}

function Chip({ p, dragging, style }: { p: BoardPerson; dragging?: boolean; style?: React.CSSProperties }) {
  return (
    <span
      className={`sb-chip${p.attending === null ? " sb-pending" : ""}${dragging ? " sb-lift" : ""}`}
      style={{ ["--h" as string]: hue(p.guestId), ...style }}
      title={`${label(p)}${p.attending === null ? " (por confirmar)" : ""}`}
    >
      {initials(p)}
    </span>
  );
}

function DraggableChip({ p, style }: { p: BoardPerson; style?: React.CSSProperties }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `m:${p.id}` });
  return (
    <button
      ref={setNodeRef} type="button" className="sb-drag" data-dragging={isDragging || undefined} style={style}
      aria-label={`${label(p)}. Arrastra para cambiar de mesa`} {...attributes} {...listeners}
    >
      <Chip p={p} />
    </button>
  );
}

function GroupHeader({ guestId, name, count }: { guestId: string; name: string; count: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `g:${guestId}` });
  return (
    <div
      ref={setNodeRef} className="sb-group-head" data-dragging={isDragging || undefined}
      {...attributes} {...listeners} aria-label={`${name}. Arrastra para sentar a toda la familia`}
    >
      <span className="sb-grip" aria-hidden="true">⠿</span>
      <b>{name}</b>
      <small>{count} {count === 1 ? "persona" : "personas"}</small>
    </div>
  );
}

function Unseated({ children, count }: { children: React.ReactNode; count: number }) {
  const { isOver, setNodeRef } = useDroppable({ id: "unseated" });
  return (
    <aside ref={setNodeRef} className="adm-card seat-pending seat-noprint sb-panel" data-over={isOver || undefined} aria-label="Personas sin mesa">
      <h2>Por ubicar <small>({count})</small></h2>
      {children}
    </aside>
  );
}

// ── Piezas del lienzo ──
function CanvasTable({ table, look, pos, people, mode, selected, scale, onSelect }: {
  table: BoardTable; look: TableLook; pos: Placed; people: BoardPerson[]; mode: Mode; selected: boolean; scale: number; onSelect: () => void;
}) {
  const seated = people.filter(takesSeat);
  const total = Math.max(table.capacity, seated.length); // con sobrecupo se dibujan sillas de más
  const geo = useMemo(() => tableGeometry(total, look.shape), [total, look.shape]);
  const drag = useDraggable({ id: `T:${table.id}`, disabled: mode !== "salon" });
  const drop = useDroppable({ id: `t:${table.id}`, disabled: mode !== "sentar" });
  const over = seated.length > table.capacity;
  const rot = look.rotation;
  const dx = (drag.transform?.x ?? 0) / scale;
  const dy = (drag.transform?.y ?? 0) / scale;

  return (
    <div
      ref={(n) => { drag.setNodeRef(n); drop.setNodeRef(n); }}
      className="sc-obj sc-table"
      data-selected={selected || undefined}
      data-over={drop.isOver || undefined}
      data-full={over || undefined}
      data-movable={mode === "salon" || undefined}
      data-moving={drag.isDragging || undefined}
      style={{ left: pos.x, top: pos.y, width: geo.width, height: geo.height, transform: `translate3d(${dx}px, ${dy}px, 0) rotate(${rot}deg)` }}
      onClick={() => { if (mode === "salon") onSelect(); }}
      {...(mode === "salon" ? { ...drag.attributes, ...drag.listeners } : {})}
      aria-label={mode === "salon" ? `${table.name}. Arrastra para moverla` : undefined}
    >
      <div className="sb-top" style={{ ...geo.table, borderRadius: geo.round ? "50%" : 12 }}>
        <span style={{ transform: `rotate(${-rot}deg)` }}>
          <b title={table.name}>{table.name}</b>
          <em>{seated.length}/{table.capacity}</em>
        </span>
      </div>
      {geo.seats.map((s, i) => {
        const p = seated[i];
        const style = { position: "absolute" as const, left: s.left, top: s.top, transform: `rotate(${-rot}deg)` };
        if (!p) return <span key={`free-${i}`} className="sb-seat" style={style} aria-hidden="true" />;
        return mode === "sentar"
          ? <DraggableChip key={p.id} p={p} style={style} />
          : <span key={p.id} className="sb-static" style={style}><Chip p={p} /></span>;
      })}
    </div>
  );
}

function CanvasItem({ item, mode, selected, scale, onSelect }: {
  item: BoardItem; mode: Mode; selected: boolean; scale: number; onSelect: () => void;
}) {
  const drag = useDraggable({ id: `I:${item.id}`, disabled: mode !== "salon" });
  const info = ITEM_INFO[item.kind];
  const dx = (drag.transform?.x ?? 0) / scale;
  const dy = (drag.transform?.y ?? 0) / scale;
  return (
    <div
      ref={drag.setNodeRef}
      className="sc-obj sc-item"
      data-kind={item.kind}
      data-selected={selected || undefined}
      data-movable={mode === "salon" || undefined}
      data-moving={drag.isDragging || undefined}
      style={{ left: item.x, top: item.y, width: item.w, height: item.h, transform: `translate3d(${dx}px, ${dy}px, 0) rotate(${item.rotation}deg)` }}
      onClick={() => { if (mode === "salon") onSelect(); }}
      {...(mode === "salon" ? { ...drag.attributes, ...drag.listeners } : {})}
      aria-label={`${item.label || info.label}${mode === "salon" ? ". Arrastra para moverlo" : ""}`}
    >
      <span style={{ transform: `rotate(${-item.rotation}deg)` }}>
        <i aria-hidden="true">{info.icon}</i> {item.label || info.label}
      </span>
    </div>
  );
}

function RotateButtons({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const norm = (v: number) => ((((v + 180) % 360) + 360) % 360) - 180;
  return (
    <span className="sc-rot" role="group" aria-label="Girar">
      <button type="button" className="adm-btn adm-ghost" aria-label="Girar a la izquierda" onClick={() => onChange(norm(value - 15))}>↺</button>
      <span aria-live="polite">{value}°</span>
      <button type="button" className="adm-btn adm-ghost" aria-label="Girar a la derecha" onClick={() => onChange(norm(value + 15))}>↻</button>
    </span>
  );
}

// ── Tablero ──
export function SeatingBoard({ eventId, eventTitle, fileName, tables, people, items: initialItems }: {
  eventId: string; eventTitle: string; fileName: string; tables: BoardTable[]; people: BoardPerson[]; items: BoardItem[];
}) {
  // Personas: estado local para que el movimiento se vea al instante; el servidor confirma y, si falla, se revierte.
  const serverKey = people.map((p) => `${p.id}:${p.tableId ?? ""}`).join("|");
  const [placed, setPlaced] = useState<Record<string, string | null>>(() => Object.fromEntries(people.map((p) => [p.id, p.tableId])));
  useEffect(() => { setPlaced(Object.fromEntries(people.map((p) => [p.id, p.tableId]))); }, [serverKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Plano: los cambios locales mandan sobre lo que llegue del servidor (así un guardado en curso no se pisa).
  const [overrides, setOverrides] = useState<Record<string, Partial<TableLook>>>({});
  const [items, setItems] = useState<BoardItem[]>(initialItems);
  const [mode, setMode] = useState<Mode>("sentar");
  const [selection, setSelection] = useState<Selection>(null);
  const [snapOn, setSnapOn] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, start] = useTransition();

  const [scale, setScale] = useState(1);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / CANVAS_W) || 1);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const current = useMemo(() => people.map((p) => ({ ...p, tableId: placed[p.id] ?? null })), [people, placed]);
  const byId = new Map(current.map((p) => [p.id, p]));
  const unseated = current.filter((p) => !p.tableId && takesSeat(p));
  const guests = [...new Map(unseated.map((p) => [p.guestId, p.guestName])).entries()];

  // Aspecto efectivo de cada mesa (lo local sobre lo guardado) y su tamaño dibujado.
  const looks = useMemo(() => {
    const out = new Map<string, TableLook & { w: number; h: number }>();
    for (const t of tables) {
      const o = overrides[t.id] ?? {};
      const shape = o.shape ?? t.shape;
      const seats = Math.max(t.capacity, current.filter((p) => p.tableId === t.id && takesSeat(p)).length);
      const g = tableGeometry(seats, shape);
      out.set(t.id, { x: o.x ?? t.x, y: o.y ?? t.y, shape, rotation: o.rotation ?? t.rotation, w: g.width, h: g.height });
    }
    return out;
  }, [tables, overrides, current]);

  // Mesas sin posición (las recién creadas, o la primera vez): se colocan en filas debajo de lo que ya existe
  // y se guardan una sola vez. `placing` evita colocar dos veces la misma mesa.
  const placing = useRef(new Set<string>());
  useEffect(() => {
    const missing = tables.filter((t) => looks.get(t.id)!.x === null && !placing.current.has(t.id));
    if (missing.length === 0) return;
    missing.forEach((t) => placing.current.add(t.id));
    let bottom = 0;
    for (const t of tables) { const l = looks.get(t.id)!; if (l.x !== null) bottom = Math.max(bottom, (l.y ?? 0) + l.h); }
    for (const i of items) bottom = Math.max(bottom, i.y + i.h);
    const spots = arrangeInRows(missing.map((t) => ({ id: t.id, w: looks.get(t.id)!.w, h: looks.get(t.id)!.h })), bottom ? bottom + 40 : 40);
    setOverrides((o) => ({ ...o, ...Object.fromEntries(Object.entries(spots).map(([id, p]) => [id, { ...o[id], x: p.x, y: p.y }])) }));
    void saveTablePositions(eventId, Object.entries(spots).map(([id, p]) => ({ id, ...p }))).catch(() => {});
  }, [tables, looks, items, eventId]);

  const canvasH = useMemo(() => {
    let bottom = 0;
    for (const t of tables) { const l = looks.get(t.id)!; bottom = Math.max(bottom, (l.y ?? 0) + l.h); }
    for (const i of items) bottom = Math.max(bottom, i.y + i.h);
    return Math.min(CANVAS_MAX_Y + 200, Math.max(CANVAS_MIN_H, Math.ceil((bottom + 60) / 100) * 100));
  }, [tables, looks, items]);

  // ── Guardado optimista: se ve al instante; si el servidor falla, se revierte y se avisa ──
  const guard = useCallback(async (run: () => Promise<{ error?: string }>, revert: () => void) => {
    try {
      const res = await run();
      if (res.error) { revert(); setMessage(res.error); }
    } catch {
      revert();
      setMessage("No se pudo guardar el cambio. Revisa tu conexión e intenta de nuevo.");
    }
  }, []);

  function patchTable(id: string, patch: Partial<TableLook>) {
    const before = overrides[id];
    setOverrides((o) => ({ ...o, [id]: { ...o[id], ...patch } }));
    setMessage(null);
    start(() => guard(() => updateTableLayout(eventId, id, patch), () => setOverrides((o) => ({ ...o, [id]: before ?? {} }))));
  }
  function patchItem(id: string, patch: Partial<BoardItem>) {
    const before = items;
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    setMessage(null);
    const { x, y, w, h, rotation, label: text } = patch;
    start(() => guard(() => updateLayoutItem(eventId, id, { x, y, w, h, rotation, label: text }), () => setItems(before)));
  }
  function movePeople(memberIds: string[], tableId: string | null, run: () => Promise<{ error?: string }>) {
    const before = placed;
    setPlaced({ ...placed, ...Object.fromEntries(memberIds.map((id) => [id, tableId])) });
    setMessage(null);
    start(() => guard(run, () => setPlaced(before)));
  }

  function addItem(kind: ItemKind) {
    const info = ITEM_INFO[kind];
    const n = items.length;
    const input = { kind, label: "", x: snap(CANVAS_W / 2 - info.w / 2 + (n % 5) * GRID, true), y: snap(40 + (n % 5) * GRID, true), w: info.w, h: info.h, rotation: 0 };
    setMessage(null);
    start(async () => {
      try {
        const res = await addLayoutItem(eventId, input);
        if (res.error || !res.item) { setMessage(res.error ?? "No se pudo agregar el elemento."); return; }
        const created = res.item;
        setItems((list) => [...list, created]);
        setSelection({ kind: "item", id: created.id });
      } catch {
        setMessage("No se pudo agregar el elemento. Revisa tu conexión e intenta de nuevo.");
      }
    });
  }
  function removeItem(id: string) {
    const before = items;
    setItems((list) => list.filter((i) => i.id !== id));
    setSelection(null);
    start(() => guard(() => deleteLayoutItem(eventId, id), () => setItems(before)));
  }
  function arrangeTables() {
    let bottom = 0;
    for (const i of items) bottom = Math.max(bottom, i.y + i.h);
    const spots = arrangeInRows(tables.map((t) => ({ id: t.id, w: looks.get(t.id)!.w, h: looks.get(t.id)!.h })), bottom ? bottom + 40 : 40);
    const before = overrides;
    setOverrides((o) => ({ ...o, ...Object.fromEntries(Object.entries(spots).map(([id, p]) => [id, { ...o[id], x: p.x, y: p.y }])) }));
    setMessage(null);
    start(() => guard(() => saveTablePositions(eventId, Object.entries(spots).map(([id, p]) => ({ id, ...p }))), () => setOverrides(before)));
  }

  // PDF con el plano (dibujo) y los listados. Se arma en el navegador con lo que se ve en pantalla, aunque aún se esté guardando.
  const [exporting, setExporting] = useState(false);
  async function exportPdf() {
    setExporting(true);
    setMessage(null);
    try {
      const { buildSeatingPdf } = await import("@/lib/seating-pdf");
      const tableName = new Map(tables.map((t) => [t.id, t.name]));
      const toPdf = (p: BoardPerson) => ({ label: label(p), initials: initials(p), hue: hue(p.guestId), attending: p.attending });
      const bytes = await buildSeatingPdf({
        title: eventTitle,
        tables: tables.map((t) => {
          const l = looks.get(t.id)!;
          return { name: t.name, capacity: t.capacity, x: l.x ?? 0, y: l.y ?? 0, shape: l.shape, rotation: l.rotation, people: current.filter((p) => p.tableId === t.id).map(toPdf) };
        }),
        items: items.map((i) => ({ kind: i.kind, label: i.label, x: i.x, y: i.y, w: i.w, h: i.h, rotation: i.rotation })),
        unseated: unseated.map(toPdf),
        everyone: current.filter(takesSeat).map((p) => ({ name: label(p), table: p.tableId ? tableName.get(p.tableId) ?? null : null })),
      });
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setMessage("No se pudo generar el PDF. Intenta de nuevo.");
    } finally {
      setExporting(false);
    }
  }

  function moveSelected(dx: number, dy: number) {
    if (!selection) return;
    if (selection.kind === "table") {
      const l = looks.get(selection.id);
      if (l) patchTable(selection.id, { x: clamp((l.x ?? 0) + dx, 0, CANVAS_W - l.w), y: clamp((l.y ?? 0) + dy, 0, CANVAS_MAX_Y) });
    } else {
      const i = items.find((x) => x.id === selection.id);
      if (i) patchItem(i.id, { x: clamp(i.x + dx, 0, CANVAS_W - i.w), y: clamp(i.y + dy, 0, CANVAS_MAX_Y) });
    }
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const from = String(e.active.id);

    // Plano: mover una mesa o un elemento (el desplazamiento llega en píxeles de pantalla; se pasa a unidades del lienzo).
    if (from.startsWith("T:") || from.startsWith("I:")) {
      const id = from.slice(2);
      const dx = e.delta.x / scale, dy = e.delta.y / scale;
      if (from.startsWith("T:")) {
        const l = looks.get(id);
        if (!l) return;
        patchTable(id, { x: clamp(snap((l.x ?? 0) + dx, snapOn), 0, CANVAS_W - l.w), y: clamp(snap((l.y ?? 0) + dy, snapOn), 0, CANVAS_MAX_Y) });
        setSelection({ kind: "table", id });
      } else {
        const i = items.find((x) => x.id === id);
        if (!i) return;
        patchItem(id, { x: clamp(snap(i.x + dx, snapOn), 0, CANVAS_W - i.w), y: clamp(snap(i.y + dy, snapOn), 0, CANVAS_MAX_Y) });
        setSelection({ kind: "item", id });
      }
      return;
    }

    // Personas: sentar a alguien (o a toda la familia) en una mesa, o devolverlo al panel.
    const to = e.over ? String(e.over.id) : null;
    if (!to) return;
    const tableId = to.startsWith("t:") ? to.slice(2) : to === "unseated" ? null : undefined;
    if (tableId === undefined) return;

    if (from.startsWith("m:")) {
      const id = from.slice(2);
      if ((byId.get(id)?.tableId ?? null) === tableId) return;
      movePeople([id], tableId, () => assignMember(id, eventId, tableId));
    } else if (from.startsWith("g:") && tableId) {
      const guestId = from.slice(2);
      const pending = unseated.filter((p) => p.guestId === guestId).map((p) => p.id);
      if (pending.length) movePeople(pending, tableId, () => assignGroup(guestId, eventId, tableId));
    }
  }

  const draggingPerson = active?.startsWith("m:") ? byId.get(active.slice(2)) : undefined;
  const draggingGroup = active?.startsWith("g:") ? guests.find(([id]) => id === active.slice(2)) : undefined;
  const selTable = selection?.kind === "table" ? tables.find((t) => t.id === selection.id) : undefined;
  const selItem = selection?.kind === "item" ? items.find((i) => i.id === selection.id) : undefined;

  const canvas = (
    <div className="sc-frame">
      <div
        ref={wrap} className="sc-wrap" data-mode={mode} style={{ height: canvasH * scale }} tabIndex={mode === "salon" ? 0 : undefined}
        onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("sc")) setSelection(null); }}
        onKeyDown={(e) => {
          if (mode !== "salon" || !selection) return;
          const step = e.shiftKey ? 1 : GRID;
          const dir = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, number[]>)[e.key];
          if (dir) { e.preventDefault(); moveSelected(dir[0], dir[1]); }
        }}
      >
        <div className="sc" style={{ width: CANVAS_W, height: canvasH, transform: `scale(${scale})` }}>
          {items.map((i) => (
            <CanvasItem key={i.id} item={i} mode={mode} scale={scale}
              selected={selection?.kind === "item" && selection.id === i.id} onSelect={() => setSelection({ kind: "item", id: i.id })} />
          ))}
          {tables.map((t) => {
            const l = looks.get(t.id)!;
            return (
              <CanvasTable key={t.id} table={t} look={l} pos={{ x: l.x ?? 0, y: l.y ?? 0 }} mode={mode} scale={scale}
                people={current.filter((p) => p.tableId === t.id)}
                selected={selection?.kind === "table" && selection.id === t.id} onSelect={() => setSelection({ kind: "table", id: t.id })} />
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <DndContext id="seating-board" sensors={sensors} onDragStart={(e: DragStartEvent) => setActive(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      <div className="sc-bar seat-noprint">
        <div className="sc-modes" role="group" aria-label="Modo del plano">
          <button type="button" aria-pressed={mode === "sentar"} onClick={() => { setMode("sentar"); setSelection(null); }}>Sentar personas</button>
          <button type="button" aria-pressed={mode === "salon"} onClick={() => setMode("salon")}>Acomodar salón</button>
        </div>
        <button type="button" className="adm-btn adm-ghost" onClick={exportPdf} disabled={exporting}>
          {exporting ? "Generando PDF…" : "Descargar PDF"}
        </button>
        {mode === "salon" && (
          <div className="sc-tools">
            <select className="adm-select" aria-label="Agregar elemento del salón" value="" onChange={(e) => { if (e.target.value) addItem(e.target.value as ItemKind); }}>
              <option value="">+ Agregar elemento…</option>
              {ITEM_KINDS.map((k) => <option key={k} value={k}>{ITEM_INFO[k].label}</option>)}
            </select>
            <button type="button" className="adm-btn adm-ghost" onClick={arrangeTables}>Ordenar mesas en filas</button>
            <label className="adm-check"><input type="checkbox" checked={snapOn} onChange={(e) => setSnapOn(e.target.checked)} /> Alinear a la cuadrícula</label>
          </div>
        )}
      </div>

      {mode === "salon" && (
        <div className="sc-selbar seat-noprint" role="group" aria-label="Elemento seleccionado">
          {selTable && (
            <>
              <b>{selTable.name}</b>
              <label>Forma
                <select className="adm-select" value={looks.get(selTable.id)!.shape} onChange={(e) => patchTable(selTable.id, { shape: e.target.value as TableShape })}>
                  {TABLE_SHAPES.map((s) => <option key={s} value={s}>{SHAPE_LABELS[s]}</option>)}
                </select>
              </label>
              <RotateButtons value={looks.get(selTable.id)!.rotation} onChange={(rotation) => patchTable(selTable.id, { rotation })} />
            </>
          )}
          {selItem && (
            <>
              <label>Nombre
                <input defaultValue={selItem.label} key={`${selItem.id}-${selItem.label}`} maxLength={40} placeholder={ITEM_INFO[selItem.kind].label}
                  onBlur={(e) => { if (e.target.value.trim() !== selItem.label) patchItem(selItem.id, { label: e.target.value.trim() }); }} />
              </label>
              <label>Ancho
                <input type="number" min={20} max={CANVAS_W} step={GRID} defaultValue={selItem.w} key={`w-${selItem.id}-${selItem.w}`}
                  onBlur={(e) => { const v = clamp(Number(e.target.value) || selItem.w, 20, CANVAS_W); if (v !== selItem.w) patchItem(selItem.id, { w: v }); }} />
              </label>
              <label>Alto
                <input type="number" min={20} max={800} step={GRID} defaultValue={selItem.h} key={`h-${selItem.id}-${selItem.h}`}
                  onBlur={(e) => { const v = clamp(Number(e.target.value) || selItem.h, 20, 800); if (v !== selItem.h) patchItem(selItem.id, { h: v }); }} />
              </label>
              <RotateButtons value={selItem.rotation} onChange={(rotation) => patchItem(selItem.id, { rotation })} />
              <button type="button" className="adm-link adm-danger" onClick={() => { if (confirm("¿Quitar este elemento del salón?")) removeItem(selItem.id); }}>Quitar</button>
            </>
          )}
          {!selTable && !selItem && <span className="adm-hint">Toca una mesa o un elemento para cambiar su forma, girarlo o moverlo (también con las flechas del teclado).</span>}
        </div>
      )}

      <p role="status" aria-live="polite" className={message ? "adm-err" : "sr-only"}>{message ?? ""}</p>

      {mode === "sentar" ? (
        <div className="seat-layout">
          <Unseated count={unseated.length}>
            {unseated.length === 0 ? (
              <p className="adm-hint">Todos tienen mesa. Arrastra aquí a alguien para quitarle la mesa.</p>
            ) : (
              <ul className="adm-plain">
                {guests.map(([guestId, name]) => {
                  const pend = unseated.filter((p) => p.guestId === guestId);
                  return (
                    <li key={guestId} className="seat-group-box">
                      <GroupHeader guestId={guestId} name={name} count={pend.length} />
                      <div className="sb-people">
                        {pend.map((p) => (
                          <span key={p.id} className="sb-person">
                            <DraggableChip p={p} />
                            <span>{p.name ?? `Lugar ${p.position}`}</span>
                          </span>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <small className="adm-hint">Arrastra a una persona (o a toda la familia, desde su nombre) hasta una mesa del plano.</small>
          </Unseated>
          {canvas}
        </div>
      ) : (
        canvas
      )}

      <h2 className="sb-detail-title seat-noprint">Detalle por mesa</h2>
      <div className="sb-grid">
        {tables.map((t) => {
          const here = current.filter((p) => p.tableId === t.id);
          const seated = here.filter(takesSeat);
          const declined = here.filter((p) => !takesSeat(p));
          const over = seated.length - t.capacity;
          return (
            <div key={t.id} className="adm-card sb-card" role="group" aria-label={t.name}>
              <header className="sb-card-head"><h3>{t.name}</h3><span className="seat-count">{seated.length}/{t.capacity}</span></header>
              {over > 0 && <small className="adm-err">Sobrecupo: {over} {over === 1 ? "persona" : "personas"} de más.</small>}
              {here.length === 0 ? <p className="adm-hint">Sin invitados.</p> : (
                <ul className="sb-names">
                  {seated.map((p) => <li key={p.id}><span className="sb-dot" style={{ ["--h" as string]: hue(p.guestId) }} />{label(p)}{p.attending === null && <em> · por confirmar</em>}</li>)}
                  {declined.map((p) => <li key={p.id} className="sb-no">{label(p)} · no asiste</li>)}
                </ul>
              )}
              <div className="seat-noprint"><TableTools eventId={eventId} table={t} /></div>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {draggingPerson ? <Chip p={draggingPerson} dragging /> : draggingGroup ? <div className="sb-group-ghost">{draggingGroup[1]}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}
