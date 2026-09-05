import { BRANCHES, CAMPS } from "@/lib/famille";

/**
 * La couleur d'une branche, au même endroit pour toute l'application.
 *
 * Elle apparaît sur le liseré des cartes de l'arbre, sur le classement du quiz
 * et sur les filtres des visages à poser. Trois définitions séparées auraient
 * fini par diverger, et le repère cesserait d'en être un.
 *
 * Tout est dérivé de `famille.ts` : les branches sont numérotées dans la base,
 * l'arbre n'en connaît que l'identifiant, le reste du site que le nom.
 */
export const BRANCHE_PAR_ID: Record<number, string> = Object.fromEntries(
  Object.entries(BRANCHES).map(([id, b]) => [Number(id), b.nom]),
);

export const COULEUR_BRANCHE: Record<string, string> = Object.fromEntries(
  Object.values(BRANCHES).map((b) => [b.nom, b.couleur]),
);

export const couleurDe = (nom: string | null | undefined) =>
  (nom && COULEUR_BRANCHE[nom]) || undefined;

export const couleurDeId = (id: number | null | undefined) =>
  couleurDe(id ? BRANCHE_PAR_ID[id] : null);

/**
 * Le camp d'une branche — jumeau de `camp_de()` côté base, qui lit
 * `branches.camp`. Une branche absente des camps n'en a pas : les aïeux
 * d'avant le partage sont à tout le monde.
 */
export function campDe(branche: string | null | undefined): string | null {
  if (!branche) return null;
  for (const [camp, branches] of Object.entries(CAMPS)) {
    if (branches.includes(branche)) return camp;
  }
  return null;
}

/** L'autre camp que celui-ci — celui qu'on affronte au niveau 2 du quiz. */
export function campAdverse(camp: string): string | null {
  return Object.keys(CAMPS).find((c) => c !== camp) ?? null;
}
