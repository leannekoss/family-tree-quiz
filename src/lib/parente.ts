/**
 * Mettre un nom français sur un lien de parenté.
 *
 * La base répond en chiffres : deux distances jusqu'au plus proche ancêtre
 * commun. Tout ce qui suit traduit ces deux nombres en une phrase qu'on dit à
 * voix haute — « votre cousine germaine », « l'épouse de votre cousin issu de
 * germain ».
 *
 * Le parti pris : le nom du lien ne suffit jamais. Ce qu'on veut savoir devant
 * une fiche, c'est « on est cousins par qui ? », et c'est la deuxième ligne qui
 * répond. Elle est plus utile que la première, et toujours vraie même quand le
 * français n'a pas de mot courant pour le lien.
 *
 * Le vocabulaire français du cousinage s'arrête vite : au-delà du « cousin issu
 * de germain », plus personne ne sait ni ne dit. On bascule alors sur le degré
 * chiffré plutôt que d'inventer des « quadri-cousins » que personne ne
 * reconnaîtrait.
 */

export type Parente = {
  relation: "soi" | "conjoint" | "sang" | "alliance" | "aucun" | "inconnu";
  d_cible: number | null;
  d_moi: number | null;
  parents_communs: number | null;
  ancetres: Personne[] | null;
  conjoint: Personne | null;
  /** 'mariage' ou 'union'. Renseigné quand la relation est « conjoint ». */
  lien_kind?: string | null;
};

type Personne = {
  id: string;
  first_name: string;
  last_name: string;
  married_name: string | null;
  sex: string | null;
};

const f = (sex: string | null | undefined) => sex === "F";

/** « votre père », « votre arrière-grand-mère » — l'ascendant à n générations. */
function ascendant(n: number, feminin: boolean): string {
  if (n === 1) return feminin ? "mère" : "père";
  if (n === 2) return feminin ? "grand-mère" : "grand-père";
  // Trois « arrière » d'affilée deviennent illisibles ; à partir de là, le
  // chiffre se lit mieux que la répétition.
  if (n <= 4) return `${"arrière-".repeat(n - 2)}${feminin ? "grand-mère" : "grand-père"}`;
  return `ancêtre à la ${n}ᵉ génération`;
}

/** Le même, au pluriel, pour nommer le couple d'ancêtres communs. */
function ascendantsPluriel(n: number): string {
  if (n === 1) return "parents";
  if (n <= 4) return `${"arrière-".repeat(n - 2)}grands-parents`;
  return `ancêtres à la ${n}ᵉ génération`;
}

function descendant(n: number, feminin: boolean): string {
  if (n === 1) return feminin ? "fille" : "fils";
  if (n === 2) return feminin ? "petite-fille" : "petit-fils";
  if (n <= 4)
    return `${"arrière-".repeat(n - 2)}${feminin ? "petite-fille" : "petit-fils"}`;
  return `descendant${feminin ? "e" : ""} à la ${n}ᵉ génération`;
}

/** Oncle, grand-oncle, arrière-grand-oncle — le frère d'un ascendant. */
function oncle(ecart: number, feminin: boolean): string {
  const mot = feminin ? "tante" : "oncle";
  if (ecart === 1) return mot;
  if (ecart === 2) return `grand-${mot}`;
  if (ecart <= 4) return `${"arrière-".repeat(ecart - 2)}grand-${mot}`;
  return `${mot} à la ${ecart}ᵉ génération`;
}

function neveu(ecart: number, feminin: boolean): string {
  const mot = feminin ? "nièce" : "neveu";
  if (ecart === 1) return mot;
  if (ecart === 2) return `${feminin ? "petite-nièce" : "petit-neveu"}`;
  return `${"arrière-".repeat(ecart - 2)}${feminin ? "petite-nièce" : "petit-neveu"}`;
}

/**
 * Le degré de cousinage, tant que le français a un mot pour lui.
 *
 * « issu de germain » ne s'accorde qu'au début : on écrit « cousine issue de
 * germain », jamais « issue de germaine » — le germain désigne le cousin
 * d'origine, pas la personne dont on parle.
 */
function cousin(degre: number, feminin: boolean): string {
  const mot = feminin ? "cousine" : "cousin";
  if (degre === 1) return `${mot} ${feminin ? "germaine" : "germain"}`;
  if (degre === 2) return `${mot} ${feminin ? "issue" : "issu"} de germain`;
  return `${mot} au ${degre}ᵉ degré`;
}

/**
 * Le lien entre deux personnes dont on connaît les deux distances à l'ancêtre
 * commun, déterminant compris. `dc` compte les générations du côté de la
 * personne regardée.
 *
 * Le déterminant fait partie du résultat parce qu'il n'est pas toujours le
 * même : « votre cousin germain », mais « le cousin germain de vos parents ».
 * Coller un « votre » devant tout donnait « votre cousin germain de vos
 * parents », qui ne veut rien dire.
 */
