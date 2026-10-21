// Ilustración botánica dibujada con código: una rama curva con hojas pareadas y unas bayas. Sin imágenes externas.
// Usa currentColor, así toma el color de acento del tema (y se adapta al modo oscuro).
type Pt = { x: number; y: number };

const bez = (p: Pt[], t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * u * p[0].x + 3 * u * u * t * p[1].x + 3 * u * t * t * p[2].x + t * t * t * p[3].x,
    y: u * u * u * p[0].y + 3 * u * u * t * p[1].y + 3 * u * t * t * p[2].y + t * t * t * p[3].y,
  };
};
const tangent = (p: Pt[], t: number) => {
  const u = 1 - t;
  const dx = 3 * u * u * (p[1].x - p[0].x) + 6 * u * t * (p[2].x - p[1].x) + 3 * t * t * (p[3].x - p[2].x);
  const dy = 3 * u * u * (p[1].y - p[0].y) + 6 * u * t * (p[2].y - p[1].y) + 3 * t * t * (p[3].y - p[2].y);
  return Math.atan2(dy, dx);
};

const CURVES: Pt[][] = [
  [{ x: 14, y: 236 }, { x: 40, y: 150 }, { x: 40, y: 80 }, { x: 96, y: 8 }],
  [{ x: 10, y: 230 }, { x: 70, y: 170 }, { x: 20, y: 90 }, { x: 80, y: 14 }],
  [{ x: 16, y: 236 }, { x: 20, y: 160 }, { x: 70, y: 110 }, { x: 100, y: 20 }],
];

/** Rama con `leaves` pares de hojas. `flip` la refleja; `variant` cambia su curvatura. */
export function Branch({ className, leaves = 8, flip = false, variant = 0 }: { className?: string; leaves?: number; flip?: boolean; variant?: 0 | 1 | 2 }) {
  const c = CURVES[variant];
  const items: { d: string; o: number }[] = [];
  for (let i = 0; i < leaves; i++) {
    const t = 0.14 + (i / leaves) * 0.8;
    const p = bez(c, t);
    const a = tangent(c, t);
    const size = 30 - t * 14;
    for (const side of [-1, 1]) {
      const rot = a + side * (0.85 - t * 0.25);
      const lx = Math.cos(rot) * size, ly = Math.sin(rot) * size;
      const nx = -Math.sin(rot) * size * 0.32, ny = Math.cos(rot) * size * 0.32;
      items.push({
        d: `M${p.x.toFixed(1)} ${p.y.toFixed(1)} Q${(p.x + lx * 0.5 + nx).toFixed(1)} ${(p.y + ly * 0.5 + ny).toFixed(1)} ${(p.x + lx).toFixed(1)} ${(p.y + ly).toFixed(1)} Q${(p.x + lx * 0.5 - nx).toFixed(1)} ${(p.y + ly * 0.5 - ny).toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}Z`,
        o: 0.5 + ((i * 7 + (side > 0 ? 3 : 0)) % 5) * 0.1,
      });
    }
  }
  const tip = bez(c, 1);
  return (
    <svg className={className} viewBox="0 0 120 250" aria-hidden="true" focusable="false" style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <path d={`M${c[0].x} ${c[0].y} C${c[1].x} ${c[1].y} ${c[2].x} ${c[2].y} ${c[3].x} ${c[3].y}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".85" />
      {items.map((l, i) => <path key={i} d={l.d} fill="currentColor" opacity={l.o} />)}
      {[0, 1, 2].map((i) => <circle key={i} cx={tip.x - 4 + i * 5} cy={tip.y + 8 + (i % 2) * 7} r="2.4" fill="var(--clay, currentColor)" />)}
    </svg>
  );
}

/** Hoja suelta, para viñetas. */
export function Leaf({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16z" fill="currentColor" opacity=".85" />
      <path d="M4 20 15 9" stroke="var(--paper)" strokeWidth="1" fill="none" opacity=".7" />
    </svg>
  );
}

/** Separador: una línea con dos hojas y un punto al centro. */
export function LeafDivider({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 220 24" aria-hidden="true" focusable="false">
      <path d="M0 12h82M138 12h82" stroke="currentColor" strokeWidth="1" opacity=".6" />
      <path d="M108 12c-10-9-22-8-30-2 8 8 20 9 30 2z" fill="currentColor" opacity=".85" />
      <path d="M112 12c10-9 22-8 30-2-8 8-20 9-30 2z" fill="currentColor" opacity=".85" />
      <circle cx="110" cy="12" r="2.4" fill="var(--clay, currentColor)" />
    </svg>
  );
}
