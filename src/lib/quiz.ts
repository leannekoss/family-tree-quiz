import { fullName, agrees } from "@/lib/types";
import { questionsPays } from "@/lib/pays";
import { campDe } from "@/lib/branches";

export type QuizPerson = {
  id: string;
  first_name: string;
  last_name: string;
  married_name: string | null;
  birth_year: number | null;
  death_year: number | null;
  birth_display: string | null;
  deceased: boolean;
  father_id: string | null;
  mother_id: string | null;
  branch: string | null;
  photo_url: string | null;
  sex: string | null;
  /** « En deux mots » de la fiche : la meilleure matière à apprendre. */
  notes: string | null;
  nickname: string | null;
};

export type Question = {
  kind: string;
  prompt: string;
  options: string[];
  answer: number;
  /** Nul pour les questions de pays : il n'y a pas de fiche derrière. */
  personId: string | null;
  hint?: string;
  image?: { src: string; alt: string; credit: string };
  /**
   * Chemin de la photo dans le stockage, pour les questions « qui est-ce ? ».
   * La page le remplace par un lien signé avant d'envoyer la question au
   * navigateur : le stockage est privé, un chemin nu n'affiche rien.
   */
  photo?: string;
  /**
   * Les quatre visages proposés, dans l'ordre des `options`, pour la question
   * « lequel de ces visages est X ? ». Comme `photo`, ce sont des chemins de
   * stockage que la page remplace par des liens signés.
   */
  photosOptions?: (string | undefined)[];
  /**
   * Renseigné quand la personne interrogée n'a pas encore de visage. Le quiz
   * s'en sert pour demander sa photo au seul moment où quelqu'un pense
   * précisément à elle.
   */
  sansPhoto?: string;
  /**
   * Une ou deux phrases sur la personne, affichées APRÈS la réponse — bonne ou
   * mauvaise. C'est ce qui distingue un quiz qui note d'un quiz qui apprend :
   * on repart toujours avec quelque chose à raconter à table.
   */
  apprendre?: string;
  /**
   * Le rang de la question de pays dans son catalogue. Il remonte jusqu'au
   * navigateur, qui garde la liste des questions déjà vues et la renvoie à la
   * partie suivante — sans quoi le hasard reproposerait sans cesse les mêmes.
   */
  cle?: number;
};

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Tire une personne en évitant celles déjà vues dans les parties récentes.
 * Retombe sur le vivier complet si tous ont déjà été vus.
 */
