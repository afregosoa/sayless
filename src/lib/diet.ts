// Preferencias alimentarias que el invitado puede marcar (lista fija, igual que la restricción de la base de datos).
export const DIETS = ["vegetarian", "vegan", "pescetarian", "gluten_free", "dairy_free", "halal", "kosher"] as const;
export type Diet = (typeof DIETS)[number];

export const DIET_LABELS: Record<Diet, string> = {
  vegetarian: "Vegetariano",
  vegan: "Vegano",
  pescetarian: "Pescetariano",
  gluten_free: "Sin gluten",
  dairy_free: "Sin lácteos",
  halal: "Halal",
  kosher: "Kosher",
};

/** Deja solo etiquetas válidas y sin repetir (lo que llegue del navegador no es de fiar). */
export function cleanDiet(values: unknown): Diet[] {
  const list = Array.isArray(values) ? values : [];
  return DIETS.filter((d) => list.includes(d));
}

/** "Vegetariano, Sin gluten · alergia: nueces" (vacío si no hay nada). */
export function dietText(diet: readonly string[] | null | undefined, allergies: string | null | undefined): string {
  const tags = cleanDiet(diet ?? []).map((d) => DIET_LABELS[d]);
  const parts = [tags.join(", "), allergies?.trim() ? `alergia: ${allergies.trim()}` : ""].filter(Boolean);
  return parts.join(" · ");
}
