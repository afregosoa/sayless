"use client";

import { useActionState, useEffect, useRef } from "react";
import { addGuest, importGuests, type FormState } from "./actions";

function Status({ state }: { state: FormState }) {
  if (state.error) return <p className="adm-err" role="alert">{state.error}</p>;
  if (state.ok) return <p className="adm-ok" role="status">{state.ok}</p>;
  return null;
}

export function AddGuestForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addGuest, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);

  return (
    <form ref={ref} action={action} className="adm-card">
      <h2>Agregar invitado</h2>
      <input type="hidden" name="eventId" value={eventId} />
      <div className="adm-grid">
        <label>Nombre de la invitación<input name="name" required maxLength={100} placeholder="Familia Pérez" /></label>
        <label>Pases<input name="passes" type="number" min={1} max={10} defaultValue={1} required /></label>
        <label>Teléfono (opcional)<input name="phone" inputMode="tel" maxLength={30} placeholder="+52 312 123 4567" /></label>
      </div>
      <label>Nombres de las personas (opcional)
        <textarea name="names" rows={2} maxLength={800} placeholder="Ana, Luis, Sofía, Mateo" />
        <small className="adm-hint">Separados por coma. Los que no escribas, los completa cada invitado al confirmar.</small>
      </label>
      <Status state={state} />
      <button className="adm-btn" disabled={pending}>{pending ? "Guardando…" : "Agregar"}</button>
    </form>
  );
}

export function ImportForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(importGuests, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);

  const textRef = useRef<HTMLTextAreaElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && textRef.current) textRef.current.value = await file.text();
  }

  return (
    <form ref={ref} action={action} className="adm-card">
      <h2>Importar lista (CSV)</h2>
      <input type="hidden" name="eventId" value={eventId} />
      <p className="adm-hint">Una fila por invitado: <code>nombre, pases, teléfono</code>. El teléfono es opcional y el encabezado se omite solo.</p>
      <input type="file" accept=".csv,text/csv,text/plain" onChange={onFile} />
      <textarea ref={textRef} name="csv" rows={5} placeholder={"Familia Pérez, 4, +523121234567\nAna y Luis, 2"} required />
      <Status state={state} />
      <button className="adm-btn" disabled={pending}>{pending ? "Importando…" : "Importar"}</button>
    </form>
  );
}
