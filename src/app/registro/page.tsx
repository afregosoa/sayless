import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "../login/auth-forms";

export const metadata: Metadata = { title: "Crear cuenta", robots: { index: false, follow: false } };

export default function RegisterPage(props: PageProps<"/registro">) {
  return (
    <main className="admin">
      <Suspense fallback={null}>
        <Form searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/registro">["searchParams"] }) {
  const { next } = await searchParams;
  return <RegisterForm next={typeof next === "string" ? next : undefined} />;
}
