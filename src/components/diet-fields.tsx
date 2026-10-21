"use client";

import { DIETS, DIET_LABELS, type Diet } from "@/lib/diet";

export type DietValue = { diet: string[]; allergies: string };

/** Etiquetas de alimentación (varias a la vez) y un campo de texto para alergias. Sirve en la invitación y en el panel. */
export function DietFields({ value, onChange, disabled }: { value: DietValue; onChange: (v: DietValue) => void; disabled?: boolean }) {
  const toggle = (d: Diet, on: boolean) =>
    onChange({ ...value, diet: on ? [...value.diet.filter((x) => x !== d), d] : value.diet.filter((x) => x !== d) });
  return (
    <div className="diet">
      <div className="diet-tags" role="group" aria-label="Preferencias alimentarias">
        {DIETS.map((d) => (
          <label key={d} className="diet-tag">
            <input type="checkbox" checked={value.diet.includes(d)} disabled={disabled} onChange={(e) => toggle(d, e.target.checked)} />
            <span>{DIET_LABELS[d]}</span>
          </label>
        ))}
      </div>
      <label className="diet-allergies">
        <span>Alergias o notas</span>
        <input
          type="text" maxLength={200} value={value.allergies} disabled={disabled} placeholder="Ej. nueces, mariscos"
          onChange={(e) => onChange({ ...value, allergies: e.target.value })}
        />
      </label>
    </div>
  );
}
