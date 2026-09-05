/**
 * LA famille : tout ce qui la nomme est écrit ici, et nulle part ailleurs.
 *
 * Changer de famille, c'est changer ce fichier — le titre, les branches, les
 * camps du duel, la racine de l'arbre, les questions « hors famille » du quiz.
 * Le reste du site n'écrit jamais un nom de famille en dur : il lit ici.
 *
 * Cette version est celle de la démo publique : la descendance de la reine
 * Victoria, importée depuis Wikidata (voir `scripts/import-wikidata/`).
 */

export const NOM_FAMILLE = "Windsor";
export const TITRE = "La famille Windsor";
export const SOUS_TITRE = "la descendance de la reine Victoria";

/**
 * Le bulletin familial d'où vient le relevé, s'il existe (« La Gazette » pour
 * la famille de démonstration Vernet-Delcourt). Null : les phrases qui le
 * citent se taisent ou se font neutres.
 */
export const BULLETIN: string | null = null;

/** Celui ou celle qui tient l'arbre, tel qu'on le nomme dans les pages. */
export const NOM_GARDIEN = "le gardien de l'arbre";

/**
 * Démo publique : le code famille est connu de tous, on ne le demande donc pas.
 * Renseigné, le formulaire d'entrée cache le champ et l'envoie lui-même ; null
 * (une vraie famille), le code se transmet de vive voix et se saisit.
 */
export const CODE_PUBLIC: string | null = "windsor";

/**
 * La carte « Qui habite où ». Le Plan IGN nomme les lieux-dits et les fermes
 * isolées, mais s'arrête aux frontières françaises : une famille européenne
 * prend OpenStreetMap. `centre` sert quand aucune maison n'est encore posée.
 */
export const CARTE: { fond: "ign" | "osm"; centre: [number, number] } = {
  fond: "osm",
  centre: [51.5014, -0.1419], // palais de Buckingham
};

/**
 * Une branche de plus au classement, pour ceux qui ne sont d'aucune : les
 * visiteurs de la démo jouent « pour les invités » et se retrouvent entre
 * eux au tableau. Null pour une vraie famille : tout le monde a une branche.
 */
export const BRANCHE_INVITES: string | null = "Les invités";

/** Les trois promesses de la page d'entrée, sous le bouton. */
export const PROMESSES: string[] = [
  "1 725 fiches, un quiz, la carte des résidences royales",
  "Une démo publique, hébergée en France",
  "Rien à créer, rien à recevoir, rien à retenir",
];

/**
 * La racine par défaut de l'arbre : Victoria. C'est l'uuid5 de son QID
 * Wikidata (Q9439) dans l'espace de noms DNS — la même clé que l'import.
 */
export const RACINE = "00926977-36e7-5803-9fcf-6cbf03b410af";

/**
 * La fiche du gardien : une fiche fictive « Le gardien de l'arbre », hors
 * quiz, insérée par le seed Windsor. Écrite ici plutôt que cherchée en base :
 * le pied de page est rendu partout.
 */
export const FICHE_GARDIEN = "a0000000-0000-4000-8000-0000000000ff";

/**
 * Les branches : les neuf enfants de Victoria, dans l'ordre de naissance.
 * `nom` est exactement `branches.name` en base ; `couleur` est une variable
 * CSS de `globals.css` (voir les commentaires sur l'écart minimal entre
 * teintes, mesuré et non estimé).
 */
export const BRANCHES: Record<number, { nom: string; couleur: string }> = {
  21: { nom: "Prusse", couleur: "var(--branche-prusse)" }, // Victoria, princesse royale
  22: { nom: "Hesse", couleur: "var(--branche-hesse)" }, // Alice
  23: { nom: "Cobourg", couleur: "var(--branche-cobourg)" }, // Alfred
  24: { nom: "Édouard VII", couleur: "var(--branche-edouard)" },
  25: { nom: "Albany", couleur: "var(--branche-albany)" }, // Leopold
  26: { nom: "Connaught", couleur: "var(--branche-connaught)" }, // Arthur
  27: { nom: "Battenberg", couleur: "var(--branche-battenberg)" }, // Beatrice
  28: { nom: "Schleswig-Holstein", couleur: "var(--branche-schleswig)" }, // Helena
  29: { nom: "Argyll", couleur: "var(--branche-argyll)" }, // Louise
};

/**
 * Les deux camps du duel. Les branches restées en Grande-Bretagne contre
 * celles parties régner sur le continent. Une branche absente d'ici n'a pas
 * de camp : elle est à tout le monde.
 */
export const CAMPS: Record<string, string[]> = {
  Windsor: ["Édouard VII", "Connaught", "Battenberg", "Schleswig-Holstein", "Argyll"],
  Continent: ["Prusse", "Hesse", "Cobourg", "Albany"],
};

