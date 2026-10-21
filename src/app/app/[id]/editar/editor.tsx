"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { MAX_AUDIO_BYTES, MAX_AUDIO_MB } from "@/lib/audio-limits";
import { compressMp3, CompressError } from "@/lib/client-audio";
import { audioUrl, MAX_GALLERY, mediaUrl, type EventContent, type EventTheme } from "@/lib/event-content";
import { DEFAULT_THEME } from "@/lib/event-starter";
import { prepareImage } from "@/lib/client-image";
import { saveEvent } from "./actions";
import { uploadEventAudio } from "./audio-actions";
import { uploadEventImage } from "./media-actions";

type State = {
  title: string;
  eventDate: string | null;
  rsvpDeadline: string | null;
  content: EventContent;
  theme: EventTheme;
};

type Toggleable = "welcome" | "gallery" | "countdown" | "venues" | "schedule" | "dress_code" | "gifts" | "lodging" | "faq" | "music";

const BLANK = {
  welcome: { enabled: true, eyebrow: "", heading: "", heading_script: "", body: "", quote: "" },
  gallery: { enabled: true, items: [] },
  countdown: { enabled: true, date_label: "" },
  venues: { enabled: true, eyebrow: "", items: [] },
  schedule: { enabled: true, items: [] },
  dress_code: { enabled: true, body: "", quote: "" },
  gifts: { enabled: true, body: "", button_label: "Ver mesa de regalos" },
  lodging: { enabled: true, items: [] },
  faq: { enabled: true, items: [] },
  music: { enabled: true, title: "", button_label: "", cover: true, rights_accepted: false },
} satisfies Pick<Required<EventContent>, Toggleable>;

const COLOR_LABELS: [keyof NonNullable<EventTheme["light"]>, string][] = [
  ["paper", "Fondo"], ["ink", "Texto"], ["muted", "Texto suave"],
  ["accent", "Acento"], ["line", "Líneas"], ["card", "Tarjetas"],
];

// ── Campos básicos ──
function Text({ label, value, onChange, max, rows, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; max?: number; rows?: number;
  placeholder?: string; type?: string;
}) {
  return (
    <label>
      {label}
      {rows ? (
        <textarea rows={rows} maxLength={max} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type} maxLength={max} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function Panel({ title, enabled, onToggle, children }: {
  title: string; enabled?: boolean; onToggle?: (on: boolean) => void; children?: React.ReactNode;
}) {
  const open = onToggle ? !!enabled : true;
  return (
    <fieldset className="adm-card ed-panel">
      <legend>
        {onToggle ? (
          <label className="ed-toggle">
            <input type="checkbox" checked={!!enabled} onChange={(e) => onToggle(e.target.checked)} />
            {title}
          </label>
        ) : title}
      </legend>
      {open ? children : <p className="adm-hint">Sección oculta en tu invitación.</p>}
    </fieldset>
  );
}

function List<T>({ items, onChange, blank, max, addLabel, render }: {
  items: T[]; onChange: (items: T[]) => void; blank: T; max: number; addLabel: string;
  render: (item: T, patch: (p: Partial<T>) => void, index: number) => React.ReactNode;
}) {
  const move = (i: number, d: number) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="ed-list">
      {items.map((item, i) => (
        <div className="ed-item" key={i}>
          <div className="ed-item-fields">
            {render(item, (p) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x))), i)}
          </div>
          <div className="ed-item-tools">
            <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" aria-label="Bajar" disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button type="button" aria-label="Quitar" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
          </div>
        </div>
      ))}
      {items.length < max && (
        <button type="button" className="adm-btn adm-ghost" onClick={() => onChange([...items, { ...blank }])}>
          + {addLabel}
        </button>
      )}
    </div>
  );
}

// ── Subida de fotos ──
function usePhotoUpload(eventId: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File): Promise<string | null> {
    setBusy(true);
    setError(null);
    const data = new FormData();
    data.append("file", await prepareImage(file));
    const res = await uploadEventImage(eventId, data);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return null;
    }
    return res.path;
  }
  return { upload, busy, error };
}

function Thumb({ path, alt }: { path: string; alt: string }) {
  return <Image src={mediaUrl(path)} alt={alt} width={96} height={120} className="ed-thumb" unoptimized />;
}

