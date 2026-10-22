"use client";

import { useEffect } from "react";
import { recordOpen } from "@/app/actions";

// Avisa una vez por sesión del navegador que se abrió la invitación personal. No muestra nada.
export function OpenBeacon({ slug, code }: { slug: string; code: string }) {
  useEffect(() => {
    const key = `sayless-open:${slug}:${code}`;
    try {
      if (sessionStorage.getItem(key)) return; // recargas y navegación dentro de la misma sesión no cuentan de nuevo
      sessionStorage.setItem(key, "1");
    } catch { /* sin sessionStorage (modo privado estricto): se cuenta igual */ }
    void recordOpen(slug, code);
  }, [slug, code]);
  return null;
}
