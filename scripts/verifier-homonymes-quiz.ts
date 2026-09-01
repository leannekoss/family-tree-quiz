/**
 * Combien de questions proposaient deux homonymes sans rien pour les
 * départager ?
 *
 * Déclencheur réel : « Qui est frère ou sœur de Nicole Perrin ? » a proposé
 * *Edouard Vernet* (son frère, 1916) et *Edouard François Vernet* (son
 * oncle, 1891) côte à côte. La règle qui choisit les distracteurs privilégie
 * exprès les porteurs du même nom hors de la fratrie, pour que le patronyme ne
 * trahisse pas — elle produit donc mécaniquement des prénoms en double.
 *
 * On mesure ici la fréquence du cas et l'effet de la parade, sur la base réelle
 * lue depuis l'export de sauvegarde.
 *
 *   npx tsx scripts/verifier-homonymes-quiz.ts     (HORS bac à sable)
 */
import { readFileSync } from "node:fs";
import { buildQuiz, type QuizPerson } from "../src/lib/quiz";

// L'export passe en argument : la sauvegarde du dépôt date d'avant les aïeux,
// et ce sont justement eux qui portent les homonymes (quatre Édouard
// Vernet). Mesurer sur des données périmées aurait conclu « rien à voir ».
const source = process.argv[2] ?? "sauvegarde/donnees.json";
const brut = JSON.parse(readFileSync(source, "utf8"));
const gens: QuizPerson[] = (Array.isArray(brut) ? brut : brut.people).map(
  (p: Record<string, unknown>) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    married_name: p.married_name ?? null,
    sex: p.sex ?? null,
    birth_display: p.birth_display ?? null,
    birth_year: p.birth_year ?? null,
    death_display: p.death_display ?? null,
    death_year: p.death_year ?? null,
    deceased: Boolean(p.deceased),
    father_id: p.father_id ?? null,
    mother_id: p.mother_id ?? null,
    branch: p.branch ?? null,
    photo_url: p.photo_url ?? null,
      notes: null,
      nickname: null,
  }),
) as QuizPerson[];

const PARTIES = 400;
let questions = 0;
let prenomsEnDouble = 0;
let indistinguables = 0;
const exemples: string[] = [];

for (let n = 0; n < PARTIES; n++) {
  for (const q of buildQuiz(gens, 10)) {
    // Les questions dont les propositions sont des noms de personnes.
    if (!["fratrie", "visage"].includes(q.kind)) continue;
    questions++;

    const prenom = (s: string) => s.split(" ")[0];
    const compte = new Map<string, number>();
    for (const o of q.options) compte.set(prenom(o), (compte.get(prenom(o)) ?? 0) + 1);
    if (![...compte.values()].some((c) => c > 1)) continue;

    prenomsEnDouble++;
    // Après la parade, les propositions homonymes doivent porter une date.
    const datees = q.options.filter((o) => / · \d{4}$/.test(o)).length;
    if (datees === 0) {
      indistinguables++;
      if (exemples.length < 5) exemples.push(`${q.prompt} → ${q.options.join(" / ")}`);
    }
  }
}

console.log(`Questions à noms de personnes : ${questions} (sur ${PARTIES} parties)`);
console.log(`  dont deux mêmes prénoms     : ${prenomsEnDouble} (${((prenomsEnDouble / questions) * 100).toFixed(1)} %)`);
console.log(`  dont AUCUNE date pour trancher : ${indistinguables}`);
if (exemples.length) {
  console.log("\nCas restés indistinguables :");
  for (const e of exemples) console.log("  " + e);
}
console.log(
  indistinguables === 0
    ? "\n✅ Toute question à prénoms en double porte désormais les années."
    : `\n⚠️ ${indistinguables} question(s) encore impossibles — dates manquantes en base.`,
);
