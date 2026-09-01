/**
 * Toutes les formes de parenté que le site peut afficher, en une page.
 *
 * Le nommage français ne se vérifie pas sur trois exemples : les erreurs se
 * cachent aux angles (l'oncle qui devient neveu quand on inverse, le pluriel
 * d'un ancêtre seul, l'accord au féminin d'un mot composé). La matrice complète
 * tient sur un écran et se relit à l'œil — un cousinage faux s'y voit tout de
 * suite, alors qu'il passerait inaperçu dans une fiche isolée.
 *
 *   npx tsx scripts/verifier-parente.ts
 */
import { decrireParente, type Parente } from "../src/lib/parente";

const anc = (n: string, sex: string) => ({
  id: n,
  first_name: n,
  last_name: "Vernet",
  married_name: null,
  sex,
});

const MAX = 5;

console.log("\n  RELATION DE SANG — colonnes : générations qui me séparent de l'ancêtre\n");
console.log(
  "  cible↓ moi→ " + Array.from({ length: MAX + 1 }, (_, i) => String(i).padEnd(34)).join(""),
);

for (let dc = 0; dc <= MAX; dc++) {
  const ligne: string[] = [];
  for (let dm = 0; dm <= MAX; dm++) {
    if (dc === 0 && dm === 0) {
      ligne.push("—".padEnd(34));
      continue;
    }
    const p: Parente = {
      relation: "sang",
      d_cible: dc,
      d_moi: dm,
      parents_communs: dc === 1 && dm === 1 ? 2 : 1,
      ancetres: [anc("Jean", "M"), anc("Anne", "F")],
      conjoint: null,
    };
    const r = decrireParente(p, false);
    ligne.push((r?.titre ?? "?").padEnd(34));
  }
  console.log(`     ${dc}       ` + ligne.join(""));
}

console.log("\n  MÊME MATRICE AU FÉMININ (les mots composés sont le piège)\n");
for (let dc = 0; dc <= MAX; dc++) {
  const ligne: string[] = [];
  for (let dm = 0; dm <= MAX; dm++) {
    if (dc === 0 && dm === 0) {
      ligne.push("—".padEnd(34));
      continue;
    }
    const r = decrireParente(
      {
        relation: "sang",
        d_cible: dc,
        d_moi: dm,
        parents_communs: dc === 1 && dm === 1 ? 2 : 1,
        ancetres: [anc("Jean", "M"), anc("Anne", "F")],
        conjoint: null,
      },
      true,
    );
    ligne.push((r?.titre ?? "?").padEnd(34));
  }
  console.log(`     ${dc}       ` + ligne.join(""));
}

console.log("\n  CAS PARTICULIERS\n");
const cas: [string, Parente, boolean][] = [
  [
    "demi-sœur (un seul parent commun)",
    { relation: "sang", d_cible: 1, d_moi: 1, parents_communs: 1, ancetres: [anc("Jean", "M")], conjoint: null },
    true,
  ],
  [
    "sœur (deux parents communs)",
    { relation: "sang", d_cible: 1, d_moi: 1, parents_communs: 2, ancetres: [anc("Jean", "M"), anc("Anne", "F")], conjoint: null },
    true,
  ],
  [
    "épouse d'un cousin germain",
    {
      relation: "alliance",
      d_cible: 2,
      d_moi: 2,
      parents_communs: 2,
      ancetres: [anc("Jean", "M"), anc("Anne", "F")],
      conjoint: { id: "c", first_name: "Nicolas", last_name: "Bardin", married_name: null, sex: "M" },
    },
    true,
  ],
  [
    "époux d'une sœur (beau-frère)",
    {
      relation: "alliance",
      d_cible: 1,
      d_moi: 1,
      parents_communs: 2,
      ancetres: [anc("Jean", "M"), anc("Anne", "F")],
      conjoint: { id: "c", first_name: "Marine", last_name: "Vernet", married_name: null, sex: "F" },
    },
    false,
  ],
  ["mon conjoint", { relation: "conjoint", d_cible: 0, d_moi: 0, parents_communs: null, ancetres: null, conjoint: null }, true],
  ["moi-même", { relation: "soi", d_cible: 0, d_moi: 0, parents_communs: null, ancetres: null, conjoint: null }, false],
  ["membre qui n'a pas dit qui il est", { relation: "inconnu", d_cible: null, d_moi: null, parents_communs: null, ancetres: null, conjoint: null }, false],
];

for (const [nom, p, fem] of cas) {
  const r = decrireParente(p, fem);
  console.log(`  ${nom.padEnd(38)} → ${r?.titre ?? "(rien)"}`);
  if (r?.detail) console.log(`  ${" ".repeat(38)}   ${r.detail}`);
}

console.log("\n  LIGNE DE DÉTAIL, ancêtre seul vs couple\n");
for (const [n, ancetres] of [
  ["couple", [anc("Jean", "M"), anc("Anne", "F")]],
  ["un seul", [anc("Anne", "F")]],
] as const) {
  const r = decrireParente(
    { relation: "sang", d_cible: 3, d_moi: 3, parents_communs: 2, ancetres: [...ancetres], conjoint: null },
    false,
  );
  console.log(`  ${n.padEnd(10)} → ${r?.titre}\n             ${r?.detail}`);
}
console.log();
