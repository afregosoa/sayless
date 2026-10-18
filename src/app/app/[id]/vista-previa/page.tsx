import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Invitation } from "@/components/invitation";
import { requireUser } from "@/lib/auth";
import { buildPublicEvent, EVENT_COLUMNS } from "@/lib/events";
import { supabaseUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Vista previa", robots: { index: false, follow: false } };

export default function Page(props: PageProps<"/app/[id]/vista-previa">) {
  return (
    <Suspense fallback={null}>
      <Preview params={props.params} />
    </Suspense>
  );
}

async function Preview({ params }: { params: PageProps<"/app/[id]/vista-previa">["params"] }) {
  await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  // RLS: solo el dueño (o superadmin) obtiene la fila, aunque el evento sea borrador.
  const supabase = await supabaseUser();
  const { data } = await supabase.from("events").select(EVENT_COLUMNS).eq("id", id).maybeSingle();
  const event = data && buildPublicEvent(data);
  if (!event) notFound();

  return <Invitation event={event} />;
}
