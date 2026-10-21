"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

export function Countdown({ target, className = "count" }: { target: number; className?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const s = now === null ? null : Math.floor(Math.max(0, target - now) / 1000);
  const parts: [string, string][] = [
    [s === null ? "—" : String(Math.floor(s / 86400)), "Días"],
    [s === null ? "—" : pad(Math.floor((s % 86400) / 3600)), "Horas"],
    [s === null ? "—" : pad(Math.floor((s % 3600) / 60)), "Min"],
    [s === null ? "—" : pad(s % 60), "Seg"],
  ];

  return (
    <div className={className} aria-live="off">
      {parts.map(([value, label]) => (
        <div key={label}>
          <b>{value}</b>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}
