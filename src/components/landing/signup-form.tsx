"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { GoogleButton, PasswordInput, TermsCheck } from "@/app/login/auth-forms";
import { signUpWithPassword, type AuthState } from "@/app/login/actions";

// Crear cuenta desde la landing: nombre, correo y contraseña (o Google) y directo al panel para crear el primer evento.
export function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUpWithPassword, {});
  const [accepted, setAccepted] = useState(false);

  if (state.confirm) {
    return (
      <div className="lp-form lp-sent" role="status">
        <h3>Revisa tu correo</h3>
        <p>Enviamos un enlace de confirmación a <b>{state.confirm}</b>. Ábrelo para activar tu cuenta y crear tu evento.</p>
        <p className="lp-small">Si no llega en un minuto, revisa spam.</p>
      </div>
    );
  }

  return (
    <div className="lp-form">
      <TermsCheck checked={accepted} onChange={setAccepted} className="lp-check" />
      <GoogleButton next="/app" label="Continuar con Google" className="lp-btn lp-btn-google" terms disabled={!accepted} />
      <p className="lp-or" aria-hidden="true"><span>o con tu correo</span></p>
      <form action={action} className="lp-form-fields">
        <input type="hidden" name="next" value="/app" />
        <input type="hidden" name="terms" value={accepted ? "on" : ""} />
        <label htmlFor="lp-name">Tu nombre</label>
        <input id="lp-name" name="name" autoComplete="name" minLength={2} maxLength={80} placeholder="Ana Pérez" required />
        <label htmlFor="lp-email">Tu correo</label>
        <input id="lp-email" name="email" type="email" autoComplete="email" placeholder="tu@correo.com" required />
        <label htmlFor="lp-password">Crea una contraseña</label>
        <PasswordInput id="lp-password" autoComplete="new-password" minLength={8} placeholder="Mínimo 8 caracteres" />
        {state.error && <p className="lp-err" role="alert">{state.error}</p>}
        <button className="lp-btn" disabled={pending || !accepted}>{pending ? "Creando…" : "Crear mi cuenta"}</button>
      </form>
      <p className="lp-small">Pagas solo cuando publicas. ¿Ya tienes cuenta? <Link href="/login">Entrar</Link></p>
    </div>
  );
}
