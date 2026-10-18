import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

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
      {error && <p className="adm-err" role="alert" style={{ textAlign: "center" }}>El enlace expiró o ya se usó. Pide uno nuevo.</p>}
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </>
  );
}
