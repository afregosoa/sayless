"use client";

import { useEffect, useState } from "react";
import { Invitation } from "@/components/invitation";
import { contentSchema, themeSchema } from "@/lib/event-content";
import type { PublicEvent } from "@/lib/events";
import { PREVIEW_DRAFT, PREVIEW_READY } from "@/lib/preview-message";
import { isTemplateId } from "@/templates/catalog";

// Vista previa del editor: parte de lo guardado y, mientras se edita, muestra el borrador que envía el editor.
export function LivePreview({ event }: { event: PublicEvent }) {
  const [live, setLive] = useState(event);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const d = e.data as { type?: string; template?: unknown; content?: unknown; theme?: unknown } | null;
      if (d?.type !== PREVIEW_DRAFT || !isTemplateId(d.template)) return;
      // Cada parte se valida por separado: un color a medias no debe impedir que se vea el texto nuevo (ni al revés).
      const content = contentSchema.safeParse(d.content);
      const theme = themeSchema.safeParse(d.theme);
      const template = d.template;
      setLive((prev) => ({
        ...prev,
        template,
        content: content.success ? content.data : prev.content,
        theme: theme.success ? theme.data : prev.theme,
      }));
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: PREVIEW_READY }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return <Invitation event={live} preview />;
}
