/**
 * Mesure ce qu'une partie donne à quelqu'un de chaque branche.
 *
 * Antoinette Chastel a dit que le quiz était trop dur pour elle. Ce n'était pas
 * de la difficulté : le tirage était uniforme sur quatre cent soixante-douze
 * fiches, et sa branche — pourtant la plus nombreuse de l'arbre — ne sortait
 * que 1,6 fois sur dix.
 *
 * Ce script compare l'avant et l'après sur les VRAIES données de production,
 * branche par branche, sur mille parties chacune. Il n'affirme rien qu'il n'ait
 * compté.
 *
 *   npx tsx scripts/verifier-quiz-par-branche.ts <export.json>
 */
import fs from "node:fs";
import { buildQuiz, type QuizPerson } from "../src/lib/quiz";

const chemin = process.argv[2];
if (!chemin) {
  console.error("usage : npx tsx scripts/verifier-quiz-par-branche.ts <export.json>");
  process.exit(1);
}

const gens: QuizPerson[] = JSON.parse(fs.readFileSync(chemin, "utf-8"));
const parId = new Map(gens.map((p) => [p.id, p]));
const PARTIES = 1000;

/** La branche de la personne interrogée, quand la question porte sur quelqu'un. */
function brancheDe(personId: string | null): string | null {
  return personId ? (parId.get(personId)?.branch ?? null) : null;
}

const branches = [...new Set(gens.map((p) => p.branch).filter(Boolean))] as string[];
branches.sort();

console.log(`${gens.length} fiches · ${PARTIES} parties simulées par branche\n`);
console.log(
  "branche".padEnd(12) +
    "taille".padStart(7) +
    "photos".padStart(7) +
    "avant".padStart(8) +
    "après".padStart(8) +
    "  portraits chez soi",
);
console.log("-".repeat(64));

for (const b of [null, ...branches]) {
  let avant = 0;
  let apres = 0;
  let portraitsChezSoi = 0;
  let questionsPosees = 0;

  for (let i = 0; i < PARTIES; i++) {
    // Sans préférence : c'est le tirage d'hier.
    for (const q of buildQuiz(gens, 10, null)) {
      if (b && brancheDe(q.personId) === b) avant++;
    }
    // Avec sa branche : celui d'aujourd'hui.
    for (const q of buildQuiz(gens, 10, b)) {
      questionsPosees++;
      if (b && brancheDe(q.personId) === b) apres++;
      if (b && q.kind === "visage" && brancheDe(q.personId) === b) portraitsChezSoi++;
    }
  }

  const taille = b ? gens.filter((p) => p.branch === b).length : gens.length;
  const photos = b
    ? gens.filter((p) => p.branch === b && p.photo_url).length
    : gens.filter((p) => p.photo_url).length;

  console.log(
    (b ?? "— aucune —").padEnd(12) +
      String(taille).padStart(7) +
      String(photos).padStart(7) +
      (avant / PARTIES).toFixed(1).padStart(8) +
      (apres / PARTIES).toFixed(1).padStart(8) +
      "  " +
      (portraitsChezSoi / PARTIES).toFixed(2) +
      " /partie",
  );

  // Une partie doit toujours faire dix questions : la pondération ne doit
  // jamais l'assécher, y compris chez les Lanvin qui sont onze.
  const moyenne = questionsPosees / PARTIES;
  if (Math.abs(moyenne - 10) > 0.05) {
    console.log(`   ⚠️  ${b} : ${moyenne.toFixed(2)} questions par partie au lieu de 10`);
  }
}
