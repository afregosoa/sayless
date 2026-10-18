import Link from "next/link";
import { signOut } from "../login/actions";

export function AdminNav({ email, current }: { email: string; current: "resumen" | "clientes" }) {
  return (
    <header className="adm-head">
      <div>
        <h1>Operador</h1>
        <p className="adm-hint">{email} · superadmin</p>
      </div>
      <nav className="adm-actions" aria-label="Administración">
        <Link className={`adm-btn ${current === "resumen" ? "" : "adm-ghost"}`} href="/admin">Resumen</Link>
        <Link className={`adm-btn ${current === "clientes" ? "" : "adm-ghost"}`} href="/admin/clientes">Clientes</Link>
        <Link className="adm-btn adm-ghost" href="/app">Mis eventos</Link>
        <form action={signOut}><button className="adm-btn adm-ghost">Salir</button></form>
      </nav>
    </header>
  );
}
