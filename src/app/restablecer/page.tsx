import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { ResetForm } from "../login/auth-forms";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false, follow: false } };

export default function ResetPage() {
  return (
    <main className="admin">
      <Suspense fallback={null}>
        <Content />
      </Suspense>
    </main>
  );
}

// Se llega aquí desde el enlace del correo, que ya inició una sesión temporal. Sin sesión, el enlace expiró.
async function Content() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="adm-card adm-login">
        <h1>Enlace expirado</h1>
        <p>Este enlace ya no es válido. Pide uno nuevo.</p>
        <Link href="/recuperar" className="adm-btn">Pedir otro enlace</Link>
      </div>
    );
  }
  return <ResetForm />;
}
