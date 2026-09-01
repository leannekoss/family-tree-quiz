const { buildQuiz } = require("./quiz.js");

// Une famille factice : 3 branches, assez de monde pour composer 10 questions.
const BRANCHES = ["Rouvière", "Bardin", "Aubry"];
const gens = [];
let n = 0;
for (const b of BRANCHES) {
  // Deux couples de parents par branche, puis des enfants rattachés.
  for (let i = 0; i < 30; i++) {
    n++;
    const id = `${b}-${i}`;
    gens.push({
      id,
      first_name: `Prenom${n}`,
      last_name: `Nom${b}`,
      married_name: null,
      birth_year: 1900 + (n % 80),
      death_year: null,
      birth_display: null,
      deceased: false,
      father_id: i >= 4 ? `${b}-0` : null,
      mother_id: i >= 4 ? `${b}-1` : null,
      photo_url: i % 5 === 0 ? `photos/${id}.jpg` : null,
      sex: i % 2 ? "F" : "M",
      notes: null,
      nickname: null,
      branch: b,
    });
  }
}

let echecs = 0;
const parBranche = new Map(gens.map((p) => [p.id, p.branch]));

for (const cible of BRANCHES) {
  for (let essai = 0; essai < 200; essai++) {
    const qs = buildQuiz(gens, 10, "Bardin", 1, [], cible);
    for (const q of qs) {
      if (q.kind === "pays") {
        console.log(`❌ ${cible} : question de pays servie en mode strict`);
        echecs++;
        continue;
      }
      if (q.kind === "branche") {
        console.log(`❌ ${cible} : question « de quelle branche » servie en mode strict`);
        echecs++;
        continue;
      }
      const b = parBranche.get(q.personId);
      if (b !== cible) {
        console.log(`❌ ${cible} : sujet hors branche (${q.personId} est ${b})`);
        echecs++;
      }
    }
  }
  const ex = buildQuiz(gens, 10, "Bardin", 1, [], cible);
  console.log(`${cible} : ${ex.length} questions, types = ${[...new Set(ex.map((q) => q.kind))].join(", ")}`);
}

// Branche minuscule : la partie doit être PLUS COURTE, jamais complétée ailleurs.
const petite = gens.filter((p) => p.branch !== "Aubry").concat(
  [0, 1, 2].map((i) => ({ ...gens[i], id: `Lanvin-${i}`, branch: "Lanvin", father_id: null, mother_id: null, photo_url: null })),
);
const courte = buildQuiz(petite, 10, "Bardin", 1, [], "Lanvin");
const fuite = courte.filter((q) => !String(q.personId ?? "").startsWith("Lanvin"));
console.log(`Lanvin (3 fiches) : ${courte.length} questions, ${fuite.length} venues d'ailleurs`);
if (fuite.length) echecs++;

// Contrôle négatif : sans mode strict, le tirage doit ressortir de la branche.
const normal = buildQuiz(gens, 10, "Bardin", 3, []);
const varie = new Set(normal.filter((q) => q.personId).map((q) => parBranche.get(q.personId)));
console.log(`Contrôle négatif (niveau 3, pas de strict) : ${varie.size} branche(s) touchées`);
if (varie.size < 2) { console.log("❌ le contrôle négatif ne varie pas — le test ne prouverait rien"); echecs++; }

console.log(echecs === 0 ? "\n✅ TOUT PASSE" : `\n❌ ${echecs} ÉCHECS`);
