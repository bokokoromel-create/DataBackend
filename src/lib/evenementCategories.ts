export const EVENEMENT_CATEGORIES = [
  "concours",
  "bourse",
  "formation",
  "emploi",
  "evenement",
  "entrepreneuriat",
  "numerique",
  "innovation",
] as const;

export type EvenementCategorie = (typeof EVENEMENT_CATEGORIES)[number];

export function parseEvenementCategorie(
  value: unknown,
): EvenementCategorie | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim().toLowerCase();
  return (EVENEMENT_CATEGORIES as readonly string[]).includes(normalized)
    ? (normalized as EvenementCategorie)
    : null;
}

export function validateEvenementCategorie(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (!parseEvenementCategorie(value)) {
    return `categorie invalide (attendu: ${EVENEMENT_CATEGORIES.join(", ")}).`;
  }
  return null;
}