function PhotoField({ eventId, path, onChange }: {
  eventId: string; path?: string; onChange: (path?: string) => void;
}) {
  const { upload, busy, error } = usePhotoUpload(eventId);
  return (
    <div className="ed-photo">
      {path ? <Thumb path={path} alt="Foto de portada" /> : <div className="ed-thumb ed-thumb-empty">Sin foto</div>}
      <div className="ed-photo-actions">
        <label className="adm-btn adm-ghost ed-file">
          {busy ? "Subiendo…" : path ? "Cambiar foto" : "Subir foto"}
          <input type="file" accept="image/*" hidden disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const uploaded = await upload(file);
              if (uploaded) onChange(uploaded);
            }} />
        </label>
        {path && <button type="button" className="adm-link adm-danger" onClick={() => onChange(undefined)}>Quitar</button>}
        <small className="adm-hint">JPG, PNG o WebP. Se optimiza automáticamente.</small>
        {error && <small className="adm-err" role="alert">{error}</small>}
      </div>
    </div>
  );
}

function GalleryField({ eventId, items, onChange }: {
  eventId: string; items: { path: string; alt: string }[]; onChange: (items: { path: string; alt: string }[]) => void;
}) {
  const { upload, busy, error } = usePhotoUpload(eventId);
  const move = (i: number, d: number) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  async function addFiles(files: File[]) {
    let current = items;
    for (const file of files.slice(0, MAX_GALLERY - items.length)) {
      const path = await upload(file);
      if (!path) break;
      current = [...current, { path, alt: "" }];
      onChange(current);
    }
  }

  return (
    <div className="ed-list">
      <div className="ed-gallery">
        {items.map((it, i) => (
          <div className="ed-gitem" key={it.path}>
            <Thumb path={it.path} alt={it.alt} />
            <input aria-label="Descripción de la foto" placeholder="Descripción (opcional)" maxLength={160} value={it.alt}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} />
            <div className="ed-item-tools ed-item-tools-row">
              <button type="button" aria-label="Mover antes" disabled={i === 0} onClick={() => move(i, -1)}>←</button>
              <button type="button" aria-label="Mover después" disabled={i === items.length - 1} onClick={() => move(i, 1)}>→</button>
              <button type="button" aria-label="Quitar" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
            </div>
          </div>
        ))}
      </div>
      {items.length < MAX_GALLERY && (
        <label className="adm-btn adm-ghost ed-file">
          {busy ? "Subiendo…" : `+ Agregar fotos (${items.length}/${MAX_GALLERY})`}
          <input type="file" accept="image/*" multiple hidden disabled={busy}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              void addFiles(files);
            }} />
        </label>
      )}
      {error && <small className="adm-err" role="alert">{error}</small>}
    </div>
  );
}

// mm:ss <-> segundos. Acepta "1:23", "83" o "1:23.5".
function fmtTime(sec?: number) {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round((sec % 60) * 10) / 10;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}
function parseTime(text: string): number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const parts = t.split(":");
  if (parts.length > 2 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return undefined;
  const n = parts.length === 2 ? Number(parts[0]) * 60 + Number(parts[1]) : Number(parts[0]);
  return Number.isFinite(n) ? Math.min(n, 3600) : undefined;
}

function TimeField({ label, value, onCommit, onUseCurrent, placeholder }: {
  label: string; value?: number; onCommit: (v?: number) => void; onUseCurrent: () => void; placeholder: string;
}) {
  const [text, setText] = useState(fmtTime(value));
  useEffect(() => setText(fmtTime(value)), [value]);
  return (
    <div className="ed-time">
      <label>{label}
        <input value={text} placeholder={placeholder} inputMode="decimal" maxLength={8}
          onChange={(e) => setText(e.target.value)} onBlur={() => onCommit(parseTime(text))} />
      </label>
      <button type="button" className="adm-link" onClick={onUseCurrent}>Usar el punto actual del reproductor</button>
    </div>
  );
}

// ── Música (MP3 propio del cliente, con declaración de derechos) ──
type Music = NonNullable<EventContent["music"]>;

