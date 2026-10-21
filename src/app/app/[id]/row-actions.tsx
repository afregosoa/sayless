"use client";

import { useState, useTransition } from "react";
import { DietFields, type DietValue } from "@/components/diet-fields";
import { dietText } from "@/lib/diet";
import { deleteGuest, updateGuest } from "./actions";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="adm-link"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt("Copia el link:", url);
        }
      }}
    >
      {copied ? "¡Copiado!" : "Copiar link"}
    </button>
  );
}

export function DeleteButton({ id, eventId, name }: { id: string; eventId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="adm-link adm-danger"
      disabled={pending}
      onClick={() => {
        if (confirm(`¿Eliminar a "${name}"? Esto borra también su respuesta.`)) start(() => deleteGuest(id, eventId));
      }}
    >
      Eliminar
    </button>
  );
}

export type EditableMember = { id: string; name: string | null; attending: boolean | null; diet: string[]; allergies: string | null };

// Alimentación de una persona dentro del formulario de edición: se envía en campos ocultos.
function MemberDiet({ member }: { member: EditableMember }) {
  const [value, setValue] = useState<DietValue>({ diet: member.diet, allergies: member.allergies ?? "" });
  const summary = dietText(value.diet, value.allergies);
  return (
    <details className="adm-diet">
      <summary>Alimentación y alergias{summary && <em> · {summary}</em>}</summary>
      <input type="hidden" name={`m_${member.id}_diet`} value={value.diet.join(",")} />
      <input type="hidden" name={`m_${member.id}_allergies`} value={value.allergies} />
      <DietFields value={value} onChange={setValue} />
    </details>
  );
}

export function EditGuest({ eventId, guest, members, askDiet }: {
  eventId: string;
  guest: { id: string; name: string; passes: number; phone: string | null };
  members: EditableMember[];
  askDiet: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateGuest({}, data);
      if (res.error) setError(res.error);
      else { setError(null); setOpen(false); }
    });
  }

  if (!open) {
    return <button type="button" className="adm-link" onClick={() => setOpen(true)}>Editar</button>;
  }
  return (
    <form onSubmit={onSubmit} className="adm-edit">
      <input type="hidden" name="id" value={guest.id} />
      <input type="hidden" name="eventId" value={eventId} />
      <label>Nombre<input name="name" defaultValue={guest.name} required maxLength={100} /></label>
      <label>Pases<input name="passes" type="number" min={1} max={10} defaultValue={guest.passes} required /></label>
      <label>Teléfono<input name="phone" defaultValue={guest.phone ?? ""} maxLength={30} /></label>
      <fieldset className="adm-people">
        <legend>Personas</legend>
        {members.map((m, i) => (
          <div className="adm-person-wrap" key={m.id}>
            <div className="adm-person">
              <input name={`m_${m.id}_name`} defaultValue={m.name ?? ""} maxLength={80} placeholder={`Persona ${i + 1} (sin nombre)`} aria-label={`Nombre de la persona ${i + 1}`} />
              <select name={`m_${m.id}_att`} defaultValue={m.attending === true ? "1" : m.attending === false ? "0" : ""} aria-label={`Asistencia de la persona ${i + 1}`}>
                <option value="">Sin respuesta</option>
                <option value="1">Asiste</option>
                <option value="0">No asiste</option>
              </select>
            </div>
            {askDiet && <MemberDiet member={m} />}
          </div>
        ))}
        <small className="adm-hint">Si cambias los pases, se agregan o quitan personas al guardar. Vuelve a abrir “Editar” para verlas.</small>
      </fieldset>
      {error && <small className="adm-err" role="alert">{error}</small>}
      <div className="adm-actions">
        <button className="adm-btn" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>
        <button type="button" className="adm-btn adm-ghost" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </form>
  );
}