/** Un blason par camp : il se lit avant le nom, comme un maillot. */
export const EMOJI_CAMP: Record<string, string> = { Windsor: "👑", Continent: "🏰" };

/** L'indice de la question « de quelle branche descend X ? ». */
export const INDICE_CAMPS =
  "Cinq branches sont restées en Grande-Bretagne — c'est le camp Windsor. Prusse, Hesse, Cobourg et Albany, parties régner sur le continent, forment celui du Continent.";

/** Le thème des questions hors famille, tel qu'il se dit dans le quiz. */
export const THEME_PAYS = "la couronne";

export type QuestionPays = {
  prompt: string;
  correct: string;
  wrong: [string, string, string];
  hint?: string;
  image?: { src: string; alt: string; credit: string };
};

/**
 * Les questions hors famille : la couronne, pas les cousins.
 *
 * Chaque fait est vérifié à sa source (Wikidata / Wikipédia, en commentaire).
 * Ajouter à la fin, ne jamais insérer au milieu : le rang voyage jusqu'au
 * navigateur, qui s'en sert pour ne pas reposer deux fois la même question.
 */
export const QUESTIONS_PAYS: QuestionPays[] = [
  {
    // Wikidata Q9439 : début de règne 20 juin 1837.
    prompt: "En quelle année Victoria monte-t-elle sur le trône ?",
    correct: "1837",
    wrong: ["1819", "1840", "1851"],
    hint: "Elle avait dix-huit ans.",
  },
  {
    // Wikipédia « Albert de Saxe-Cobourg-Gotha » : mariage le 10 février 1840.
    prompt: "En quelle année Victoria épouse-t-elle Albert de Saxe-Cobourg-Gotha ?",
    correct: "1840",
    wrong: ["1837", "1845", "1861"],
    hint: "Trois ans après son avènement.",
  },
  {
    // Wikidata Q9439, propriété « enfant » : neuf enfants.
    prompt: "Combien d'enfants Victoria et Albert ont-ils eus ?",
    correct: "Neuf",
    wrong: ["Cinq", "Sept", "Onze"],
    hint: "Une branche de l'arbre par enfant.",
  },
  {
    // Wikipédia « Maison Windsor » : proclamation du 17 juillet 1917.
    prompt: "En quelle année la famille royale prend-elle le nom de Windsor ?",
    correct: "1917",
    wrong: ["1901", "1910", "1936"],
    hint: "En pleine guerre contre l'Allemagne, un nom allemand pesait.",
  },
  {
    // Wikipédia « Maison Windsor » : sous George V.
    prompt: "Quel roi a donné à la famille le nom de Windsor ?",
    correct: "George V",
    wrong: ["Édouard VII", "Édouard VIII", "George VI"],
  },
  {
    // Wikidata Q9682 : règne du 6 février 1952 au 8 septembre 2022.
    prompt: "Combien d'années Elizabeth II a-t-elle régné ?",
    correct: "70 ans",
    wrong: ["50 ans", "63 ans", "75 ans"],
    hint: "De 1952 à 2022 : le plus long règne britannique.",
  },
  {
    // Wikidata Q20875 : abdication le 11 décembre 1936.
    prompt: "Quel roi a abdiqué en 1936 ?",
    correct: "Édouard VIII",
    wrong: ["George V", "George VI", "Édouard VII"],
    hint: "Pour épouser Wallis Simpson.",
  },
  {
    // Wikipédia « Philip Mountbatten » : arrière-petit-fils de Victoria par Alice, grande-duchesse de Hesse.
    prompt: "Par quelle branche le prince Philip descend-il de Victoria ?",
    correct: "Hesse",
    wrong: ["Prusse", "Cobourg", "Argyll"],
    hint: "Par sa mère, Alice de Battenberg, petite-fille d'Alice de Hesse.",
  },
  {
    // Wikidata Q40787 (Alix de Hesse) : épouse de Nicolas II, fille d'Alice, petite-fille de Victoria.
    prompt: "Quelle petite-fille de Victoria a épousé le tsar Nicolas II ?",
    correct: "Alix de Hesse",
    wrong: ["Marie d'Édimbourg", "Victoria de Prusse", "Maud de Galles"],
    hint: "Elle devint l'impératrice Alexandra Feodorovna.",
  },
  {
    // Wikidata Q1032106 : château de Balmoral, Aberdeenshire, Écosse.
    prompt: "Dans quel pays se trouve le château de Balmoral ?",
    correct: "En Écosse",
    wrong: ["En Angleterre", "Au pays de Galles", "En Irlande du Nord"],
  },
  {
    // Wikidata Q43274 : couronnement le 6 mai 2023.
    prompt: "En quelle année Charles III a-t-il été couronné ?",
    correct: "2023",
    wrong: ["2020", "2022", "2024"],
    hint: "Huit mois après la mort de sa mère.",
  },
];
