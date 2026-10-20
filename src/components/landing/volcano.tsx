// Silueta de los volcanes de Colima (la misma de las invitaciones), a ancho completo.
// pathLength=1 permite animar el trazo "dibujándose" al cargar.
export function Volcano({ className = "" }: { className?: string }) {
  return (
    <svg className={`lp-volcano ${className}`} viewBox="0 0 520 110" aria-hidden="true" focusable="false">
      <path className="lp-smoke" pathLength={1} d="M300 34c6-8 2-14 9-20s3-10 8-14" />
      <path
        className="lp-ridge"
        pathLength={1}
        d="M0 104h40l60-26 50-20 46-26 26-14 14-8 12 10 20 12 30 10 22 6 28-6 18-6 18 10 30 18 44 20 50 12 12 2"
      />
      <path className="lp-ridge-detail" d="M226 9l14 8 12 10M168 44l20-12M380 64l18 10" />
    </svg>
  );
}
