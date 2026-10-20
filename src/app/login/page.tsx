import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./auth-forms";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="admin">
      <Suspense fallback={null}>
        <Form searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next, error } = await searchParams;
  return (
    <>
      {error && (
        <p className="adm-err" role="alert" style={{ textAlign: "center" }}>
          {error === "google"
            ? "No pudimos entrar con Google. Intenta de nuevo."
            : "No pudimos completar el enlace (expiró o se abrió en otro navegador). Si ya confirmaste tu correo, entra con tu contraseña."}
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </>
  );
}
