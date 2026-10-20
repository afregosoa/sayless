import type { Metadata } from "next";
import { ForgotForm } from "../login/auth-forms";

export const metadata: Metadata = { title: "Recuperar contraseña", robots: { index: false, follow: false } };

export default function ForgotPage() {
  return (
    <main className="admin">
      <ForgotForm />
    </main>
  );
}
