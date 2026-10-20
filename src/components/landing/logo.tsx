import Image from "next/image";

// Logo de SayLess. "on-dark" fuerza la versión para fondos oscuros (p. ej. sobre la foto del hero);
// "auto" elige según el tema claro/oscuro del sistema.
export function Logo({ variant = "auto", height = 36 }: { variant?: "auto" | "on-dark"; height?: number }) {
  const width = Math.round((height * 137.7) / 36);
  const dark = <Image src="/landing/logo-dark.svg" alt="SayLess" width={width} height={height} unoptimized priority />;
  if (variant === "on-dark") return dark;
  return (
    <picture>
      <source srcSet="/landing/logo-dark.svg" media="(prefers-color-scheme: dark)" />
      <Image src="/landing/logo-light.svg" alt="SayLess" width={width} height={height} unoptimized />
    </picture>
  );
}
