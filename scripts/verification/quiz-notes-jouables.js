const { buildQuiz } = require("./quiz.js");
const gens = JSON.parse(require("fs").readFileSync("/tmp/vraies-fiches.json", "utf8"));
const par = new Map(gens.map((p) => [p.id, p]));
// On rejoue assez de parties pour voir passer beaucoup de notes.
const vues = new Map();
for (const b of [null]) {
  for (let i = 0; i < 400; i++)
    for (const q of buildQuiz(gens, 10, null, 3, []))
      if (q.apprendre && q.personId) vues.set(q.personId, q.apprendre);
}
const avecNote = gens.filter((p) => p.notes);
let servies = 0, composees = 0;
const exemples = [];
for (const [id, texte] of vues) {
  const p = par.get(id);
  if (!p?.notes) continue;
  if (texte.includes(p.notes)) { servies++; exemples.push(["SERVIE  ", p.notes.slice(0, 75)]); }
  else { composees++; }
}
console.log(`${avecNote.length} fiches ont une note ; ${vues.size} personnes vues sur 400 parties\n`);
console.log(`Notes encore SERVIES au joueur : ${servies}`);
console.log(`Notes écartées, phrase composée à la place : ${composees}\n`);
console.log("--- ce qui passe encore le filtre ---");
const uniq = [...new Set(exemples.map((e) => e[1]))];
uniq.slice(0, 12).forEach((e) => console.log("  ✓", e));
if (!uniq.length) console.log("  (aucune)");
