/**
 * La couleur d'une branche, au même endroit pour toute l'application.
 *
 * Elle apparaît sur le liseré des cartes de l'arbre, sur le classement du quiz
 * et sur les filtres des visages à poser. Trois définitions séparées auraient
 * fini par diverger : la branche Aubry ocre ici, terracotta là, et le repère
 * cesserait d'en être un.
 *
 * Ce sont des terres et des végétaux, pas des couleurs vives : elles doivent
 * tenir ensemble sur une même page et cohabiter avec le terracotta, qui garde
 * son rôle — l'action. Elles ne portent jamais de texte, seulement un trait :
 * il leur suffit de se distinguer entre elles.
 */
export const COULEUR_BRANCHE: Record<string, string> = {
  Bardin: "var(--branche-bardin)",
  Rouvière: "var(--branche-rouviere)",
  Aubry: "var(--branche-aubry)",
  Vernet: "var(--branche-vernet)",
  Delcourt: "var(--branche-delcourt)",
  Perrin: "var(--branche-perrin)",
  Chastel: "var(--branche-chastel)",
  Morel: "var(--branche-morel)",
  Lanvin: "var(--branche-lanvin)",
};

/** Les branches sont numérotées dans la base ; l'arbre n'en connaît que l'identifiant. */
export const BRANCHE_PAR_ID: Record<number, string> = {
  8: "Bardin",
  9: "Rouvière",
  10: "Aubry",
  11: "Vernet",
  12: "Delcourt",
  13: "Perrin",
  14: "Chastel",
  15: "Morel",
  16: "Lanvin",
};

export const couleurDe = (nom: string | null | undefined) =>
  (nom && COULEUR_BRANCHE[nom]) || undefined;

export const couleurDeId = (id: number | null | undefined) =>
  couleurDe(id ? BRANCHE_PAR_ID[id] : null);

/**
 * Le camp d'une branche — jumeau de `camp_de()` côté base.
 *
 * Six branches descendent des enfants d'Augustin Vernet et Blanche
 * Delcourt : c'est le camp du Moulin. Chastel, Morel et Lanvin, les cousins
 * du Lot-et-Garonne, forment celui de la Bastide. Les aïeux d'avant le partage
 * n'ont pas de camp : ils sont à tout le monde.
 */
export function campDe(branche: string | null | undefined): "Moulin" | "Bastide" | null {
  if (!branche) return null;
  if (["Bardin", "Rouvière", "Aubry", "Vernet", "Delcourt", "Perrin"].includes(branche))
    return "Moulin";
  if (["Chastel", "Morel", "Lanvin"].includes(branche)) return "Bastide";
  return null;
}
