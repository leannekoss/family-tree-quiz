/**
 * Mesure la composition réelle des parties par niveau et par branche.
 *
 *   npx tsx scripts/verifier-niveaux-quiz.ts <export.json>
 *
 * Niveau 1 promis : 6 ma branche · 2 mon camp · 2 pays — zéro autre camp,
 * zéro aïeul. Niveau 2 : l'autre maison et les aïeux seulement.
 */
import fs from "node:fs";
import { buildQuiz, type QuizPerson } from "../src/lib/quiz";
import { campDe } from "../src/lib/branches";

const gens: QuizPerson[] = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"));
const parId = new Map(gens.map((p) => [p.id, p]));
const PARTIES = 500;

for (const branche of ["Vernet", "Chastel", "Lanvin"]) {
  for (const niveau of [1, 2] as const) {
    let mienne = 0, camp = 0, autre = 0, aieux = 0, pays = 0, total = 0;
    const monCamp = campDe(branche);
    for (let i = 0; i < PARTIES; i++) {
      for (const q of buildQuiz(gens, 10, branche, niveau)) {
        total++;
        if (!q.personId) { pays++; continue; }
        const b = parId.get(q.personId)?.branch ?? null;
        if (b === branche) mienne++;
        else if (b === null) aieux++;
        else if (campDe(b) === monCamp) camp++;
        else autre++;
      }
    }
    const f = (n: number) => (n / PARTIES).toFixed(1);
    console.log(
      `${branche.padEnd(11)} niv${niveau} :  ${f(mienne)} ma branche · ${f(camp)} mon camp · ` +
      `${f(autre)} autre camp · ${f(aieux)} aïeux · ${f(pays)} pays  (${(total / PARTIES).toFixed(1)} q/partie)`,
    );
  }
}
