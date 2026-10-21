"use client";

import { useRef, useState, useTransition } from "react";
import { lookupGuest, submitRsvp } from "@/app/actions";
import { AddToCalendar } from "@/components/add-to-calendar";
import { DietFields } from "@/components/diet-fields";
import { dietText } from "@/lib/diet";
import type { CalendarData } from "@/lib/calendar";
import type { Guest } from "@/lib/rsvp-schema";

type Person = { id: string; name: string; attending: boolean; diet: string[]; allergies: string };

// Con una sola persona, el nombre de la invitación suele ser el suyo: se propone para ahorrar un paso.
function initialPeople(g: Guest): Person[] {
  return g.members.map((m) => ({
    id: m.id,
    name: m.name ?? (g.passes === 1 ? g.name : ""),
    attending: m.attending ?? true,
    diet: m.diet ?? [],
    allergies: m.allergies ?? "",
  }));
}

type Step = "code" | "form" | "done";

type Props = {
  slug: string;
  initialCode?: string;
  initialGuest?: Guest;
  calendar?: CalendarData | null;
  deadlineLabel?: string | null;
  closed?: boolean;
  askDiet?: boolean; // el anfitrión decide si se pregunta alimentación y alergias
};

export function Rsvp({ slug, initialCode, initialGuest, calendar, deadlineLabel, closed, askDiet }: Props) {
  const [step, setStep] = useState<Step>(initialGuest ? "form" : "code");
  const [code, setCode] = useState(initialCode ?? "");
  const [guest, setGuest] = useState<Guest | null>(initialGuest ?? null);
  const [attending, setAttending] = useState(initialGuest?.attending ?? true);
  const [people, setPeople] = useState<Person[]>(initialGuest ? initialPeople(initialGuest) : []);
  const [message, setMessage] = useState(initialGuest?.message ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const doneRef = useRef<HTMLDivElement>(null);

  function openGuest(g: Guest) {
    setGuest(g);
    setAttending(g.attending ?? true);
    setPeople(initialPeople(g));
    setMessage(g.message ?? "");
    setError(null);
    setStep("form");
  }

  function onCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const g = await lookupGuest(slug, code);
      if (g === "limitado") {
        setError("Demasiados intentos con códigos incorrectos. Espera unos minutos e intenta de nuevo.");
        return;
      }
      if (!g) {
        setError("No encontramos ese código. Revisa el mensaje de WhatsApp o escríbenos.");
        return;
      }
      openGuest(g);
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guest) return;
    setError(null);
    // "No podremos" = nadie de la invitación asiste.
    const answers = people.map((p) => ({ ...p, attending: attending && p.attending }));
    if (attending && !answers.some((p) => p.attending)) {
      setError("Marca al menos a una persona que asistirá, o elige “No podremos”.");
      return;
    }
    if (answers.some((p) => p.attending && !p.name.trim())) {
      setError("Escribe el nombre de cada persona que asistirá.");
      return;
    }
    startTransition(async () => {
      const res = await submitRsvp({ slug, code, members: answers, message });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPeople(answers);
      setGuest({
        ...guest,
        attending,
        confirmedCount: answers.filter((p) => p.attending).length,
        message,
        members: answers.map((p) => ({ id: p.id, name: p.name.trim() || null, attending: p.attending, diet: p.diet, allergies: p.allergies.trim() || null })),
      });
      setStep("done");
      setTimeout(() => doneRef.current?.focus(), 0);
    });
  }

  if (closed && step !== "done") {
    return (
      <div className="rsvp">
        <p>La confirmación de asistencia ya cerró. Si necesitas hacer un cambio, contacta a los anfitriones.</p>
      </div>
    );
  }

  if (step === "code") {
    return (
      <form className="rsvp" onSubmit={onCode} noValidate>
        <div className="field">
          <label htmlFor="codigo">Código de invitación</label>
          <input
            type="text"
            id="codigo"
            maxLength={12}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="········"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
              setError(null);
            }}
          />
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        <div className="row">
          <button className="btn" type="submit" disabled={pending || code.length < 4}>
            {pending ? "Buscando…" : "Continuar"}
          </button>
        </div>
      </form>
    );
  }

  if (step === "form" && guest) {
    return (
      <form className="rsvp" onSubmit={onSubmit} noValidate>
        <div>
          <p className="guest">Hola, {guest.name}</p>
          <p className="pases">
            Su invitación es para <b>{guest.passes} {guest.passes === 1 ? "persona" : "personas"}</b>
          </p>
        </div>
        <fieldset>
          <legend>¿Nos acompañan?</legend>
          <div className="choice">
            <button type="button" aria-pressed={attending} onClick={() => setAttending(true)}>
              Sí, ahí estaremos
            </button>
            <button type="button" aria-pressed={!attending} onClick={() => setAttending(false)}>
              No podremos
            </button>
          </div>
        </fieldset>
        {attending && (
          <fieldset className="people">
            <legend>¿Quiénes asistirán?</legend>
            {people.map((p, i) => (
              <div className="person-wrap" key={p.id}>
                <div className="person">
                  <label className="person-check">
                    <input
                      type="checkbox"
                      checked={p.attending}
                      onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, attending: e.target.checked } : x)))}
                    />
                    <span className="sr-only">Asiste: {p.name || `persona ${i + 1}`}</span>
                  </label>
                  <input
                    type="text"
                    className="person-name"
                    aria-label={`Nombre de la persona ${i + 1}`}
                    placeholder={`Nombre de la persona ${i + 1}`}
                    maxLength={80}
                    value={p.name}
                    onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  />
                </div>
                {askDiet && p.attending && (
                  <details className="person-diet">
                    <summary>
                      Alimentación y alergias
                      {dietText(p.diet, p.allergies) && <em> · {dietText(p.diet, p.allergies)}</em>}
                    </summary>
                    <DietFields
                      value={{ diet: p.diet, allergies: p.allergies }}
                      onChange={(v) => setPeople(people.map((x, j) => (j === i ? { ...x, ...v } : x)))}
                    />
                  </details>
                )}
              </div>
            ))}
            <small className="people-hint">Desmarca a quien no pueda asistir.{askDiet ? " La información de alimentación y alergias solo se usa para planear el menú del evento." : ""}</small>
          </fieldset>
        )}
        <div className="field">
          <label htmlFor="mensaje">Mensaje para los novios (opcional)</label>
          <textarea id="mensaje" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        <div className="row">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Enviando…" : "Confirmar asistencia"}
          </button>
          <button className="btn ghost" type="button" onClick={() => { setStep("code"); setGuest(null); setCode(""); }}>
            Otro código
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="rsvp" ref={doneRef} tabIndex={-1}>
      {attending ? (
        <>
          <p className="guest">¡Gracias, {guest?.name}!</p>
          <p>
            Confirmaron {people.filter((p) => p.attending).length} de {guest?.passes} lugares
            {people.some((p) => p.attending) ? `: ${people.filter((p) => p.attending).map((p) => p.name.trim()).join(", ")}` : ""}.
            {" "}Nos hace muy felices celebrar con ustedes.
          </p>
        </>
      ) : (
        <>
          <p className="guest">Los vamos a extrañar</p>
          <p>Gracias por avisarnos, {guest?.name}. Si sus planes cambian, pueden actualizar su respuesta{deadlineLabel ? ` antes del ${deadlineLabel}` : ""}.</p>
        </>
      )}
      <div className="row">
        {attending && calendar && <AddToCalendar cal={calendar} slug={slug} />}
        {!closed && (
          <button className="btn ghost" type="button" onClick={() => guest && openGuest(guest)}>
            Cambiar respuesta
          </button>
        )}
      </div>
    </div>
  );
}