function pickFrais(gens: QuizPerson[], vues: Set<string>): QuizPerson {
  if (vues.size === 0) return pick(gens);
  const frais = gens.filter((p) => !vues.has(p.id));
  return frais.length > 0 ? pick(frais) : pick(gens);
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Mélange les propositions et retrouve où la bonne réponse a atterri.
 *
 * `annees` permet de départager deux homonymes. La famille en compte beaucoup :
 * **quatre Édouard Vernet** et **cinq Camille**. « Qui est frère ou sœur de
 * Nicole Perrin ? » a proposé côte à côte *Edouard Vernet* (son frère, né en
 * 1916) et *Edouard François Vernet* (son oncle, né en 1891) — deux lignes
 * qui se lisent pareil quand on a vingt secondes au chrono. La question n'était
 * pas difficile, elle était impossible.
 *
 * Quand deux propositions commencent par le même prénom, l'année s'ajoute à
 * TOUTES — jamais aux seules concernées, sinon l'indice s'inverse et c'est la
 * proposition nue qui devient reconnaissable. Même règle que pour le patronyme.
 */
function assemble(
  correct: string,
  wrong: string[],
  annees?: Map<string, number | null>,
): { options: string[]; answer: number } {
  let toutes = [correct, ...wrong];

  if (annees) {
    const prenom = (s: string) => s.split(" ")[0];
    const compte = new Map<string, number>();
    for (const o of toutes) compte.set(prenom(o), (compte.get(prenom(o)) ?? 0) + 1);
    const ambigu = [...compte.values()].some((n) => n > 1);

    if (ambigu) {
      const dater = (s: string) => {
        const a = annees.get(s);
        return a ? `${s} · ${a}` : s;
      };
      const datees = toutes.map(dater);
      // Si les dates manquent au point de ne rien départager, on garde les noms
      // nus : « Edouard · 1916 » et « Edouard » se distinguent, mais deux
      // « Edouard » sans date ne gagnent rien à être décorés à moitié.
      if (new Set(datees).size === datees.length) {
        const avant = correct;
        toutes = datees;
        correct = dater(avant);
      }
    }
  }

  const options = shuffle(toutes);
  return { options, answer: options.indexOf(correct) };
}

/**
 * Les questions sortent de la base, pas d'un modèle : une question de parenté
 * fausse serait pire qu'un quiz ennuyeux. Chaque génération vérifie d'abord
 * qu'elle a de quoi poser une question honnête, et rend null sinon.
 */
type Generator = (p: QuizPerson, all: QuizPerson[]) => Question | null;

const parentQuestion: Generator = (p, all) => {
  const parents = [p.father_id, p.mother_id]
    .map((id) => all.find((x) => x.id === id))
    .filter((x): x is QuizPerson => Boolean(x));
  if (parents.length === 0) return null;

  // Les mauvaises réponses viennent d'autres couples réels : un nom inventé se
  // repérerait d'un coup d'œil et la question n'apprendrait rien.
  // Elles doivent AUSSI avoir la même forme que la bonne : quand un seul parent
  // est connu, proposer trois couples ferait de la réponse seule la bonne, sans
  // rien savoir de la famille.
  // Dédupliqués : un couple de six enfants apparaîtrait six fois, et le compte
  // qui décide plus bas s'il existe assez de familles homonymes croirait en
  // avoir trois là où il n'y en a qu'une.
  const vusCouples = new Set<string>([`${p.father_id}|${p.mother_id}`]);
  const couples = all
    .filter((x) => x.id !== p.id)
    .map((x) => {
      const cle = `${x.father_id}|${x.mother_id}`;
      if (vusCouples.has(cle)) return null;
      const f = all.find((y) => y.id === x.father_id);
      const m = all.find((y) => y.id === x.mother_id);
      const couple = [f, m].filter(Boolean) as QuizPerson[];
      if (couple.length !== parents.length) return null;
      vusCouples.add(cle);
      return couple;
    })
    .filter((c): c is QuizPerson[] => c !== null);

  // « De qui Félix Velay est-il l'enfant ? » avec un seul couple Velay parmi
  // quatre se répond sans connaître personne : le patronyme désigne la réponse.
  //
  // Deux parades, dans cet ordre. D'abord chercher des couples qui portent le
  // même nom que le sujet — cousins, grands-oncles : le patronyme cesse alors
  // de trancher. Sur les données réelles, cela couvre un peu plus de la moitié
  // des cas.
  //
  // Pour l'autre moitié — les patronymes portés par une seule famille — aucun
  // distracteur ne peut partager le nom. On l'efface alors de TOUTES les
  // propositions : quatre couples de prénoms, et plus rien à recopier. Effacer
  // partout et non sur la seule bonne réponse, sinon l'indice s'inverse et
  // c'est la proposition nue qui devient la bonne.
  const memeNom = (c: QuizPerson[]) => c.some((y) => y.last_name === p.last_name);
  const assez = couples.filter(memeNom).length >= 3;
  const ecrire = (c: QuizPerson[]) =>
    (assez ? c.map((y) => fullName(y)) : c.map((y) => y.first_name)).join(" et ");

  const correct = ecrire(parents);
  const vus = new Set<string>([correct]);
  const wrong = (assez
    ? [...shuffle(couples.filter(memeNom)), ...shuffle(couples.filter((c) => !memeNom(c)))]
    : shuffle(couples)
  )
    .map(ecrire)
    .filter((t) => !vus.has(t) && vus.add(t))
    .slice(0, 3);
  if (wrong.length < 3) return null;

  return {
    kind: "parents",
    prompt: `De qui ${fullName(p)} ${agrees(p.sex, "est-il", "est-elle", "est-il ou est-elle")} l'enfant ?`,
    personId: p.id,
    ...assemble(correct, wrong),
  };
};

const ANNEE_COURANTE = 2026;

const birthQuestion: Generator = (p) => {
  if (!p.birth_year) return null;
  const correct = String(p.birth_year);

  // Des écarts assez larges pour que la réponse ne se devine pas au hasard,
  // assez serrés pour rester crédibles — et jamais dans le futur : proposer
  // 2030 pour une enfant née en 2021 désigne la bonne réponse à qui sait lire
  // un calendrier.
  const plafond = Math.min(p.death_year ?? ANNEE_COURANTE, ANNEE_COURANTE);
  const wrong = shuffle([-13, -11, -8, -6, -4, 3, 5, 7, 9])
    .map((d) => p.birth_year! + d)
    .filter((a) => a <= plafond && a > 1800 && a !== p.birth_year)
    .slice(0, 3)
    .map(String);
  if (wrong.length < 3) return null;

  return {
    kind: "naissance",
    prompt: `En quelle année ${agrees(p.sex, "est né", "est née", "est né·e")} ${fullName(p)} ?`,
    personId: p.id,
    ...assemble(correct, wrong),
  };
};

const siblingQuestion: Generator = (p, all) => {
  const sameParent = (a: QuizPerson, b: QuizPerson) =>
    (a.father_id && a.father_id === b.father_id) ||
    (a.mother_id && a.mother_id === b.mother_id);

  const siblings = all.filter((x) => x.id !== p.id && sameParent(x, p) && jouable(x));
  if (siblings.length === 0) return null;

  const correct = fullName(pick(siblings));

  // Le piège doit porter sur la parenté, pas sur le patronyme : en écartant les
  // homonymes, la bonne réponse devenait la seule à porter le même nom que le
  // sujet, et se trouvait sans rien connaître de la famille. On privilégie donc
  // au contraire les porteurs du même nom qui ne sont PAS de la fratrie —
  // cousins, oncles — et on complète avec d'autres si besoin.
  const notSibling = all.filter(
    (x) => x.id !== p.id && !sameParent(x, p) && jouable(x),
  );
  const sameName = notSibling.filter((x) => x.last_name === p.last_name);
  const pool = [...shuffle(sameName), ...shuffle(notSibling.filter((x) => x.last_name !== p.last_name))];

  const wrong = [...new Set(pool.map((x) => fullName(x)))]
    .filter((n) => n !== correct)
    .slice(0, 3);
  if (wrong.length < 3) return null;

  return {
    kind: "fratrie",
    prompt: `Qui est frère ou sœur de ${fullName(p)} ?`,
    personId: p.id,
    // C'est ici que l'ambiguïté est la plus vive : la règle ci-dessus choisit
    // exprès des porteurs du MÊME NOM hors de la fratrie — cousins, oncles —
    // pour que le patronyme ne trahisse pas. Elle a donc mis « Edouard
    // Vernet » (le frère) et « Edouard François Vernet » (l'oncle) dans
    // la même liste. Les dates les départagent sans rien révéler.
    ...assemble(correct, wrong, datesDe(all)),
  };
};

/**
 * Le nom affiché de chacun vers son année de naissance, pour départager les
 * homonymes. Deux personnes au nom rigoureusement identique s'écrasent — leur
 * question restera ambiguë, mais elles sont rares et la date, elle, ne ment pas.
 */
function datesDe(gens: QuizPerson[]): Map<string, number | null> {
  return new Map(gens.map((x) => [fullName(x), x.birth_year]));
}

const branchQuestion: Generator = (p, all) => {
  if (!p.branch) return null;

  // Les branches portent des patronymes. Demander de quelle branche descend un
  // Aubry quand « Aubry » est une des réponses ne teste rien : le nom se recopie
  // tout seul. On ne pose la question qu'à ceux dont le nom ne la donne pas.
  if (p.last_name === p.branch || p.married_name === p.branch) return null;

  const branches = [...new Set(all.map((x) => x.branch).filter(Boolean))] as string[];
  const wrong = shuffle(branches.filter((b) => b !== p.branch)).slice(0, 3);
  if (wrong.length < 3) return null;

  return {
    kind: "branche",
    prompt: `De quelle branche descend ${fullName(p)} ?`,
    // L'indice nomme les deux camps du classement, et pas seulement les
    // branches : c'est le même partage, et quelqu'un qui vient de lire « Moulin
    // mène de 743 points » doit retrouver ici les mots qu'il vient de voir.
    hint: "Six branches viennent des enfants d'Augustin Vernet et Blanche Delcourt — c'est le camp du Moulin. Chastel, Morel et Lanvin, les cousins du Lot-et-Garonne, forment celui de la Bastide.",
    personId: p.id,
    ...assemble(p.branch, wrong),
  };
};

/**
 * « Qui est-ce ? » — la question que le quiz devait poser depuis le début, et
 * qui attendait qu'il y ait des visages.
 *
 * Le portrait est montré, quatre noms sont proposés. Les distracteurs sont
 * choisis parmi les gens qui ont AUSSI une photo : sinon la partie révélerait,
 * à force, qui en a une et qui n'en a pas — et la bonne réponse finirait par se
 * deviner à ce détail plutôt qu'au visage.
 *
 * L'URL de l'image n'est pas posée ici : le stockage est privé, elle doit être
 * signée côté serveur. La question porte le chemin, la page le remplace par un
 * lien valable une heure.
 */
const photoQuestion: Generator = (p, all) => {
  if (!p.photo_url) return null;

  const autres = all.filter((x) => x.id !== p.id && x.photo_url && jouable(x));
  const correct = fullName(p);
  const wrong = [...new Set(shuffle(autres).map((x) => fullName(x)))]
    .filter((n) => n !== correct)
    .slice(0, 3);
  if (wrong.length < 3) return null;

  return {
    kind: "visage",
    prompt: "Qui est-ce ?",
    personId: p.id,
    photo: p.photo_url,
    // Même règle qu'ailleurs : devant un portrait, deux homonymes se
    // départagent par l'âge — et c'est justement ce qu'on lit sur un visage.
    ...assemble(correct, wrong, datesDe(all)),
  };
};

/**
 * « Laquelle de ces personnes est Hélène Chastel ? » — la question du visage,
 * prise par l'autre bout.
 *
 * 🔑 Elle vise le besoin exact qu'Camille a nommé : avant de savoir qui fait le
 * meilleur gâteau aux noix, il faut connaître les prénoms. Mesuré sur huit
 * parties réelles, la moitié des questions n'apprenait aucun prénom — année de
 * naissance, nombre d'enfants, nom de branche attendent un chiffre ou une
 * étiquette, pas un nom.
 *
 * 🔑 Et surtout elle multiplie le rendement du stock de photos SANS en exiger
 * une seule de plus : là où « qui est-ce ? » montre un visage, celle-ci en
 * montre QUATRE. Cent soixante et une photos pour six cent cinquante-six
 * personnes, c'est le plafond réel du quiz — aucun réglage de tirage ne
 * fabrique un visage qui n'existe pas, mais on peut faire travailler ceux qu'on
 * a deux fois mieux.
 *
 * Les intrus sont pris parmi ceux qui ont un visage, comme dans le sens direct :
 * sinon la bonne réponse se devinerait à la seule présence d'une photo.
 */
const visageInverseQuestion: Generator = (p, all) => {
  if (!p.photo_url) return null;

  const autres = shuffle(all.filter((x) => x.id !== p.id && x.photo_url && jouable(x)));
  // Trois intrus, et trois visages DISTINCTS : deux fois la même photo dans une
  // grille de quatre se voit immédiatement et donne la réponse par élimination.
  const intrus: QuizPerson[] = [];
  const vus = new Set([p.photo_url]);
  for (const x of autres) {
    if (vus.has(x.photo_url!) || fullName(x) === fullName(p)) continue;
    vus.add(x.photo_url!);
    intrus.push(x);
    if (intrus.length === 3) break;
  }
  if (intrus.length < 3) return null;

  // Le nom voyage dans `options` comme partout ailleurs — c'est lui que lisent
  // le récapitulatif de fin de partie et les lecteurs d'écran. La photo est un
  // second calque, aligné sur le même ordre : les deux se mélangent ENSEMBLE,
  // sinon le visage et le nom cessent de désigner la même personne.
  const paires = shuffle([p, ...intrus].map((x) => ({ nom: fullName(x), photo: x.photo_url! })));

  return {
    kind: "visage_inverse",
    // 🔑 « Laquelle de ces VISAGES est Billie ? » — l'accord suivait le sexe de
    // la personne alors qu'il se fait avec le nom qui suit. « Ces personnes »
    // règle les deux d'un coup : le mot est féminin quel que soit le sexe de
    // celui qu'on cherche, la phrase est donc invariable et toujours juste.
    prompt: `Laquelle de ces personnes est ${fullName(p)} ?`,
    personId: p.id,
    options: paires.map((x) => x.nom),
    photosOptions: paires.map((x) => x.photo),
    answer: paires.findIndex((x) => x.nom === fullName(p)),
  };
};

const childrenQuestion: Generator = (p, all) => {
  const n = all.filter((x) => x.father_id === p.id || x.mother_id === p.id).length;
  if (n === 0) return null;

  const candidates = [0, 1, 2, 3, 4, 5, 6].filter((v) => v !== n);
  const wrong = shuffle(candidates).slice(0, 3).map(String);

  return {
    kind: "enfants",
    prompt: `Combien ${fullName(p)} ${agrees(p.sex, "a-t-il", "a-t-elle", "a-t-il ou a-t-elle")} eu d'enfants ?`,
    personId: p.id,
    ...assemble(String(n), wrong),
  };
};

/**
 * Questions rigolotes : un intrus non humain glissé parmi les visages.
 * Une par partie au maximum, toujours bonne réponse = le vrai membre.
 * Le but : faire rire ET obliger à regarder les quatre photos.
 */
const INTRUS_RIGOLOS = [
  { nom: "La poule de Monflanquin", image: "/quiz/poule.svg" },
  { nom: "Le mouton du Moulin", image: "/quiz/mouton.svg" },
  { nom: "Colonel Moutarde", image: "/quiz/colonel.svg" },
  { nom: "Le chat de la maison", image: "/quiz/chat.svg" },
];

const intrusQuestion: Generator = (p, all) => {
  if (!p.photo_url) return null;

  const autres = shuffle(all.filter((x) => x.id !== p.id && x.photo_url && jouable(x)));
  const intrus: QuizPerson[] = [];
  const vus = new Set([p.photo_url]);
  for (const x of autres) {
    if (vus.has(x.photo_url!) || fullName(x) === fullName(p)) continue;
    vus.add(x.photo_url!);
    intrus.push(x);
    if (intrus.length === 2) break;
  }
  if (intrus.length < 2) return null;

  const rigolo = pick(INTRUS_RIGOLOS);
  const paires = shuffle([
    { nom: fullName(p), photo: p.photo_url! },
    ...intrus.map((x) => ({ nom: fullName(x), photo: x.photo_url! })),
    { nom: rigolo.nom, photo: rigolo.image },
  ]);

  return {
    kind: "intrus",
    prompt: `Laquelle de ces personnes est ${fullName(p)} ?`,
    personId: p.id,
    options: paires.map((x) => x.nom),
    photosOptions: paires.map((x) => x.photo),
    answer: paires.findIndex((x) => x.nom === fullName(p)),
  };
};

const GENERATORS: Generator[] = [
  photoQuestion,
  visageInverseQuestion,
  parentQuestion,
  birthQuestion,
  siblingQuestion,
  branchQuestion,
  childrenQuestion,
];

/** Les deux formes de question de visage, qui partagent le même quota. */
const VISAGE_GENERATORS: Generator[] = [photoQuestion, visageInverseQuestion];

/**
 * Tout sauf les visages, tirés à part pour tenir leur quota — et PONDÉRÉ.
 *
 * 🔑 Les cinq générateurs étaient tirés à égalité, et trois d'entre eux
 * n'enseignent aucun prénom : l'année de naissance attend un chiffre, le nombre
 * d'enfants aussi, la branche une étiquette. Mesuré sur huit parties réelles,
 * cela faisait 2,9 questions sur dix à ne nommer personne — plus les deux
 * questions de région, soit près de la moitié d'une partie.
 *
 * Ils ne sont pas retirés : une famille se connaît aussi par ses dates et ses
 * maisons, et un quiz de dix questions toutes identiques lasse. Ils sont
 * rendus RARES. La répétition d'un générateur dans la liste EST sa pondération
 * — quatre parts pour ceux qui font dire un nom, une pour les autres.
 */
const AUTRES_GENERATORS: Generator[] = [
  parentQuestion,
  parentQuestion,
  parentQuestion,
  parentQuestion,
  siblingQuestion,
  siblingQuestion,
  siblingQuestion,
  siblingQuestion,
  birthQuestion,
  branchQuestion,
  childrenQuestion,
];

/**
 * Un enfant mort en bas âge n'a pas sa place dans un jeu. Ces personnes restent
 * dans l'arbre et dans la recherche — les effacer serait pire — mais le quiz ne
 * les prend ni comme sujet ni comme proposition. Elles continuent de compter
 * dans le nombre d'enfants de leurs parents : la question reste juste.
 */
const MAJORITE = 18;

function jouable(p: QuizPerson): boolean {
  if (!p.deceased) return true;
  if (p.birth_year === null || p.death_year === null) return true;
  return p.death_year - p.birth_year >= MAJORITE;
}

/**
 * Ce qu'on retient de la personne, composé depuis la BASE — jamais inventé.
 *
 * Priorité au champ « En deux mots » : c'est la famille qui l'a écrit, rien ne
 * fait mieux. À défaut, la fiche se raconte elle-même : les années, les
 * parents, la fratrie, la branche. Chaque morceau n'apparaît que si la donnée
 * existe — une phrase à trous vaut moins que pas de phrase.
 */
/**
 * Ce qui, dans « En deux mots », s'adresse à un JOUEUR — et ce qui ne s'adresse
 * qu'à celui qui tient l'arbre.
 *
 * 🔑 Le champ a été rempli à l'import, pas par la famille. Relevé le 22/08/2026
 * sur les six cent cinquante-sept fiches : cent soixante-quinze portent une
 * note, dont **cent dix-sept sont une référence de source** (« La Gazette n° 12,
 * page 35 », cent dix fois) et **cinquante-deux une annotation de travail**
 * (« nom déduit de la fratrie, non lu dans le bulletin », quarante-quatre
 * fois). Quatre seulement racontent quelque chose — un métier, un cimetière.
 *
 * Ce n'est pas qu'un affichage disgracieux. Une note COURT-CIRCUITE la phrase
 * composée juste en dessous : pour ces cent soixante-neuf personnes, le joueur
 * recevait un numéro de page à la place de « fils d'Untel, dans une fratrie
 * avec Untel, branche Perrin » — c'est-à-dire à la place de ce qu'il est venu
 * chercher. Un numéro de bulletin n'a jamais aidé personne à reconnaître un
 * cousin.
 *
 * La note n'est pas effacée : elle reste sur la fiche, où elle a toute sa place
 * — savoir d'où vient une information est le cœur du travail. Elle est
 * seulement écartée du JEU.
 */
const NOTE_DE_TRAVAIL =
  /la gazette n°|page \d+|descendance|déduit|non lu|bulletin|gedcom|à (?:con|vé)firmer|à vérifier|non prouvé|supposé|incertain|hypothèse|rattachement|transcription|au chargement|corrigé le|sources? généalogique/i;

/**
 * Une note ne sert au jeu que si elle raconte la personne. Dans le doute on
 * écarte : la phrase composée depuis la base est toujours disponible et
 * toujours juste, alors qu'une note mal jugée s'affiche telle quelle.
 */
export const noteJouable = (notes: string | null): boolean =>
  Boolean(notes) && !NOTE_DE_TRAVAIL.test(notes!);

function aRetenir(p: QuizPerson, all: QuizPerson[]): string | undefined {
  const nom = fullName(p);
  if (noteJouable(p.notes)) return `${nom} : ${p.notes}`;

  const bouts: string[] = [];

  if (p.birth_year && p.deceased && p.death_year) {
    bouts.push(`${p.birth_year}–${p.death_year}, ${agrees(p.sex, "il", "elle", "il ou elle")} a vécu ${p.death_year - p.birth_year} ans`);
  } else if (p.birth_year && !p.deceased) {
    bouts.push(`${ANNEE_COURANTE - p.birth_year} ans`);
  }

  const pere = all.find((x) => x.id === p.father_id);
  const mere = all.find((x) => x.id === p.mother_id);
  if (pere || mere) {
    const noms = [pere, mere].filter(Boolean).map((x) => x!.first_name).join(" et ");
    // « de Édouard » écorche l'œil : l'élision est ce qui distingue une phrase
    // écrite d'une phrase assemblée.
    const de = /^[aeiouyéèêëàâîïôûü]/i.test(noms) ? "d'" : "de ";
    bouts.push(`${agrees(p.sex, "fils", "fille", "enfant")} ${de}${noms}`);
  }

  const fratrie = all.filter(
    (x) =>
      x.id !== p.id &&
      ((p.father_id && x.father_id === p.father_id) ||
        (p.mother_id && x.mother_id === p.mother_id)),
  );
  if (fratrie.length > 0) {
    const prenoms = fratrie.slice(0, 3).map((x) => x.first_name).join(", ");
    bouts.push(
      fratrie.length <= 3
        ? `dans une fratrie avec ${prenoms}`
        : `dans une fratrie de ${fratrie.length + 1} : ${prenoms}…`,
    );
  }

  const enfants = all.filter((x) => x.father_id === p.id || x.mother_id === p.id);
  if (enfants.length > 1) bouts.push(`${enfants.length} enfants`);

  if (p.branch) {
    const camp = campDe(p.branch);
    bouts.push(camp ? `branche ${p.branch}, camp ${camp === "Moulin" ? "du Moulin" : "de la Bastide"}` : `branche ${p.branch}`);
  }

  if (bouts.length === 0) return undefined;
  return `${nom} — ${bouts.join(" · ")}.`;
}

/**
 * Deux questions de pays sur dix. Assez pour souffler entre deux filiations et
 * pour que ceux qui connaissent mal la famille marquent quand même des points ;
 * pas assez pour que le quiz devienne un jeu de géographie.
 */
const PART_PAYS = 0.2;

/**
 * Deux portraits sur dix, garantis.
 *
 * « Qui est-ce ? » est la question que tout le monde vient chercher, et c'était
 * la plus rare : le tirage uniforme la donnait 94 fois sur 1481, soit 6 % — une
 * partie sur deux n'en contenait aucune, et l'audit du 11/08 n'a jamais réussi
 * à en faire sortir une en quinze tirages. Le générateur allait bien ; c'est le
 * hasard qui l'enterrait, parce que 94 personnes seulement ont un visage quand
 * 392 ont une année de naissance.
 *
 * Un quota, comme pour les questions de pays. Il montera quand la famille aura
 * déposé davantage de portraits : 94 visages permettent 47 parties sans jamais
 * reposer la même question.
 */
const PART_VISAGES = 0.2;

/**
 * Six questions sur dix chez soi, quand on a dit d'où l'on est.
 *
 * Le tirage était uniforme sur quatre cent soixante-sept fiches, et un tirage
 * uniforme n'est équitable que si tout le monde connaît tout le monde. Personne
 * ne connaît quatre cent soixante-sept personnes. Antoinette Chastel l'a dit
 * autrement — « le quiz est trop dur pour moi » — mais ce n'est pas de la
 * difficulté : sur dix questions, 1,6 portait sur sa branche, et sa branche est
 * pourtant la plus nombreuse de l'arbre.
 *
 * 🔑 Six et non dix. Un filtre strict enfermerait chacun chez soi, alors que
 * l'arbre existe pour découvrir les cousins qu'on ne connaît pas — et il
 * tuerait le duel entre branches, qui est ce qui fait courir tout le monde. On
 * commence par ce qu'on connaît, on finit ailleurs.
 */
const PART_MA_BRANCHE = 0.4;
const PART_COUSINS = 0.2;

/**
 * Tire une personne en visant une branche, sans jamais s'y enfermer.
 *
 * Retourne null plutôt que de boucler quand la branche visée n'a personne à
 * offrir : c'est l'appelant qui décide de retomber sur le tirage général. Les
 * Lanvin sont onze — un quiz qui exigerait six questions chez eux ne se
 * remplirait jamais.
 */
function pickDans(gens: QuizPerson[], branche: string | null, vues: Set<string> = new Set()): QuizPerson | null {
  if (!branche) return gens.length ? pickFrais(gens, vues) : null;
  const dedans = gens.filter((p) => p.branch === branche);
  return dedans.length ? pickFrais(dedans, vues) : null;
}

export function buildQuiz(
  all: QuizPerson[],
  count = 10,
  maBranche: string | null = null,
  niveau: 1 | 2 | 3 = 1,
  paysVus: number[] = [],
  stricte: string | null = null,
  /** Personnes déjà interrogées dans les parties récentes. Le tirage les évite
   *  tant que des personnes fraîches existent, puis s'y rabat. */
  personnesVues: Set<string> = new Set(),
): Question[] {
  const questions: Question[] = [];
  const seen = new Set<string>();

  // `all` sert à résoudre les liens (les parents doivent rester trouvables),
  // `jouables` à choisir qui apparaît dans une question.
  const jouables = all.filter(jouable);
  if (jouables.length === 0) return [];

  // Le vivier du niveau. Les LIENS continuent de se résoudre dans `all` : la
  // mère d'un Chastel peut être une Vernet, la question reste juste — c'est
  // le SUJET de la question qui reste dans le vivier, pas sa réponse.
  const monCamp = campDe(maBranche);
  const vivier = stricte
    ? // Tout le reste du tirage dérive du vivier — les portraits comme les
      // questions de famille — donc le restreindre ici suffit : aucun repli
      // `?? pick(...)` ne peut ramener quelqu'un d'une autre branche.
      jouables.filter((p) => p.branch === stricte)
    : niveau === 3
      ? jouables
      : niveau === 2
        ? jouables.filter((p) => campDe(p.branch) !== monCamp || p.branch === null)
        : monCamp
          ? jouables.filter((p) => campDe(p.branch) === monCamp)
          : jouables;
  if (vivier.length === 0) return [];

  // Combien de questions de famille doivent viser sa branche. Le compte se tient
  // pendant le tirage : au-delà, on repasse au camp entier. Aux niveaux 2 et 3
  // il n'y a pas de chez-soi : pas de quota.
  // En mode strict le vivier EST la branche : un quota qui viserait `maBranche`
  // ne ferait qu'échouer à chaque tirage pour retomber sur le même vivier.
  let quotaBranche =
    !stricte && maBranche && niveau === 1 ? Math.round(count * PART_MA_BRANCHE) : 0;
  let quotaCousins =
    !stricte && maBranche && monCamp && niveau === 1 ? Math.round(count * PART_COUSINS) : 0;

  // Vers qui le tirage penche. Le quota ne couvrait pas les portraits, qui
  // visaient sa branche à tous les niveaux : au niveau 3 les deux visages
  // seraient donc restés chez soi alors qu'on demande le hasard.
  const viser = stricte ? null : niveau === 1 ? maBranche : null;

  // Les questions de pays prennent leur place dans les dix, elles ne s'ajoutent
  // pas par-dessus : une partie doit durer ce qu'elle annonce.
  const combienPays = stricte ? 0 : Math.round(count * PART_PAYS);
  const combienFamille = count - combienPays;

  // Les portraits d'abord, pour que le quota soit tenu avant que le reste
  // remplisse la partie. On ne demande jamais plus de visages qu'il n'y en a :
  // le quota est un plancher souhaité, pas une promesse que la base ne peut pas
  // tenir.
  const avecVisage = vivier.filter((p) => p.photo_url);
  const combienVisages = Math.min(
    Math.round(count * PART_VISAGES),
    avecVisage.length,
    combienFamille,
  );
  for (let tries = 0; tries < count * 40 && questions.length < combienVisages; tries++) {
    // Les visages de sa branche d'abord — mais sans insister au-delà de la
    // moitié des essais. Les Chastel n'ont qu'UNE photo pour soixante-quinze
    // personnes : s'obstiner ne produirait pas une question de plus, seulement
    // une partie sans portrait du tout.
    const person =
      (tries < count * 20 ? pickDans(avecVisage, viser, personnesVues) : null) ?? pickFrais(avecVisage, personnesVues);
    // Les deux sens du même exercice, tirés au hasard : reconnaître un visage,
    // ou retrouver quelqu'un parmi quatre. Le second montre quatre têtes au lieu
    // d'une — à quota inchangé, une partie fait donc voir cinq visages en
    // moyenne au lieu de deux.
    const useIntrus = !seen.has("intrus") && Math.random() < 0.35;
    const q = useIntrus
      ? intrusQuestion(person, all)
      : pick(VISAGE_GENERATORS)(person, all);
    if (!q) continue;

    const key = `visage:${q.personId}`;
    if (seen.has(key)) continue;
    if (q.kind === "intrus") seen.add("intrus");

    // Le portrait compte DANS le quota de branche, il ne s'y ajoute pas. Sans
    // cette ligne, les deux visages venaient en supplément des six questions
    // visées : mesuré à huit questions sur dix chez soi au lieu de six — la
    // découverte des autres branches passait de quatre questions à deux.
    if (person.branch === maBranche) quotaBranche--;

    seen.add(key);
    questions.push({ ...q, apprendre: aRetenir(person, all) });
  }

  /**
   * 🔑 « De quelle branche descend X ? » n'a plus de sens quand toute la partie
   * tient dans UNE branche : la réponse est la même aux dix questions, et le
   * joueur apprend à cliquer sur « Rouvière » sans regarder le nom. Une question
   * dont la réponse est écrite dans le titre de la partie n'est pas une
   * question — on la retire plutôt que de la laisser meubler.
   */
  const generateurs = stricte
    ? AUTRES_GENERATORS.filter((g) => g !== branchQuestion)
    : AUTRES_GENERATORS;

  // On tire au sort jusqu'à en avoir assez, sans jamais interroger deux fois la
  // même personne sur le même angle. La borne évite la boucle infinie quand la
  // base est trop pauvre pour honorer la demande.
  for (let tries = 0; tries < count * 40 && questions.length < combienFamille; tries++) {
    // Tant que le quota n'est pas rempli, on vise sa branche ; ensuite le
    // tirage redevient celui de toute la famille. `??` fait le reste : une
    // branche qui n'a plus personne à offrir rend la main sans bloquer.
    const cousins = vivier.filter((p) => p.branch !== maBranche);
    const person =
      (quotaBranche > 0 ? pickDans(vivier, maBranche, personnesVues) : null)
      ?? (quotaCousins > 0 && cousins.length > 0 ? pickFrais(cousins, personnesVues) : null)
      ?? pickFrais(vivier, personnesVues);
    // Les portraits ont eu leur tour juste au-dessus : les remettre dans le
    // tirage général ferait dépasser le quota sans le dire.
    const generator = pick(generateurs);
    const q = generator(person, all);
    if (!q) continue;

    const key = `${q.kind}:${q.personId}`;
    if (seen.has(key)) continue;

    if (person.branch === maBranche) quotaBranche--;
    else if (quotaCousins > 0) quotaCousins--;

    seen.add(key);
    q.apprendre = aRetenir(person, all);
    // Demander une photo dans le vide ne donne rien ; la demander à quelqu'un
    // qui vient de réfléchir à cette personne précise, si. On marque donc la
    // question plutôt que d'ajouter un rappel général quelque part.
    questions.push(person.photo_url ? q : { ...q, sansPhoto: fullName(person) });
  }

  // Les portraits ayant été tirés en premier pour tenir leur quota, ils
  // occuperaient sinon les deux premières places de chaque partie — une routine
  // au lieu d'une surprise. On rebat les questions de famille entre elles.
  questions.splice(0, questions.length, ...shuffle(questions));

  // Les questions de pays sont réparties dans la partie plutôt que groupées à
  // la fin : deux respirations au milieu valent mieux qu'un bloc de géographie
  // après huit filiations.
  const pays = questionsPays(combienPays, paysVus);
  for (const q of pays) {
    if (questions.length === 0) {
      questions.push(q);
      continue;
    }
    // Jamais en première position : la partie doit s'ouvrir sur la famille,
    // c'est ce qu'on est venu chercher.
    const place = 1 + Math.floor(Math.random() * questions.length);
    questions.splice(place, 0, q);
  }

  return questions;
}
