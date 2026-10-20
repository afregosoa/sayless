"use client";

import { useActionState, useState, useTransition } from "react";
import type { FormState } from "../actions";
import { assignGroup, assignMember, createTables, deleteTable, updateTable } from "./actions";

export type TableOption = { id: string; name: string; free: number };

const freeLabel = (free: number) => (free > 0 ? `${free} libres` : free === 0 ? "llena" : `${-free} de más`);

/** Cambia la mesa de UNA persona (o la quita). Se guarda al elegir. */
export function MemberSelect({ eventId, memberId, value, tables }: {
  eventId: string; memberId: string; value: string | null; tables: TableOption[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <select
        className="adm-select seat-select"
        aria-label="Mesa"
        value={value ?? ""}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value || null;
          start(async () => {
            const res = await assignMember(memberId, eventId, next);
            setError(res.error ?? null);
          });
        }}
      >
        <option value="">Sin mesa</option>
        {tables.map((t) => <option key={t.id} value={t.id}>{t.name} · {freeLabel(t.free)}</option>)}
      </select>
      {error && <small className="adm-err" role="alert">{error}</small>}
    </>
  );
}

/** Sienta de una vez a toda la familia (a quienes aún no tienen mesa). */
export function GroupSelect({ eventId, guestId, tables }: { eventId: string; guestId: string; tables: TableOption[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <select
        className="adm-select seat-select seat-group"
        aria-label="Sentar a toda la familia en…"
        value=""
        disabled={pending}
        onChange={(e) => {
          const to = e.target.value;
          if (!to) return;
          start(async () => {
            const res = await assignGroup(guestId, eventId, to);
            setError(res.error ?? null);
          });
        }}
      >
        <option value="">Sentar a todos en…</option>
        {tables.map((t) => <option key={t.id} value={t.id}>{t.name} · {freeLabel(t.free)}</option>)}
      </select>
      {error && <small className="adm-err" role="alert">{error}</small>}
    </>
  );
}

export function CreateTablesForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createTables, {});
  return (
    <form action={action} className="adm-card">
      <h2>Agregar mesas</h2>
      <input type="hidden" name="eventId" value={eventId} />
      <div className="adm-grid">
        <label>Cantidad
          <input name="count" type="number" min={1} max={40} defaultValue={1} required />
        </label>
        <label>Lugares por mesa
          <input name="capacity" type="number" min={1} max={50} defaultValue={10} required />
        </label>
        <label>Nombre (opcional)
          <input name="prefix" maxLength={30} placeholder="Mesa" />
        </label>
      </div>
      <small className="adm-hint">Se numeran solas: Mesa 1, Mesa 2… Puedes renombrarlas después (por ejemplo “Familia Pérez”).</small>
      {state.error && <p className="adm-err" role="alert">{state.error}</p>}
      {state.ok && <p className="adm-ok" role="status">{state.ok}</p>}
      <button className="adm-btn" disabled={pending}>{pending ? "Creando…" : "Agregar"}</button>
    </form>
  );
}

export function TableTools({ eventId, table }: { eventId: string; table: { id: string; name: string; capacity: number } }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return <button type="button" className="adm-link" onClick={() => setOpen(true)}>Editar mesa</button>;
  }
  return (
    <form
      className="adm-edit"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        start(async () => {
          const res = await updateTable({}, data);
          if (res.error) setError(res.error);
          else { setError(null); setOpen(false); }
        });
      }}
    >
      <input type="hidden" name="id" value={table.id} />
      <input type="hidden" name="eventId" value={eventId} />
      <label>Nombre<input name="name" defaultValue={table.name} required maxLength={40} /></label>
      <label>Lugares<input name="capacity" type="number" min={1} max={50} defaultValue={table.capacity} required /></label>
      {error && <small className="adm-err" role="alert">{error}</small>}
      <div className="adm-actions">
        <button className="adm-btn" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>
        <button type="button" className="adm-btn adm-ghost" onClick={() => setOpen(false)}>Cancelar</button>
        <button
          type="button"
          className="adm-link adm-danger"
          disabled={pending}
          onClick={() => {
            if (confirm(`¿Eliminar "${table.name}"? Sus invitados quedarán sin mesa.`)) start(() => deleteTable(table.id, eventId));
          }}
        >
          Eliminar mesa
        </button>
      </div>
    </form>
  );
}

export function PrintButton() {
  return <button type="button" className="adm-btn adm-ghost" onClick={() => window.print()}>Imprimir</button>;
}
