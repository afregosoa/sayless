import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { templatesFor } from "@/templates/catalog";

export const metadata: Metadata = {
  title: "Plantillas de invitación de boda",
  description: "Elige entre plantillas de boda totalmente distintas: sobre con sello, jardín botánico, moderna y editorial. Pruébalas con una invitación de ejemplo.",
};

// Catálogo público: cada plantilla tiene su vista previa, una demo completa y un acceso directo para usarla.
export default function Catalog() {
  const templates = templatesFor("boda");
  return (
    <main className="cat">
      <header className="cat-head">
        <Link href="/" className="cat-back">← SayLess</Link>
        <p className="cat-eyebrow">Plantillas</p>
        <h1>Invitaciones de boda</h1>
        <p>Cada plantilla es un diseño completo, no solo otros colores. Ábrelas, pruébalas con una invitación de ejemplo y elige la tuya; después puedes cambiar sus colores, textos y fotos.</p>
      </header>

      <ul className="cat-grid">
        {templates.map((t) => (
          <li key={t.id} className="cat-card">
            <Link href={`/plantillas/${t.id}`} className="cat-shot" aria-label={`Ver la demo de ${t.name}`}>
              <Image src={`/templates/preview-${t.id}.jpg`} alt={`Vista previa de la plantilla ${t.name}`} width={420} height={742} sizes="(max-width: 700px) 90vw, 280px" />
            </Link>
            <div className="cat-info">
              <h2>{t.name}</h2>
              <p>{t.tagline}</p>
              <ul className="cat-traits">{t.traits.map((x) => <li key={x}>{x}</li>)}</ul>
              <div className="cat-actions">
                <Link href={`/plantillas/${t.id}`} className="cat-btn cat-btn-ghost">Ver demo</Link>
                <Link href={`/app?plantilla=${t.id}`} className="cat-btn">Usar esta plantilla</Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
