import type { Metadata } from "next";
import { Suspense } from "react";
import { EventPage } from "@/components/event-page";
import { getPublicEvent } from "@/lib/events";

export async function generateMetadata({ params }: PageProps<"/[slug]/[codigo]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) return {};
  const { hero } = event.content;
  return {
    title: { absolute: event.title }, // sin el sufijo de la plataforma
    description: [hero.date_label, hero.subtitle].filter(Boolean).join(" · ") || event.title,
    robots: { index: false, follow: false }, // los links personales no deben indexarse
  };
}

export default function Page(props: PageProps<"/[slug]/[codigo]">) {
  return (
    <Suspense fallback={null}>
      <Content params={props.params} />
    </Suspense>
  );
}

async function Content({ params }: { params: PageProps<"/[slug]/[codigo]">["params"] }) {
  const { slug, codigo } = await params;
  return <EventPage slug={slug} code={codigo} />;
}
