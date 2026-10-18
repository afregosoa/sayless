import { redirect } from "next/navigation";
import { Suspense } from "react";
import { defaultEvent } from "@/lib/events";

// Temporal: hasta que exista la página de inicio del negocio, "/" lleva al primer evento.
export default function Home() {
  return (
    <Suspense fallback={null}>
      <GoToDefaultEvent />
    </Suspense>
  );
}

async function GoToDefaultEvent() {
  const { slug } = await defaultEvent();
  return redirect(`/${slug}`);
}
