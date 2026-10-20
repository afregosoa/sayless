"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "@/app/login/actions";

// Crear cuenta y entrar son lo mismo: el enlace por correo crea al usuario si no existe
// y lo lleva a /app, donde ya está el formulario para crear su primer evento.
export function SignupForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {});

  if (state.sent) {
    return (
      <div className="lp-form lp-sent" role="status">
        <h3>Revisa tu correo</h3>
        <p>Enviamos un enlace a <b>{state.sent}</b>. Ábrelo en este navegador y podrás crear tu evento.</p>
        <p className="lp-small">Si no llega en un minuto, revisa spam.</p>
      </div>
    );
  }

  return (
    <form action={action} className="lp-form">
      <input type="hidden" name="next" value="/app" />
      <label htmlFor="lp-email">Tu correo</label>
      <div className="lp-form-row">
        <input id="lp-email" name="email" type="email" autoComplete="email" placeholder="tu@correo.com" required />
        <button className="lp-btn" disabled={pending}>{pending ? "Enviando…" : "Crear mi invitación"}</button>
      </div>
      {state.error && <p className="lp-err" role="alert">{state.error}</p>}
      <p className="lp-small">Sin contraseña: te enviamos un enlace. Pagas solo cuando publicas.</p>
    </form>
  );
}
