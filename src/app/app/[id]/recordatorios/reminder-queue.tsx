"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DEFAULT_TEMPLATES, fillTemplate, inSegment, phoneLooksIncomplete, SEGMENT_LABELS, SEGMENTS, segmentKind, TEMPLATE_VARS,
  waDigits, waLink, type QueueGuest, type Segment,
} from "@/lib/reminders";
import { timeAgo } from "@/lib/time-ago";
import { logContact } from "./actions";

const DAY = 86_400_000;
const RECENT_DAYS = 3;

// Cola de recordatorios: se abre el chat de WhatsApp de cada invitado con su mensaje y, cuando el anfitrión confirma que lo
// envió, se registra y se pasa al siguiente. Nada se envía automáticamente.
export function ReminderQueue({ eventId, slug, base, eventTitle, deadlineLabel, guests, nowMs }: {
  eventId: string; slug: string; base: string; eventTitle: string; deadlineLabel: string | null; guests: QueueGuest[]; nowMs: number;
}) {
  const counts = useMemo(
    () => Object.fromEntries(SEGMENTS.map((s) => [s, guests.filter((g) => inSegment(g, s)).length])) as Record<Segment, number>,
    [guests],
  );
  const firstSegment: Segment = (["vieron", "por_invitar", "sin_abrir", "pendientes"] as const).find((s) => counts[s] > 0) ?? "pendientes";

  const [segment, setSegment] = useState<Segment>(firstSegment);
  const [hideRecent, setHideRecent] = useState(true);
  const [templates, setTemplates] = useState<Record<Segment, string>>(DEFAULT_TEMPLATES);
  const [editing, setEditing] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());     // avisados en esta sesión
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [pickId, setPickId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<string | null>(null);   // se abrió su chat y falta confirmar el envío
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Los mensajes editados se recuerdan en este navegador (comodidad personal, no se comparten).
  const storageKey = `sayless-reminder-templates:${eventId}`;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (saved && typeof saved === "object") setTemplates({ ...DEFAULT_TEMPLATES, ...saved });
    } catch { /* sin almacenamiento: se usan los mensajes de siempre */ }
  }, [storageKey]);
  const saveTemplate = (s: Segment, text: string) => {
    const next = { ...templates, [s]: text };
    setTemplates(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignorar */ }
  };

  const inList = guests.filter((g) => inSegment(g, segment));
  const noPhone = inList.filter((g) => !waDigits(g.phone));
  const recent = (g: QueueGuest) => segment !== "por_invitar" && !!g.lastContactAt && nowMs - Date.parse(g.lastContactAt) < RECENT_DAYS * DAY;
  const queue = inList.filter((g) => waDigits(g.phone) && !done.has(g.id) && !(hideRecent && recent(g)));
  const hiddenRecent = inList.filter((g) => waDigits(g.phone) && !done.has(g.id) && recent(g)).length;
  const sessionDone = inList.filter((g) => done.has(g.id)).length;

  const open = queue.filter((g) => !skipped.has(g.id));
  const current = queue.find((g) => g.id === pickId) ?? open[0] ?? null;
  const rest = queue.filter((g) => g.id !== current?.id);

  const messageFor = (g: QueueGuest) =>
    fillTemplate(templates[segment], { nombre: g.name, evento: eventTitle, enlace: `${base}/${slug}/${g.code}`, limite: deadlineLabel });

  function openChat(g: QueueGuest) {
    setError(null);
    window.open(waLink(g.phone!, messageFor(g)), "_blank", "noopener");
    setWaiting(g.id);
  }
  function confirmSent(g: QueueGuest) {
    setError(null);
    start(async () => {
      const res = await logContact({ eventId, guestId: g.id, kind: segmentKind(segment) });
      if (!res.ok) return setError(res.error);
      setDone((d) => new Set(d).add(g.id));
      setWaiting(null);
      setPickId(null);
    });
  }
  function skip(g: QueueGuest) {
    setSkipped((s) => new Set(s).add(g.id));
    setWaiting(null);
    setPickId(null);
  }
  const changeSegment = (s: Segment) => { setSegment(s); setWaiting(null); setPickId(null); setSkipped(new Set()); setEditing(false); };

  const status = (g: QueueGuest) =>
    g.openCount > 0 ? `Vio su invitación ${timeAgo(g.lastOpenedAt, nowMs)}${g.openCount > 1 ? ` · ${g.openCount} veces` : ""}` : "Aún no abre su invitación";
  const lastNotice = (g: QueueGuest) => (g.lastContactAt ? `Último aviso ${timeAgo(g.lastContactAt, nowMs)}` : "Sin avisos previos");

  const total = sessionDone + queue.length;

  return (
    <>
      <div className="adm-card rq-controls">
        <label>¿A quién?
          <select className="adm-select" value={segment} onChange={(e) => changeSegment(e.target.value as Segment)}>
            {SEGMENTS.map((s) => <option key={s} value={s}>{SEGMENT_LABELS[s]} ({counts[s]})</option>)}
          </select>
        </label>
        {segment !== "por_invitar" && (
          <label className="adm-check">
            <input type="checkbox" checked={hideRecent} onChange={(e) => setHideRecent(e.target.checked)} />
            Ocultar a quienes ya avisé en los últimos {RECENT_DAYS} días{hiddenRecent > 0 ? ` (${hiddenRecent})` : ""}
          </label>
        )}
      </div>

      <div className="adm-card rq-message">
        <div className="rq-message-head">
          <h2>Mensaje</h2>
          <button type="button" className="adm-link" onClick={() => setEditing((v) => !v)}>{editing ? "Listo" : "Editar mensaje"}</button>
        </div>
        {editing ? (
          <>
            <textarea rows={3} maxLength={600} value={templates[segment]} onChange={(e) => saveTemplate(segment, e.target.value)} aria-label="Texto del mensaje" />
            <small className="adm-hint">Puedes usar: {TEMPLATE_VARS.join(" ")}. Se rellenan solos con los datos de cada invitado.</small>
            <button type="button" className="adm-link" onClick={() => saveTemplate(segment, DEFAULT_TEMPLATES[segment])}>Restablecer el mensaje original</button>
          </>
        ) : (
          <p className="rq-preview">{current ? messageFor(current) : templates[segment]}</p>
        )}
      </div>

      {total > 0 && (
        <div className="rq-progress" role="status">
          <div className="rq-bar" aria-hidden="true"><i style={{ width: `${(sessionDone / total) * 100}%` }} /></div>
          <span>{sessionDone} de {total} avisados en esta sesión</span>
        </div>
      )}
      {error && <p className="adm-err" role="alert">{error}</p>}

      {current ? (
        <div className="adm-card rq-current" aria-live="polite">
          <p className="adm-hint">Siguiente</p>
          <h2>{current.name}</h2>
          <p className="rq-meta">{status(current)} · {lastNotice(current)}</p>
          <p className="rq-meta">{current.phone}</p>
          {phoneLooksIncomplete(current.phone) && (
            <p className="adm-err">Este teléfono parece no incluir la lada del país (en México, +52). WhatsApp podría no encontrarlo.</p>
          )}

          {waiting === current.id ? (
            <div className="rq-confirm">
              <p><b>Se abrió WhatsApp</b> con el chat de {current.name}. Envía el mensaje allí y regresa a esta pantalla.</p>
              <div className="adm-actions">
                <button type="button" className="adm-btn" disabled={pending} onClick={() => confirmSent(current)}>
                  {pending ? "Guardando…" : "Sí, ya lo envié ✓"}
                </button>
                <button type="button" className="adm-btn adm-ghost" onClick={() => openChat(current)}>Abrir de nuevo</button>
                <button type="button" className="adm-link" onClick={() => skip(current)}>No lo envié, saltar</button>
              </div>
            </div>
          ) : (
            <div className="adm-actions">
              <button type="button" className="adm-btn" onClick={() => openChat(current)}>Abrir WhatsApp</button>
              <button type="button" className="adm-link" onClick={() => skip(current)}>Saltar</button>
            </div>
          )}
        </div>
      ) : (
        <div className="adm-card">
          <h2>{total > 0 ? "¡Listo! Terminaste esta lista" : "No hay nadie en esta lista"}</h2>
          <p className="adm-hint">
            {total > 0
              ? `Avisaste a ${sessionDone} ${sessionDone === 1 ? "persona" : "personas"} en esta sesión.`
              : hiddenRecent > 0 ? `Hay ${hiddenRecent} a quienes ya avisaste hace poco; desmarca “Ocultar” para verlos.` : "Cambia de lista arriba para ver a otros invitados."}
          </p>
        </div>
      )}

      {rest.length > 0 && (
        <div className="adm-card">
          <h2>En la cola <small>({rest.length})</small></h2>
          <ul className="adm-plain rq-list">
            {rest.map((g) => (
              <li key={g.id} data-skipped={skipped.has(g.id) || undefined}>
                <div>
                  <b>{g.name}</b>
                  <small>{status(g)} · {lastNotice(g)}</small>
                </div>
                <button type="button" className="adm-link" onClick={() => { setSkipped((s) => { const n = new Set(s); n.delete(g.id); return n; }); setPickId(g.id); setWaiting(null); }}>
                  Enviar a este
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {noPhone.length > 0 && (
        <div className="adm-card">
          <h2>Sin teléfono <small>({noPhone.length})</small></h2>
          <p className="adm-hint">No se les puede escribir por WhatsApp. Agrega su teléfono con “Editar” en la lista de invitados.</p>
          <ul className="adm-plain rq-list">
            {noPhone.map((g) => <li key={g.id}><div><b>{g.name}</b><small>{status(g)}</small></div></li>)}
          </ul>
        </div>
      )}
    </>
  );
}
