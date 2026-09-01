import type { Question } from "@/lib/quiz";

/**
 * Le calcul des points vit à part du composant : c'est la seule chose du quiz
 * qu'on ait envie de relire six mois plus tard pour comprendre pourquoi telle
 * partie a donné tel score.
 */

/** Le temps de lire quatre noms de famille et de choisir, sans traîner. */
export const SECONDES = 20;

/** Le numéro des questions ratées, pour les revoir à la fin. */
export type Ratee = { step: number; donne: number };

const BASE = 100;
const VITESSE_MAX = 100;
const MULTIPLICATEUR_MAX = 2;

/**
 * Une bonne réponse rapporte cent points, la rapidité en rapporte cent de plus
 * au mieux, et la série multiplie le tout jusqu'au double. Répondre juste et
 * vite six fois d'affilée vaut donc bien plus que six réponses justes tirées au
 * ralenti — c'est là toute la tension du jeu.
 */
export function points(resteMs: number, serie: number): number {
  const vitesse = Math.round((VITESSE_MAX * Math.max(0, resteMs)) / (SECONDES * 1000));
  return Math.round((BASE + vitesse) * multiplicateur(serie));
}

export function multiplicateur(serie: number): number {
  return Math.min(1 + 0.25 * Math.max(0, serie - 1), MULTIPLICATEUR_MAX);
}

/** Le plafond théorique, pour situer un score sans avoir à faire le calcul. */
export function maximum(questions: number): number {
  let total = 0;
  for (let i = 1; i <= questions; i++) total += points(SECONDES * 1000, i);
  return total;
}

const RANGS: [number, string, string][] = [
  [0.9, "Mémoire de la famille", "Vous pourriez écrire le prochain bulletin."],
  [0.7, "Incollable", "Il ne vous manque que deux ou trois cousins."],
  [0.5, "Bon à table", "De quoi tenir une conversation tout un déjeuner."],
  [0.25, "En apprentissage", "Ça vient. Les branches commencent à se distinguer."],
  [0, "Nouveau venu", "Tout le monde commence là. Rejouez, ça rentre vite."],
];

export function rang(score: number, questions: number): { titre: string; mot: string } {
  const ratio = score / Math.max(1, maximum(questions));
  const [, titre, mot] = RANGS.find(([seuil]) => ratio >= seuil) ?? RANGS[RANGS.length - 1];
  return { titre, mot };
}

/** Une partie interrompue, retrouvée telle quelle au retour d'une fiche. */
export type Partie = {
  questions: Question[];
  step: number;
  score: number;
  justes: number;
  serie: number;
  meilleureSerie: number;
  /**
   * Ce qu'on a raté, gardé pour l'écran de fin. C'est le seul moment où le quiz
   * apprend vraiment quelque chose : pendant la partie, la bonne réponse
   * s'affiche une seconde et le joueur enchaîne. À la fin, il la relit au calme,
   * et peut ouvrir la fiche de celui qu'il n'a pas reconnu.
   */
  ratees: Ratee[];
};

const EN_COURS = "arbre.partie";
const RECORD = "arbre.record";

/**
 * La partie tient dans le stockage de session : quitter le quiz pour aller lire
 * une fiche ne doit pas coûter la partie, mais fermer l'onglet remet à zéro.
 * Le record, lui, survit dans le stockage local — c'est ce qu'on revient battre.
 */
export function sauverPartie(p: Partie) {
  try {
    sessionStorage.setItem(EN_COURS, JSON.stringify(p));
  } catch {
    // Navigation privée, quota plein : le jeu marche, il ne se reprend pas.
  }
}

export function lirePartie(): Partie | null {
  try {
    const brut = sessionStorage.getItem(EN_COURS);
    if (!brut) return null;
    const p = JSON.parse(brut) as Partie;
    // `step === questions.length` est une partie jouée jusqu'au bout dont on
    // n'a pas encore vu le score : c'est le cas de qui va lire une fiche depuis
    // la dernière question. On la rend, l'écran final s'affichera au retour.
    if (!p.questions?.length || p.step > p.questions.length) return null;
    // Une partie enregistrée avant que le récapitulatif n'existe n'a pas ce
    // champ : sans ce garde-fou, l'écran de fin planterait sur la partie qu'un
    // membre de la famille avait laissée ouverte.
    return { ...p, ratees: p.ratees ?? [] };
  } catch {
    return null;
  }
}

export function oublierPartie() {
  try {
    sessionStorage.removeItem(EN_COURS);
  } catch {
    /* rien à faire */
  }
}

export function lireRecord(): number {
  try {
    return Number(localStorage.getItem(RECORD)) || 0;
  } catch {
    return 0;
  }
}

export function garderRecord(score: number): boolean {
  try {
    if (score <= lireRecord()) return false;
    localStorage.setItem(RECORD, String(score));
    return true;
  } catch {
    return false;
  }
}
