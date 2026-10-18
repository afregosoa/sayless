"use client";

import { useRef, useState, useTransition } from "react";
import { lookupGuest, submitRsvp } from "@/app/actions";
import type { Guest } from "@/lib/rsvp-schema";

type Step = "code" | "form" | "done";

type Props = {
  slug: string;
  initialCode?: string;
  initialGuest?: Guest;
  calendarUrl?: string | null;
  deadlineLabel?: string | null;
  closed?: boolean;
};

export function Rsvp({ slug, initialCode, initialGuest, calendarUrl, deadlineLabel, closed }: Props) {
  const [step, setStep] = useState<Step>(initialGuest ? "form" : "code");
  const [code, setCode] = useState(initialCode ?? "");
  const [guest, setGuest] = useState<Guest | null>(initialGuest ?? null);
  const [attending, setAttending] = useState(initialGuest?.attending ?? true);
  const [count, setCount] = useState(initialGuest?.confirmedCount || initialGuest?.passes || 1);
  const [message, setMessage] = useState(initialGuest?.message ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const doneRef = useRef<HTMLDivElement>(null);

  function openGuest(g: Guest) {
    setGuest(g);
    setAttending(g.attending ?? true);
    setCount(g.confirmedCount || g.passes);
    setMessage(g.message ?? "");
    setError(null);
    setStep("form");
  }

  function onCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const g = await lookupGuest(slug, code);
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
    startTransition(async () => {
      const res = await submitRsvp({
        slug,
        code,
        attending,
        confirmedCount: attending ? count : 0,
        message,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGuest({ ...guest, attending, confirmedCount: attending ? count : 0, message });
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
            maxLength={8}
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
          <div className="field">
            <span id="n-label" style={{ fontSize: 14, fontWeight: 400 }}>¿Cuántos asistirán?</span>
            <div className="stepper" role="group" aria-labelledby="n-label">
              <button type="button" aria-label="Quitar una persona" disabled={count <= 1} onClick={() => setCount(count - 1)}>−</button>
              <output aria-live="polite">{count} <small>de {guest.passes}</small></output>
              <button type="button" aria-label="Agregar una persona" disabled={count >= guest.passes} onClick={() => setCount(count + 1)}>+</button>
            </div>
          </div>
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
          <p>Confirmaron {count} de {guest?.passes} lugares. Nos hace muy felices celebrar con ustedes.</p>
        </>
      ) : (
        <>
          <p className="guest">Los vamos a extrañar</p>
          <p>Gracias por avisarnos, {guest?.name}. Si sus planes cambian, pueden actualizar su respuesta{deadlineLabel ? ` antes del ${deadlineLabel}` : ""}.</p>
        </>
      )}
      <div className="row">
        {attending && calendarUrl && (
          <a className="btn ghost" target="_blank" rel="noopener" href={calendarUrl}>Agregar al calendario</a>
        )}
        {!closed && (
          <button className="btn ghost" type="button" onClick={() => guest && openGuest(guest)}>
            Cambiar respuesta
          </button>
        )}
      </div>
    </div>
  );
}
