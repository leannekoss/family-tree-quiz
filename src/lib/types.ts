export type Person = {
  id: string;
  first_name: string;
  last_name: string;
  married_name: string | null;
  nickname: string | null;
  sex: "M" | "F" | null;
  father_id: string | null;
  mother_id: string | null;
  branch_id: number | null;
  birth_display: string | null;
  birth_year: number | null;
  deceased: boolean;
  death_display: string | null;
  notes: string | null;
};

export type SearchHit = {
  id: string;
  first_name: string;
  last_name: string;
  married_name: string | null;
  birth_display: string | null;
  deceased: boolean;
  branch_name: string | null;
  photo_url: string | null;
  sex: string | null;
};

export type Sibling = {
  id: string;
  first_name: string;
  last_name: string;
  married_name: string | null;
  birth_display: string | null;
  death_display: string | null;
  deceased: boolean;
  photo_url: string | null;
  sex: string | null;
  branch_id: number | null;
  kind: "fratrie" | "demi";
};

/**
 * « Marie Durand (née Vernet) » — le nom d'usage prime à l'affichage.
 * L'accord suit le sexe enregistré ; quand il est inconnu on écrit la forme
 * neutre plutôt que de présumer.
 */
export function fullName(p: {
  first_name: string;
  last_name: string;
  married_name?: string | null;
  sex?: string | null;
}): string {
  // « ? » est la convention en base pour un patronyme inconnu — six conjoints
  // du fichier Chastel ne sont connus que par leur prénom. La convention sert la
  // saisie, pas la lecture : « Angélique ? » dans une liste se lit comme une
  // erreur du site, et la famille l'a lu exactement ainsi. Le prénom seul
  // suffit ; la fiche, elle, dira que le nom reste à retrouver.
  if (p.last_name === "?") return p.first_name;
  if (p.married_name && p.married_name !== p.last_name) {
    const ne = p.sex === "M" ? "né" : p.sex === "F" ? "née" : "né·e";
    return `${p.first_name} ${p.married_name} (${ne} ${p.last_name})`;
  }
  return `${p.first_name} ${p.last_name}`;
}

/** « a-t-il » / « a-t-elle », et la forme neutre quand le sexe n'est pas connu. */
export function agrees(
  sex: string | null | undefined,
  masculin: string,
  feminin: string,
  neutre = masculin,
): string {
  if (sex === "M") return masculin;
  if (sex === "F") return feminin;
  return neutre;
}

/**
 * Nom court pour les cartes de l'arbre : le nom porté, sans la mention « née X ».
 * Ces cartes sont des repères qu'on parcourt du regard, pas des états civils —
 * la forme complète allongeait tellement les cartes que la rangée des parents
 * débordait de l'écran.
 */
export function shortName(p: {
  first_name: string;
  last_name: string;
  married_name?: string | null;
}): string {
  const nom = p.married_name || p.last_name;
  return nom === "?" ? p.first_name : `${p.first_name} ${nom}`;
}

/**
 * Âge, lu directement dans le texte du bulletin plutôt que dans l'année générée :
 * « 4.05.87 » donne le jour et le mois, donc l'âge exact, là où l'année seule ne
 * donne qu'un à-peu-près d'un an. On distingue les deux à l'affichage — « 39 ans »
 * quand on sait, « ~39 ans » quand on approche — parce qu'annoncer une précision
 * qu'on n'a pas est le meilleur moyen de faire douter du reste.
 */
export function age(
  p: { birth_display?: string | null; death_display?: string | null; deceased?: boolean },
  aujourdhui = new Date(),
): { valeur: number; approche: boolean } | null {
  const naissance = lireDate(p.birth_display);
  if (!naissance) return null;

  const fin = p.deceased ? lireDate(p.death_display) : { d: aujourdhui, precise: true };
  if (!fin) return null;

  let valeur = fin.d.getFullYear() - naissance.d.getFullYear();
  const moisEcoules =
    fin.d.getMonth() > naissance.d.getMonth() ||
    (fin.d.getMonth() === naissance.d.getMonth() && fin.d.getDate() >= naissance.d.getDate());
  if (!moisEcoules) valeur -= 1;

  if (valeur < 0 || valeur > 120) return null;
  return { valeur, approche: !naissance.precise || !fin.precise };
}

/** « 4.05.87 » → 4 mai 1987 · « 1908 » → 1908, imprécis · « vers 1890 » → imprécis. */
function lireDate(texte?: string | null): { d: Date; precise: boolean } | null {
  if (!texte) return null;
  const complet = texte.match(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{2,4})/);
  if (complet) {
    const [, j, m, a] = complet;
    const annee = a.length === 4 ? +a : +a <= 30 ? 2000 + +a : 1900 + +a;
    return { d: new Date(annee, +m - 1, +j), precise: !/vers|env|\?/i.test(texte) };
  }
  const seule = texte.match(/(\d{4})/);
  if (seule) return { d: new Date(+seule[1], 5, 30), precise: false };
  return null;
}

/**
 * Ordre d'une fratrie : l'aîné d'abord, comme sur un arbre de famille dessiné à
 * la main. Une rangée qui mélange 25, 35, 35, 31 puis 21 ans ne se lit pas — on
 * cherche qui est le grand, et rien ne le dit.
 *
 * Ceux dont on ignore la date passent à la fin plutôt qu'au début : les mettre
 * en tête laisserait croire qu'ils sont les aînés. On s'appuie sur `lireDate`,
 * la même lecture que l'âge affiché sur la carte, pour qu'un tri et un âge ne
 * puissent jamais se contredire.
 */
export function parAinesse(
  a: { birth_display?: string | null },
  b: { birth_display?: string | null },
): number {
  const da = lireDate(a.birth_display)?.d.getTime();
  const db = lireDate(b.birth_display)?.d.getTime();
  if (da === undefined && db === undefined) return 0;
  if (da === undefined) return 1;
  if (db === undefined) return -1;
  return da - db;
}

/** « 39 ans », « ~39 ans », « † à 79 ans ». */
export function ageLisible(p: {
  birth_display?: string | null;
  death_display?: string | null;
  deceased?: boolean;
}): string | null {
  const a = age(p);
  if (!a) return null;
  // Un enfant mort avant un an : les deux dates disent déjà tout, « † à 0 an »
  // n'ajoute rien qu'une brutalité.
  if (p.deceased && a.valeur < 1) return null;

  const nombre = `${a.approche ? "~" : ""}${a.valeur} an${a.valeur > 1 ? "s" : ""}`;
  return p.deceased ? `† à ${nombre}` : nombre;
}

/** Ligne de vie : « 1923 – 1998 », « vers 1890 », « † ». */
export function lifeSpan(p: {
  birth_display?: string | null;
  death_display?: string | null;
  deceased?: boolean;
}): string {
  const birth = p.birth_display?.trim();
  const death = p.death_display?.trim();
  if (birth && death) return `${birth} – ${death}`;
  if (birth) return p.deceased ? `${birth} – ?` : birth;
  if (death) return `? – ${death}`;
  return p.deceased ? "†" : "";
}
