// Ilustraciones disponibles para el hero. El evento elige una con theme.hero_art.
const ART: Record<string, React.ReactNode> = {
  "volcanes-colima": (
    <svg className="volcan" viewBox="0 0 520 110" role="img" aria-label="Silueta del Volcán de Fuego y el Nevado de Colima">
      <path className="smoke" d="M300 34c6-8 2-14 9-20s3-10 8-14" />
      <path d="M0 104h40l60-26 50-20 46-26 26-14 14-8 12 10 20 12 30 10 22 6 28-6 18-6 18 10 30 18 44 20 50 12 12 2" />
      <path d="M226 9l14 8 12 10M168 44l20-12M380 64l18 10" />
    </svg>
  ),
};

export function HeroArt({ name }: { name?: string }) {
  return name ? (ART[name] ?? null) : null;
}
