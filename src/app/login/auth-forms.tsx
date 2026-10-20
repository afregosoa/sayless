"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  requestPasswordReset, signInWithGoogle, signInWithPassword, signUpWithPassword, updatePassword,
  type AuthState,
} from "./actions";

const query = (next?: string) => (next ? `?next=${encodeURIComponent(next)}` : "");

export function GoogleButton({ next, label = "Continuar con Google", className = "adm-btn adm-ghost adm-google", terms, disabled }: {
  next?: string; label?: string; className?: string;
  terms?: boolean;   // true: en el registro, tras marcar la casilla de Términos
  disabled?: boolean;
}) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next ?? ""} />
      {terms && <input type="hidden" name="terms" value="1" />}
      <button type="submit" className={className} disabled={disabled}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h5.9a5.05 5.05 0 0 1-2.19 3.31v2.75h3.54c2.07-1.91 3.25-4.72 3.25-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.54-2.75c-.98.66-2.24 1.06-3.74 1.06-2.87 0-5.3-1.94-6.17-4.55H2.17v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.83 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.17a11 11 0 0 0 0 9.88l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.17 7.06l3.66 2.84C6.7 7.32 9.13 5.38 12 5.38z" />
        </svg>
        {label}
      </button>
    </form>
  );
}

export function PasswordInput({ id, name = "password", autoComplete, autoFocus, minLength, placeholder }: {
  id: string; name?: string; autoComplete: string; autoFocus?: boolean; minLength?: number; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw">
      <input id={id} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} autoFocus={autoFocus}
        minLength={minLength} maxLength={72} placeholder={placeholder} required />
      <button type="button" className="pw-toggle" aria-pressed={show} onClick={() => setShow((v) => !v)}>
        {show ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}

export function TermsCheck({ checked, onChange, className = "adm-check" }: {
  checked: boolean; onChange: (v: boolean) => void; className?: string;
}) {
  return (
    <label className={className}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>Acepto los <Link href="/terminos" target="_blank">Términos de uso</Link></span>
    </label>
  );
}

function Or() {
  return <p className="adm-or" aria-hidden="true"><span>o</span></p>;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signInWithPassword, {});
  return (
    <div className="adm-card adm-login">
      <h1>Entrar</h1>
      <GoogleButton next={next} />
      <Or />
      <form action={action} className="adm-form">
        <input type="hidden" name="next" value={next ?? ""} />
        <label htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        <label htmlFor="password">Contraseña</label>
        <PasswordInput id="password" autoComplete="current-password" />
        {state.error && <p className="adm-err" role="alert">{state.error}</p>}
        <button className="adm-btn" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
      </form>
      <p className="adm-hint"><Link href="/recuperar" className="adm-link">¿Olvidaste tu contraseña?</Link></p>
      <p className="adm-hint">¿Aún no tienes cuenta? <Link href={`/registro${query(next)}`} className="adm-link">Crear cuenta</Link></p>
    </div>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUpWithPassword, {});
  const [accepted, setAccepted] = useState(false);

  if (state.confirm) {
    return (
      <div className="adm-card adm-login">
        <h1>Revisa tu correo</h1>
        <p>Enviamos un enlace de confirmación a <b>{state.confirm}</b>. Ábrelo para activar tu cuenta y entrar.</p>
        <p className="adm-hint">Si no llega en un minuto, revisa spam.</p>
      </div>
    );
  }
  return (
    <div className="adm-card adm-login">
      <h1>Crear cuenta</h1>
      <TermsCheck checked={accepted} onChange={setAccepted} />
      <GoogleButton next={next} label="Registrarme con Google" terms disabled={!accepted} />
      <Or />
      <form action={action} className="adm-form">
        <input type="hidden" name="next" value={next ?? ""} />
        <label htmlFor="name">Nombre</label>
        <input id="name" name="name" autoComplete="name" minLength={2} maxLength={80} required autoFocus />
        <label htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        <label htmlFor="password">Contraseña</label>
        <PasswordInput id="password" autoComplete="new-password" minLength={8} />
        <small className="adm-hint">Mínimo 8 caracteres.</small>
        <label htmlFor="phone">Teléfono / WhatsApp (opcional)</label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={20} placeholder="+52 312 123 4567" />
        {state.error && <p className="adm-err" role="alert">{state.error}</p>}
        <input type="hidden" name="terms" value={accepted ? "on" : ""} />
        <button className="adm-btn" disabled={pending || !accepted}>{pending ? "Creando…" : "Crear cuenta"}</button>
      </form>
      <p className="adm-hint">¿Ya tienes cuenta? <Link href={`/login${query(next)}`} className="adm-link">Entrar</Link></p>
    </div>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {});

  if (state.sent) {
    return (
      <div className="adm-card adm-login">
        <h1>Revisa tu correo</h1>
        <p>Si <b>{state.sent}</b> tiene una cuenta, te enviamos un enlace para crear una contraseña nueva.</p>
        <p className="adm-hint">Si no llega en un minuto, revisa spam.</p>
      </div>
    );
  }
  return (
    <form action={action} className="adm-card adm-login">
      <h1>Recuperar contraseña</h1>
      <p className="adm-hint">Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.</p>
      <label htmlFor="email">Correo</label>
      <input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      {state.error && <p className="adm-err" role="alert">{state.error}</p>}
      <button className="adm-btn" disabled={pending}>{pending ? "Enviando…" : "Enviar enlace"}</button>
      <p className="adm-hint"><Link href="/login" className="adm-link">← Volver a entrar</Link></p>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, {});
  return (
    <form action={action} className="adm-card adm-login">
      <h1>Nueva contraseña</h1>
      <label htmlFor="password">Contraseña nueva</label>
      <PasswordInput id="password" autoComplete="new-password" minLength={8} autoFocus />
      <label htmlFor="confirm">Repite la contraseña</label>
      <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      <small className="adm-hint">Mínimo 8 caracteres.</small>
      {state.error && <p className="adm-err" role="alert">{state.error}</p>}
      <button className="adm-btn" disabled={pending}>{pending ? "Guardando…" : "Guardar contraseña"}</button>
    </form>
  );
}
