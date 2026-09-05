
import type { Question } from "@/lib/quiz";
import { QUESTIONS_PAYS } from "@/lib/famille";

/**
 * Les questions hors famille : elles ne demandent de connaître personne, se
 * répondent au flair ou s'apprennent en une seconde, et donnent au quiz des
 * respirations entre deux filiations.
 *
 * Le catalogue vit dans `famille.ts` : ce sont des faits d'histoire, ils ne
 * bougeront pas. Ici, seulement le tirage.
 */
const FAITS = QUESTIONS_PAYS;

/** Mélange les propositions et retrouve où la bonne réponse a atterri. */
function assemble(correct: string, wrong: string[]) {
  const options = [correct, ...wrong];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { options, answer: options.indexOf(correct) };
}

/**
 * Rend `combien` questions de pays, en évitant celles déjà vues.
 *
 * 🔑 Un tirage au hasard dans douze questions, deux par partie, ramenait les
 * mêmes dès la troisième partie : « les questions sur la région, je les ai eues
 * plusieurs fois ». Le stock est monté à vingt-quatre, mais cela ne suffit pas
 * — le hasard sans mémoire retombe toujours sur ses pas. On écarte donc ce que
 * le joueur a déjà vu.
 *
 * 🔑 Quand il ne reste plus assez de questions neuves, on repart du stock
 * entier plutôt que de rendre une partie amputée : mieux vaut revoir une
 * question après vingt-quatre que n'en avoir qu'une seule.
 *
 * `personId` reste vide : il n'y a pas de fiche à ouvrir derrière une question
 * de géographie.
 */
export function questionsPays(combien: number, vues: number[] = []): Question[] {
  const deja = new Set(vues);
  const rangs = FAITS.map((_, i) => i);
  const neufs = rangs.filter((i) => !deja.has(i));
  // Le tour est bouclé — ou presque : on recommence proprement.
  const vivier = neufs.length >= combien ? neufs : rangs;

  for (let i = vivier.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [vivier[i], vivier[j]] = [vivier[j], vivier[i]];
  }

  return vivier.slice(0, combien).map((rang) => {
    const f = FAITS[rang];
    return {
      kind: "pays" as const,
      prompt: f.prompt,
      ...assemble(f.correct, f.wrong),
      personId: null,
      hint: f.hint,
      image: f.image,
      // Le rang voyage jusqu'au navigateur, qui le mémorise pour la prochaine
      // partie. C'est la seule chose à retenir d'une question de pays.
      cle: rang,
    };
  });
}
