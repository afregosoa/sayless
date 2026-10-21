import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Invitation } from "@/components/invitation";
import { demoEvent, demoGuest } from "@/templates/demo";
import { isTemplateId, TEMPLATES } from "@/templates/catalog";

export async function generateMetadata({ params }: PageProps<"/plantillas/[id]">): Promise<Metadata> {
  const { id } = await params;
  return isTemplateId(id) ? { title: `Plantilla ${TEMPLATES[id].name}`, description: TEMPLATES[id].tagline } : {};
}

// Vista de muestra de una plantilla con datos de ejemplo (para el catálogo).
export default function Page(props: PageProps<"/plantillas/[id]">) {
  return (
    <Suspense fallback={null}>
      <Demo params={props.params} />
    </Suspense>
  );
}

async function Demo({ params }: { params: PageProps<"/plantillas/[id]">["params"] }) {
  const { id } = await params;
  if (!isTemplateId(id)) notFound();
  return (
    <>
      <Invitation event={demoEvent(id)} guest={demoGuest} code="DEMO" preview />
      <div className="demo-bar">
        <span>Demo · <b>{TEMPLATES[id].name}</b></span>
        <Link href="/plantillas">← Todas</Link>
        <Link href={`/app?plantilla=${id}`} className="demo-use">Usar esta plantilla</Link>
      </div>
    </>
  );
}