function MusicField({ eventId, music, onChange }: {
  eventId: string; music: Music; onChange: (patch: Partial<Music>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const player = useRef<HTMLAudioElement>(null);

  async function upload(original: File) {
    setError(null);
    setBusy(true);
    try {
      // Si pasa del límite de la petición, se comprime aquí antes de subir (el servidor la rechazaría con
      // una excepción y la pantalla se quedaría en "Subiendo…").
      let file = original;
      if (file.size > MAX_AUDIO_BYTES) {
        setStatus("Comprimiendo…");
        try {
          file = await compressMp3(file, MAX_AUDIO_BYTES, (f, phase) =>
            setStatus(phase === "decode" ? "Leyendo audio…" : `Comprimiendo… ${Math.round(f * 100)} %`));
        } catch (e) {
          return setError(e instanceof CompressError ? e.message : "No pudimos comprimir ese archivo. Prueba con otro MP3.");
        }
      }
      setStatus("Subiendo…");
      const data = new FormData();
      data.append("file", file);
      const res = await uploadEventAudio(eventId, data);
      if (!res.ok) return setError(res.error);
      onChange({ path: res.path, start: undefined, end: undefined, title: music.title || original.name.replace(/\.mp3$/i, "").slice(0, 120) });
    } catch {
      setError("No se pudo subir la música. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <div className="ed-list">
      <label className="ed-check">
        <input type="checkbox" checked={music.rights_accepted} onChange={(e) => onChange({ rights_accepted: e.target.checked })} />
        <span>
          Declaro que soy titular de los derechos de esta música o cuento con autorización para usarla en mi invitación,
          y acepto los <Link href="/terminos" target="_blank" className="adm-link">Términos de uso</Link>. Entiendo que SayLess
          puede retirarla si recibe una reclamación.
        </span>
      </label>

      {music.path && (
        <>
          <audio
            ref={player} controls preload="metadata" src={audioUrl(music.path)} className="ed-audio"
            onTimeUpdate={(e) => { // al probar, se detiene en el final elegido
              if (music.end != null && e.currentTarget.currentTime >= music.end) e.currentTarget.pause();
            }}
          />
          <div className="adm-grid">
            <TimeField label="Empieza en (mm:ss)" placeholder="0:00" value={music.start}
              onCommit={(start) => onChange({ start })}
              onUseCurrent={() => onChange({ start: Math.round((player.current?.currentTime ?? 0) * 10) / 10 })} />
            <TimeField label="Termina en (opcional)" placeholder="hasta el final" value={music.end}
              onCommit={(end) => onChange({ end })}
              onUseCurrent={() => onChange({ end: Math.round((player.current?.currentTime ?? 0) * 10) / 10 })} />
          </div>
          <button type="button" className="adm-btn adm-ghost" style={{ alignSelf: "flex-start" }}
            onClick={() => { const el = player.current; if (el) { el.currentTime = music.start ?? 0; void el.play(); } }}>
            ▶ Probar desde el inicio elegido
          </button>
          <small className="adm-hint">
            Mueve el reproductor al momento que quieras, pulsa “Usar el punto actual” y se guarda ese segundo.
            La canción se repite entre el inicio y el final elegidos.
          </small>
          <div className="adm-grid">
            <Text label="Nombre de la canción" max={120} value={music.title} onChange={(title) => onChange({ title })} />
            <Text label="Texto del botón en la portada" max={40} value={music.button_label ?? ""} placeholder="Reproduce nuestra canción"
              onChange={(button_label) => onChange({ button_label })} />
          </div>
          <label className="ed-check">
            <input type="checkbox" checked={music.cover} onChange={(e) => onChange({ cover: e.target.checked })} />
            <span>Mostrar pantalla de apertura “Toca para abrir” (recomendado: los celulares solo reproducen audio después de un toque)</span>
          </label>
        </>
      )}

      <div className="ed-photo-actions">
        <label className={`adm-btn adm-ghost ed-file${music.rights_accepted ? "" : " ed-disabled"}`}>
          {busy ? (status || "Subiendo…") : music.path ? "Cambiar canción" : "Subir MP3"}
          <input type="file" accept="audio/mpeg,.mp3" hidden disabled={busy || !music.rights_accepted}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) await upload(file);
            }} />
        </label>
        {music.path && (
          <button type="button" className="adm-link adm-danger"
            onClick={() => onChange({ path: undefined, title: "", rights_accepted: false })}>
            Quitar música
          </button>
        )}
        <small className="adm-hint">
          {music.rights_accepted ? `Si el MP3 pesa más de ${MAX_AUDIO_MB} MB, se comprime automáticamente al subirlo.` : "Acepta la declaración para poder subir tu canción."}
        </small>
        {error && <small className="adm-err" role="alert">{error}</small>}
      </div>
    </div>
  );
}

export function Editor({ eventId, initial, publicPath, isPublished }: {
  eventId: string; initial: State; publicPath: string; isPublished: boolean;
}) {
  const [state, setState] = useState<State>(initial);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initial));
  const [previewKey, setPreviewKey] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const json = JSON.stringify(state);
  const dirty = json !== savedJson;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const c = state.content;
  const setContent = (patch: Partial<EventContent>) =>
    setState((s) => ({ ...s, content: { ...s.content, ...patch } }));

  function section<K extends Toggleable>(key: K, patch: Partial<NonNullable<EventContent[K]>>) {
    setState((s) => ({
      ...s,
      content: { ...s.content, [key]: { ...BLANK[key], ...s.content[key], ...patch } },
    }));
  }
  const toggle = (key: Toggleable) => (on: boolean) => section(key, { enabled: on } as never);
  const sec = <K extends Toggleable>(key: K) => ({ ...BLANK[key], ...c[key] }) as (typeof BLANK)[K];

  const palette = (mode: "light" | "dark") => ({ ...DEFAULT_THEME[mode], ...state.theme[mode] });
  const setColor = (mode: "light" | "dark", key: string, value: string) =>
    setState((s) => ({ ...s, theme: { ...s.theme, [mode]: { ...palette(mode), [key]: value } } }));

  function save() {
    setMsg(null);
    // Una URL vacía no es válida para el esquema: se quita.
    const content = structuredClone(state.content);
    if (content.gifts && !content.gifts.url) delete content.gifts.url;

    start(async () => {
      const res = await saveEvent(eventId, { ...state, content });
      if (res.ok) {
        setSavedJson(json);
        setPreviewKey((k) => k + 1);
        setMsg({ ok: true, text: "Cambios guardados." });
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  const venues = sec("venues"), schedule = sec("schedule"), lodging = sec("lodging"), faq = sec("faq");
  const music = sec("music"), gallery = sec("gallery"), welcome = sec("welcome"), countdown = sec("countdown"), dress = sec("dress_code"), gifts = sec("gifts");

  return (
    <div className="ed-layout">
      <div className="ed-form">
        <div className="ed-savebar">
          <button className="adm-btn" onClick={save} disabled={pending || !dirty}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
          <span className="adm-hint">{dirty ? "Cambios sin guardar" : "Todo guardado"}</span>
          <Link href={`/app/${eventId}/vista-previa`} target="_blank" className="adm-link">Abrir vista previa ↗</Link>
          {isPublished && <Link href={publicPath} target="_blank" className="adm-link">Ver publicada ↗</Link>}
          {msg && <span className={msg.ok ? "adm-ok" : "adm-err"} role="status">{msg.text}</span>}
        </div>

        <Panel title="Datos del evento">
          <div className="adm-grid">
            <Text label="Nombre interno" value={state.title} max={120} onChange={(title) => setState((s) => ({ ...s, title }))} />
            <Text label="Fecha del evento" type="date" value={state.eventDate ?? ""} onChange={(v) => setState((s) => ({ ...s, eventDate: v || null }))} />
            <Text label="Fecha límite para confirmar" type="date" value={state.rsvpDeadline ?? ""} onChange={(v) => setState((s) => ({ ...s, rsvpDeadline: v || null }))} />
          </div>
          <p className="adm-hint">La cuenta regresiva y el botón de calendario usan la fecha del evento.</p>
        </Panel>

        <Panel title="Portada">
          <Text label="Título (usa Enter para saltar de línea)" rows={2} max={120} value={c.hero.title}
            onChange={(title) => setContent({ hero: { ...c.hero, title } })} />
          <PhotoField eventId={eventId} path={c.hero.image}
            onChange={(image) => setContent({ hero: { ...c.hero, image } })} />
          {c.hero.image && (
            <Text label="Descripción de la foto (para accesibilidad)" max={160} value={c.hero.image_alt}
              onChange={(image_alt) => setContent({ hero: { ...c.hero, image_alt } })} />
          )}
          <div className="adm-grid">
            <Text label="Fecha (texto)" max={80} value={c.hero.date_label} placeholder="27 de febrero 2027"
              onChange={(date_label) => setContent({ hero: { ...c.hero, date_label } })} />
            <Text label="Subtítulo" max={80} value={c.hero.subtitle} placeholder="Colima, México"
              onChange={(subtitle) => setContent({ hero: { ...c.hero, subtitle } })} />
          </div>
        </Panel>

        <Panel title="Bienvenida" enabled={welcome.enabled} onToggle={toggle("welcome")}>
          <div className="adm-grid">
            <Text label="Texto pequeño superior" max={80} value={welcome.eyebrow} onChange={(eyebrow) => section("welcome", { eyebrow })} />
            <Text label="Título" max={120} value={welcome.heading} onChange={(heading) => section("welcome", { heading })} />
            <Text label="Palabra destacada (cursiva)" max={60} value={welcome.heading_script} onChange={(heading_script) => section("welcome", { heading_script })} />
          </div>
          <Text label="Mensaje" rows={4} max={1200} value={welcome.body} onChange={(body) => section("welcome", { body })} />
          <Text label="Frase" rows={2} max={400} value={welcome.quote} onChange={(quote) => section("welcome", { quote })} />
        </Panel>

        <Panel title="Galería de fotos" enabled={gallery.enabled} onToggle={toggle("gallery")}>
          <GalleryField eventId={eventId} items={gallery.items} onChange={(items) => section("gallery", { items })} />
        </Panel>

        <Panel title="Música" enabled={music.enabled} onToggle={toggle("music")}>
          <MusicField eventId={eventId} music={music} onChange={(patch) => section("music", patch)} />
        </Panel>

        <Panel title="Cuenta regresiva" enabled={countdown.enabled} onToggle={toggle("countdown")}>
          <Text label="Texto bajo el contador" max={80} value={countdown.date_label} placeholder="Sábado 27 de febrero de 2027"
            onChange={(date_label) => section("countdown", { date_label })} />
        </Panel>

        <Panel title="Lugares" enabled={venues.enabled} onToggle={toggle("venues")}>
          <Text label="Texto superior (opcional)" max={80} value={venues.eyebrow} onChange={(eyebrow) => section("venues", { eyebrow })} />
          <List items={venues.items} max={6} addLabel="Agregar lugar" onChange={(items) => section("venues", { items })}
            blank={{ label: "", name: "", time: "", address: "", map_query: "" }}
            render={(v, patch) => (
              <>
                <div className="adm-grid">
                  <Text label="Etiqueta" max={80} value={v.label} placeholder="Ceremonia" onChange={(label) => patch({ label })} />
                  <Text label="Nombre del lugar" max={120} value={v.name} onChange={(name) => patch({ name })} />
                  <Text label="Hora" max={40} value={v.time} placeholder="6:00 PM" onChange={(time) => patch({ time })} />
                </div>
                <Text label="Dirección" max={200} value={v.address} onChange={(address) => patch({ address })} />
                <Text label="Búsqueda en Google Maps" max={200} value={v.map_query} placeholder="Nombre del lugar + ciudad" onChange={(map_query) => patch({ map_query })} />
              </>
            )} />
        </Panel>

        <Panel title="Itinerario" enabled={schedule.enabled} onToggle={toggle("schedule")}>
          <List items={schedule.items} max={30} addLabel="Agregar actividad" onChange={(items) => section("schedule", { items })}
            blank={{ time: "", label: "" }}
            render={(it, patch) => (
              <div className="adm-grid">
                <Text label="Hora" max={40} value={it.time} placeholder="9:00 PM" onChange={(time) => patch({ time })} />
                <Text label="Actividad" max={160} value={it.label} onChange={(label) => patch({ label })} />
              </div>
            )} />
        </Panel>

        <Panel title="Código de vestimenta" enabled={dress.enabled} onToggle={toggle("dress_code")}>
          <Text label="Indicaciones" rows={3} max={800} value={dress.body} onChange={(body) => section("dress_code", { body })} />
          <Text label="Frase" rows={2} max={400} value={dress.quote} onChange={(quote) => section("dress_code", { quote })} />
        </Panel>

        <Panel title="Mesa de regalos" enabled={gifts.enabled} onToggle={toggle("gifts")}>
          <Text label="Mensaje" rows={3} max={800} value={gifts.body} onChange={(body) => section("gifts", { body })} />
          <div className="adm-grid">
            <Text label="Texto del botón" max={60} value={gifts.button_label} onChange={(button_label) => section("gifts", { button_label })} />
            <Text label="Enlace (https://…)" type="url" max={500} value={c.gifts?.url ?? ""} onChange={(url) => section("gifts", { url })} />
          </div>
        </Panel>

        <Panel title="Hospedaje" enabled={lodging.enabled} onToggle={toggle("lodging")}>
          <List items={lodging.items} max={10} addLabel="Agregar hotel" onChange={(items) => section("lodging", { items })}
            blank={{ name: "", address: "" }}
            render={(h, patch) => (
              <div className="adm-grid">
                <Text label="Hotel" max={120} value={h.name} onChange={(name) => patch({ name })} />
                <Text label="Dirección / distancia" max={200} value={h.address} onChange={(address) => patch({ address })} />
              </div>
            )} />
        </Panel>

        <Panel title="Preguntas frecuentes" enabled={faq.enabled} onToggle={toggle("faq")}>
          <List items={faq.items} max={20} addLabel="Agregar pregunta" onChange={(items) => section("faq", { items })}
            blank={{ q: "", a: "" }}
            render={(f, patch) => (
              <>
                <Text label="Pregunta" max={200} value={f.q} onChange={(q) => patch({ q })} />
                <Text label="Respuesta" rows={2} max={1200} value={f.a} onChange={(a) => patch({ a })} />
              </>
            )} />
        </Panel>

        <Panel title="Confirmación de asistencia">
          <label className="adm-check">
            <input type="checkbox" checked={!!c.rsvp?.ask_diet} onChange={(e) => setContent({ rsvp: { ask_diet: e.target.checked } })} />
            Preguntar a cada invitado su alimentación y alergias
          </label>
          <p className="adm-hint">
            Son datos de salud: el invitado ve que solo se usan para planear el menú, y se borran junto con el resto de los datos de invitados.
            Verás un resumen para el menú en la página del evento.
          </p>
        </Panel>

        <Panel title="Pie de página">
          <div className="adm-grid">
            <Text label="Monograma" max={20} value={c.footer?.monogram ?? ""} placeholder="I | A"
              onChange={(monogram) => setContent({ footer: { monogram, line: c.footer?.line ?? "" } })} />
            <Text label="Línea de texto" max={120} value={c.footer?.line ?? ""} placeholder="27 · 02 · 2027 · Colima"
              onChange={(line) => setContent({ footer: { monogram: c.footer?.monogram ?? "", line } })} />
          </div>
        </Panel>

        <Panel title="Colores e ilustración">
          <label>
            Ilustración de portada
            <select className="adm-select" value={state.theme.hero_art ?? ""}
              onChange={(e) => setState((s) => ({ ...s, theme: { ...s.theme, hero_art: e.target.value || undefined } }))}>
              <option value="">Ninguna</option>
              <option value="volcanes-colima">Volcanes de Colima</option>
            </select>
          </label>
          {(["light", "dark"] as const).map((mode) => (
            <div key={mode}>
              <p className="adm-hint">{mode === "light" ? "Modo claro" : "Modo oscuro (si el dispositivo lo usa)"}</p>
              <div className="ed-colors">
                {COLOR_LABELS.map(([key, label]) => (
                  <label key={key} className="ed-color">
                    <input type="color" value={palette(mode)[key] ?? "#000000"} onChange={(e) => setColor(mode, key, e.target.value)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button type="button" className="adm-btn adm-ghost" onClick={() => setState((s) => ({ ...s, theme: { ...s.theme, light: DEFAULT_THEME.light, dark: DEFAULT_THEME.dark } }))}>
            Restablecer colores
          </button>
        </Panel>
      </div>

      <aside className="ed-preview" aria-label="Vista previa">
        <iframe key={previewKey} src={`/app/${eventId}/vista-previa`} title="Vista previa de la invitación" />
        <p className="adm-hint">Muestra la última versión guardada.</p>
      </aside>
    </div>
  );
}
