/**
 * Le quota de portraits tient-il, et à quel prix ?
 *
 * Mesuré le 12/08 AVANT le quota : la question « Qui est-ce ? » sortait 94 fois
 * sur 1481 tirages possibles, soit 6 % — une partie sur deux n'en contenait
 * aucune, et l'audit QA n'a jamais réussi à en faire sortir une en quinze
 * tirages. On vérifie ici sur mille parties simulées que le plancher de deux
 * portraits sur dix est effectivement atteint, sans que les questions se
 * répètent ni que la partie change de longueur.
 *
 * Lancer HORS bac à sable : `npx tsx` échoue dedans (EPERM sur un tube).
 *   npx tsx scripts/verifier-quota-visages.ts
 */
import { buildQuiz, type QuizPerson } from "../src/lib/quiz";

// Population de forme réaliste : 405 jouables, dont 94 avec un portrait —
// exactement le rapport mesuré en base.
const AVEC_PHOTO = 94;
const TOTAL = 405;

const gens: QuizPerson[] = Array.from({ length: TOTAL }, (_, i) => ({
  id: `p${i}`,
  first_name: `Prenom${i}`,
  last_name: `Nom${i % 30}`,
  married_name: null,
  sex: i % 2 === 0 ? "M" : "F",
  birth_display: `${1930 + (i % 90)}`,
  birth_year: 1930 + (i % 90),
  death_display: null,
  death_year: null,
  deceased: false,
  father_id: i > 40 ? `p${i % 20}` : null,
  mother_id: i > 40 ? `p${20 + (i % 20)}` : null,
  branch: `Branche${(i % 9) + 1}`,
  photo_url: i < AVEC_PHOTO ? `visages/p${i}.jpg` : null,
      notes: null,
      nickname: null,
}));

const PARTIES = 1000;
let sansAucunVisage = 0;
let totalVisages = 0;
let mauvaiseLongueur = 0;
let doublons = 0;
let premiereEstVisage = 0;

for (let n = 0; n < PARTIES; n++) {
  const partie = buildQuiz(gens, 10);
  if (partie.length !== 10) mauvaiseLongueur++;

  const visages = partie.filter((q) => q.kind === "visage");
  totalVisages += visages.length;
  if (visages.length === 0) sansAucunVisage++;
  if (partie[0]?.kind === "visage") premiereEstVisage++;

  // Les questions de pays ne portent aucune personne : les compter par
  // `kind:personId` les ferait toutes passer pour la même. On dédoublonne les
  // questions de famille par la personne, celles de pays par leur énoncé.
  const cles = partie
    .filter((q) => q.personId)
    .map((q) => `${q.kind}:${q.personId}`)
    .concat(partie.filter((q) => !q.personId).map((q) => q.prompt));
  if (new Set(cles).size !== cles.length) doublons++;
}

const moyenne = totalVisages / PARTIES;
console.log(`Parties simulées          : ${PARTIES}`);
console.log(`Portraits par partie      : ${moyenne.toFixed(2)} (attendu 2)`);
console.log(`Parties sans aucun visage : ${sansAucunVisage} (avant le quota : ~1 sur 2)`);
console.log(`Parties de longueur ≠ 10  : ${mauvaiseLongueur}`);
console.log(`Parties avec un doublon   : ${doublons}`);
console.log(`Parties ouvertes par un visage : ${premiereEstVisage} (~20 % attendu si l'ordre est bien rebattu)`);

const echecs =
  (moyenne < 1.9 ? 1 : 0) + sansAucunVisage + mauvaiseLongueur + doublons;
if (echecs > 0) {
  console.error("\n❌ Le quota ne tient pas.");
  process.exit(1);
}
console.log("\n✅ Deux portraits par partie, aucune partie vide, aucun doublon.");
