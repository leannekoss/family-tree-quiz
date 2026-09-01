import type { Question } from "@/lib/quiz";

/**
 * Le pays, pas la famille.
 *
 * 📍 EXEMPLE : ce fichier couvre le Lot-et-Garonne, la région de la famille de
 * démonstration. Remplacez ces questions par celles de votre propre région —
 * même forme, mêmes règles (ajouter à la fin, ne jamais insérer au milieu).
 *
 * La réunion se tient dans le Lot-et-Garonne, et une partie des convives n'y
 * met les pieds qu'une fois l'an. Ces questions-là ne demandent de connaître
 * personne : elles se répondent au flair ou s'apprennent en une seconde, et
 * elles donnent au quiz des respirations entre deux filiations.
 *
 * Elles sont écrites en dur plutôt que tirées de la base : ce sont des faits de
 * géographie et d'histoire, ils ne bougeront pas d'ici juin.
 *
 * Chaque fait a été vérifié à sa source. Une question de quiz fausse dans une
 * famille, c'est une légende qui circule ensuite pendant vingt ans.
 */
type Fait = {
  prompt: string;
  correct: string;
  wrong: [string, string, string];
  hint?: string;
  image?: { src: string; alt: string; credit: string };
};

const FAITS: Fait[] = [
  {
    prompt: "En quelle année la bastide de Monflanquin a-t-elle été fondée ?",
    correct: "1256",
    wrong: ["1156", "1356", "1456"],
    hint: "Le siècle de Saint Louis.",
    image: {
      src: "/pays/monflanquin.jpg",
      alt: "La bastide de Monflanquin perchée sur sa colline",
      credit: "Wikimedia Commons",
    },
  },
  {
    prompt: "Qui a fondé Monflanquin ?",
    correct: "Alphonse de Poitiers, frère de Saint Louis",
    wrong: [
      "Aliénor d'Aquitaine",
      "Le Prince Noir",
      "Henri IV, roi de Navarre",
    ],
    hint: "Il a créé une cinquantaine de bastides dans la région.",
  },
  {
    prompt: "Monflanquin fait partie d'un classement national. Lequel ?",
    correct: "Les Plus Beaux Villages de France",
    wrong: [
      "Le patrimoine mondial de l'UNESCO",
      "Les Villes d'art et d'histoire",
      "Les Grands Sites de France",
    ],
  },
  {
    prompt: "Ce château fort domine Saint-Front-sur-Lémance. Comment s'appelle-t-il ?",
    correct: "Bonaguil",
    wrong: ["Biron", "Duras", "Nérac"],
    hint: "L'un des derniers châteaux forts construits en France.",
    image: {
      src: "/pays/bonaguil.jpg",
      alt: "Le château de Bonaguil vu d'ensemble",
      credit: "Wikimedia Commons",
    },
  },
  {
    prompt: "Quelle rivière traverse Nérac, que l'on voit sur cette photo ?",
    correct: "La Baïse",
    wrong: ["Le Dropt", "La Lémance", "L'Auvignon"],
    image: {
      src: "/pays/nerac.jpg",
      alt: "Les bords de la Baïse à Nérac",
      credit: "Wikimedia Commons",
    },
  },
  {
    prompt: "Quels sont les deux cours d'eau qui donnent son nom au département ?",
    correct: "Le Lot et la Garonne",
    wrong: [
      "Le Lot et la Dordogne",
      "La Garonne et le Tarn",
      "La Garonne et la Baïse",
    ],
  },
  {
    prompt: "Quelle est la préfecture du Lot-et-Garonne ?",
    correct: "Agen",
    wrong: ["Villeneuve-sur-Lot", "Marmande", "Nérac"],
  },
  {
    prompt: "De quelle variété de prune vient le pruneau d'Agen ?",
    correct: "La prune d'ente",
    wrong: ["La mirabelle", "La quetsche", "La reine-claude"],
    hint: "« Enter » est un vieux mot pour greffer.",
  },
  {
    prompt: "Ce village perché domine Villeneuve-sur-Lot. Lequel est-ce ?",
    correct: "Pujols",
    wrong: ["Penne-d'Agenais", "Tournon-d'Agenais", "Monflanquin"],
    image: {
      src: "/pays/pujols.jpg",
      alt: "Le village perché de Pujols",
      credit: "Wikimedia Commons",
    },
  },
  {
    prompt: "Sous quelle souveraineté Monflanquin est-elle passée en 1282 ?",
    correct: "Anglaise",
    wrong: ["Espagnole", "Aquitaine indépendante", "Navarraise"],
    hint: "La guerre de Cent Ans se prépare.",
  },
  {
    prompt: "Quel écrivain a comparé le pays de Monflanquin à la Toscane ?",
    correct: "Stendhal",
    wrong: ["Montaigne", "François Mauriac", "Alexandre Dumas"],
  },

  // 🔑 Ajouts du 15/08, TOUJOURS À LA FIN. La question est identifiée par son
  // rang dans ce tableau — c'est ce rang qui voyage dans le cookie des
  // questions déjà vues. Insérer au milieu décalerait tout, et ferait revenir
  // des questions qu'un joueur croyait avoir passées.
  {
    prompt: "Quelle rivière traverse Monflanquin ?",
    correct: "La Lède",
    wrong: ["Le Dropt", "La Lémance", "Le Laussou"],
    hint: "Elle a donné son nom à Sauveterre-la-Lémance… mais ce n'est pas elle.",
  },
  {
    prompt: "En quelle année le département de Lot-et-Garonne a-t-il été créé ?",
    correct: "1790",
    wrong: ["1682", "1815", "1860"],
    hint: "Comme presque tous les départements français.",
  },
  {
    prompt: "Quelle ville du Lot-et-Garonne est connue pour sa tomate ?",
    correct: "Marmande",
    wrong: ["Tonneins", "Casteljaloux", "Aiguillon"],
  },
  {
    prompt: "Quel roi de France a passé sa jeunesse au château de Nérac ?",
    correct: "Henri IV",
    wrong: ["Louis XIII", "François Ier", "Charles VII"],
    hint: "Roi de Navarre avant d'être roi de France.",
  },
  {
    prompt: "Villeneuve-sur-Lot est, comme Monflanquin, une bastide. Qui l'a fondée ?",
    correct: "Alphonse de Poitiers",
    wrong: ["Édouard Ier d'Angleterre", "Philippe le Bel", "Raymond VII de Toulouse"],
    hint: "Le même homme, trois ans plus tôt.",
  },
  {
    prompt: "Monpazier, la bastide voisine au nord, se trouve dans quel département ?",
    correct: "La Dordogne",
    wrong: ["Le Lot-et-Garonne", "Le Lot", "La Gironde"],
  },
  {
    prompt: "Quelles sont les deux bastides voisines de Monflanquin sur la route de Bergerac ?",
    correct: "Villeréal et Castillonnès",
    wrong: [
      "Penne-d'Agenais et Tournon",
      "Duras et Miramont",
      "Fumel et Monsempron",
    ],
  },
  {
    prompt: "Quel vin porte le nom d'une ville du Lot-et-Garonne, sur la Baïse ?",
    correct: "Le buzet",
    wrong: ["Le madiran", "Le cahors", "Le pécharmant"],
  },
  {
    prompt: "Quel ouvrage du XIXe siècle traverse le département d'est en ouest, le long du fleuve ?",
    correct: "Le canal latéral à la Garonne",
    wrong: ["Le canal du Midi", "Le canal de Berry", "Le canal des Deux-Mers"],
    hint: "Il prolonge l'autre jusqu'à Bordeaux.",
  },
  {
    prompt: "Que s'est-il passé à Monflanquin en 1685, comme dans tout le royaume ?",
    correct: "La révocation de l'édit de Nantes",
    wrong: [
      "La construction de la halle",
      "Le rattachement à la France",
      "La grande peste",
    ],
    hint: "Les dragonnades, et la fuite des protestants vers la Hollande.",
  },
  {
    prompt: "Comment appelle-t-on la place centrale à arcades, typique des bastides ?",
    correct: "La place à couverts",
    wrong: ["Le cloître", "L'agora", "Le préau"],
    hint: "On dit aussi « les couverts » tout court.",
  },
  {
    prompt: "Dans quelle région administrative se trouve le Lot-et-Garonne ?",
    correct: "La Nouvelle-Aquitaine",
    wrong: ["L'Occitanie", "Le Midi-Pyrénées", "La Dordogne-Périgord"],
    hint: "Depuis la réforme de 2016.",
  },
];

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