function nommer(
  dc: number,
  dm: number,
  feminin: boolean,
  parentsCommuns: number | null,
): string {
  const votre = (mot: string) => `votre ${mot}`;

  if (dc === 0) return votre(ascendant(dm, feminin));
  if (dm === 0) return votre(descendant(dc, feminin));

  // Un seul parent commun quand les deux en ont deux : c'est un demi-frère, et
  // l'écrire évite de contredire la fratrie affichée juste en dessous.
  if (dc === 1 && dm === 1) {
    const demi = parentsCommuns === 1 ? "demi-" : "";
    return votre(`${demi}${feminin ? "sœur" : "frère"}`);
  }

  if (dc === 1) return votre(oncle(dm - 1, feminin));
  if (dm === 1) return votre(neveu(dc - 1, feminin));

  const proche = Math.min(dc, dm);
  const ecart = Math.abs(dc - dm);
  const base = cousin(proche - 1, feminin);

  if (ecart === 0) return votre(base);
  // Un cousin d'une autre génération n'a pas de nom courant en français. Le
  // situer par rapport à quelqu'un dit plus que « cousin éloigné », qui ne dit
  // rien : « le cousin germain de vos grands-parents » se comprend du premier
  // coup.
  if (dc < dm) return `${leLa(base, feminin)} de vos ${ascendantsPluriel(ecart)}`;
  return `${leLa(descendant(ecart, feminin), feminin)} de votre ${cousin(proche - 1, false)}`;
}

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const voyelle = (s: string) => /^[aeiouyéèêëàâîïôûüh]/i.test(s);

/** « de Nicolas », mais « d'Agnès ». */
const de = (nom: string) => (voyelle(nom) ? `d'${nom}` : `de ${nom}`);

/** « le fils », « la fille », mais « l'arrière-petit-fils ». */
const leLa = (mot: string, feminin: boolean) =>
  voyelle(mot) ? `l'${mot}` : `${feminin ? "la" : "le"} ${mot}`;

export function nomComplet(p: Personne): string {
  return p.married_name && p.married_name !== p.last_name
    ? `${p.first_name} ${p.married_name}`
    : `${p.first_name} ${p.last_name}`;
}

/**
 * La phrase affichée sur la fiche : un titre, et le chemin qui le justifie.
 * `detail` peut manquer, jamais `titre`.
 */
export function decrireParente(
  p: Parente,
  cibleFeminin: boolean,
): { titre: string; detail: string | null } | null {
  if (p.relation === "aucun") return null;

  if (p.relation === "inconnu") {
    return {
      titre: "Dites-nous qui vous êtes",
      detail:
        "et chaque fiche vous dira ce que cette personne est pour vous, et par quels ancêtres.",
    };
  }

  if (p.relation === "soi") return { titre: "C'est vous", detail: null };

  if (p.relation === "conjoint") {
    // « Votre mari » était annoncé à tout conjoint, marié ou non — alors que la
    // base distingue les deux depuis le début. Se tromper là-dessus n'est pas
    // une inexactitude de données : c'est dire d'un couple quelque chose qu'il
    // n'a pas choisi.
    const marie = p.lien_kind !== "union";
    return {
      titre: marie
        ? `Votre ${cibleFeminin ? "femme" : "mari"}`
        : `Votre ${cibleFeminin ? "compagne" : "compagnon"}`,
      detail: null,
    };
  }

  const dc = p.d_cible ?? 0;
  const dm = p.d_moi ?? 0;
  const ancetres = p.ancetres ?? [];

  // Le couple d'ancêtres, nommé du point de vue de qui regarde : « Jacques et
  // Anne, vos grands-parents ». Sans la deuxième moitié, on saurait par qui
  // sans savoir à quelle distance.
  const lesAncetres =
    ancetres.length > 0 && dm > 0
      ? `${ancetres.map(nomComplet).join(" et ")}, ` +
        (ancetres.length > 1
          ? `vos ${ascendantsPluriel(dm)}`
          : `votre ${ascendant(dm, f(ancetres[0].sex))}`)
      : null;

  if (p.relation === "alliance" && p.conjoint) {
    // Le nom d'abord, le lien en apposition. « L'épouse de Nicolas Bardin,
    // votre cousin germain » se lit mieux que « l'épouse de votre cousin
    // germain Nicolas Bardin », et surtout ne bute pas sur les liens qui ne
    // commencent pas par « votre » : « l'épouse du cousin germain de vos
    // parents » aurait demandé de contracter « de le » à la main.
    //
    // C'est aussi l'ordre dans lequel on cherche : devant quelqu'un qu'on ne
    // reconnaît pas à une fête, la question est « c'est le conjoint de qui ? ».
    const lienDuConjoint = nommer(dc, dm, f(p.conjoint.sex), p.parents_communs);
    // Même règle que pour son propre conjoint, et elle avait été oubliée ici :
    // Charles Lemarié était annoncé « l'époux d'Agathe Velay » alors qu'ils ne
    // sont pas mariés. Trente-sept couples de l'arbre sur deux cent
    // vingt-huit ne le sont pas — leur dire le contraire sur leur propre fiche
    // n'est pas une imprécision, c'est leur prêter un engagement qu'ils n'ont
    // pas pris.
    const marie = p.lien_kind !== "union";
    const titreConjoint = marie
      ? cibleFeminin
        ? "L'épouse"
        : "L'époux"
      : cibleFeminin
        ? "La compagne"
        : "Le compagnon";
    return {
      titre: `${titreConjoint} ${de(nomComplet(p.conjoint))}, ${lienDuConjoint}`,
      detail: lesAncetres
        ? `Vous et ${p.conjoint.first_name} descendez ${de(lesAncetres)}`
        : null,
    };
  }

  return {
    titre: majuscule(nommer(dc, dm, cibleFeminin, p.parents_communs)),
    // Un parent ou un enfant n'a pas besoin qu'on explique par où : le lien
    // *est* le chemin. La ligne ne sert qu'à partir des cousins.
    detail:
      dc >= 1 && dm >= 1 && dc + dm > 2 && lesAncetres
        ? `Vous descendez tous les deux ${de(lesAncetres)}`
        : null,
  };
}
