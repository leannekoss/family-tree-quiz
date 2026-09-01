import { couleurDeId } from "./branches";
import { MARGE, type Dessin, type Orientation, type Personne } from "./dessinArbre";

/**
 * L'arbre à l'envers : d'une personne vers ses aïeux.
 *
 * 🔑 Ce n'est PAS la même chose que `dessinerArbre` avec un signe inversé. Une
 * descendance part d'un point et s'élargit selon le nombre d'enfants réels ; une
 * ascendance double mécaniquement à chaque génération — deux parents, quatre
 * grands-parents, huit arrière-grands-parents. La forme, le placement et ce
 * qu'on cherche à lire sont différents, d'où un moteur séparé.
 *
 * 🔑 C'est la seule vue capable de montrer les cent quatre-vingt-cinq aïeux
 * venus du GEDCOM : Montclar, Rozel, Valadier, la souche allemande. Tous sont
 * ancêtres par les femmes ou par des branches latérales, donc invisibles dans
 * une descendance quelle que soit sa racine.
 *
 * 🔑 Un garde-fou contre les boucles : dans un arbre saisi à la main, un aïeul
 * finit toujours par se retrouver son propre ancêtre par erreur, et le parcours
 * ne s'arrêterait jamais.
 */

const L = 150;
const H = 44;
/** Écart entre deux aïeux d'une même génération. */
const ECART = 10;

type Noeud = {
  p: Personne;
  pere: Noeud | null;
  mere: Noeud | null;
  /** Place occupée sur l'axe transverse par tout ce qui est au-dessus. */
  large: number;
  t: number;
  d: number;
};

const echappe = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function dessinerAscendance(
  gens: Personne[],
  options: {
    racineId: string;
    moiId?: string | null;
    orientation?: Orientation;
    /** Au-delà, l'écran ne montre plus rien de lisible. */
    generations?: number;
  },
): Dessin {
  const { racineId, moiId = null, orientation = "vertical", generations = 12 } = options;
  const horizontal = orientation === "horizontal";
  const parId = new Map(gens.map((p) => [p.id, p]));

  const depart = parId.get(racineId);
  if (!depart) {
    return {
      svg: "", largeur: 0, hauteur: 0, compte: 0, caches: 0,
      positions: new Map(), racine: { x: 0, y: 0 },
    };
  }

  function construire(p: Personne, d: number, vus: Set<string>): Noeud {
    const n: Noeud = { p, pere: null, mere: null, large: 0, t: 0, d };
    if (d >= generations || vus.has(p.id)) return n;
    const suite = new Set(vus).add(p.id);
    const pere = p.father_id ? parId.get(p.father_id) : undefined;
    const mere = p.mother_id ? parId.get(p.mother_id) : undefined;
    if (pere) n.pere = construire(pere, d + 1, suite);
    if (mere) n.mere = construire(mere, d + 1, suite);
    return n;
  }

  // La largeur d'un nœud, c'est celle de ses deux parents mis côte à côte —
  // ou la sienne propre s'il n'en a aucun de connu.
  function mesurer(n: Noeud): number {
    const enfants = [n.pere, n.mere].filter(Boolean) as Noeud[];
    n.large = enfants.length
      ? enfants.reduce((s, e) => s + mesurer(e), 0) + (enfants.length - 1) * ECART
      : L;
    return n.large;
  }

  function placer(n: Noeud, debut: number) {
    const enfants = [n.pere, n.mere].filter(Boolean) as Noeud[];
    if (!enfants.length) {
      n.t = debut + L / 2;
      return;
    }
    let x = debut;
    for (const e of enfants) {
      placer(e, x);
      x += e.large + ECART;
    }
    // Centré entre son père et sa mère : la génération du dessous se lit comme
    // le point de rencontre des deux lignées au-dessus.
    n.t = (enfants[0].t + enfants[enfants.length - 1].t) / 2;
  }

  const racine = construire(depart, 0, new Set());
  mesurer(racine);
  placer(racine, 0);

  // Les générations montent : la personne en bas, ses aïeux au-dessus.
  let profondeur = 0;
  const tous: Noeud[] = [];
  (function parcourir(n: Noeud) {
    tous.push(n);
    profondeur = Math.max(profondeur, n.d);
    if (n.pere) parcourir(n.pere);
    if (n.mere) parcourir(n.mere);
  })(racine);

  const PAS = horizontal ? L + 60 : H + 46;
  const X = (t: number, d: number) => (horizontal ? (profondeur - d) * PAS : t - L / 2);
  const Y = (t: number, d: number) => (horizontal ? t - H / 2 : (profondeur - d) * PAS);

  const positions = new Map<string, { x: number; y: number }>();
  const traits: string[] = [];
  const cartes: string[] = [];

  for (const n of tous) {
    const x = X(n.t, n.d);
    const y = Y(n.t, n.d);
    positions.set(n.p.id, { x: x + L / 2 + MARGE, y: y + H / 2 + MARGE });

    for (const parent of [n.pere, n.mere].filter(Boolean) as Noeud[]) {
      const px = X(parent.t, parent.d);
      const py = Y(parent.t, parent.d);
      // Un trait coudé plutôt qu'une diagonale : sur douze générations, les
      // obliques se croisent et l'œil ne suit plus aucune lignée.
      traits.push(
        horizontal
          ? `<path d="M ${x} ${y + H / 2} H ${(x + px + L) / 2} V ${py + H / 2} H ${px + L}" fill="none" stroke="var(--line)" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`
          : `<path d="M ${x + L / 2} ${y} V ${(y + py + H) / 2} H ${px + L / 2} V ${py + H}" fill="none" stroke="var(--line)" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`,
      );
    }

    const p = n.p;
    const estMoi = p.id === moiId;
    const estRacine = p.id === racineId;
    const nom = echappe(p.nickname || p.first_name.split(" ")[0]);
    const famille = p.last_name === "?" ? "nom à retrouver" : echappe(p.last_name);
    const annees = p.birth_year
      ? p.deceased
        ? `${p.birth_year}–${p.death_year ?? "?"}`
        : `${p.birth_year}`
      : p.deceased
        ? "†"
        : "";
    const liseré = couleurDeId(p.branch_id);
    const accent = estMoi || estRacine;
    cartes.push(
      `<a href="/personne/${p.id}"><g>` +
        `<rect x="${x}" y="${y}" width="${L}" height="${H}" rx="7" fill="${accent ? "var(--accent)" : (liseré ?? "var(--line)")}" fill-opacity="${accent ? "0.30" : "0.18"}" stroke="${accent ? "var(--accent)" : (liseré ?? "var(--muted)")}" stroke-width="${accent ? 2.5 : 1}" vector-effect="non-scaling-stroke"/>` +
        (liseré ? `<rect x="${x}" y="${y + 4}" width="3.5" height="${H - 8}" rx="1.5" fill="${liseré}"/>` : "") +
        `<text class="a1" x="${x + 12}" y="${y + 17}" font-size="12" font-weight="600" fill="${p.deceased ? "var(--muted)" : "var(--foreground)"}">${nom}</text>` +
        `<text class="a2" x="${x + 12}" y="${y + 30}" font-size="10.5" fill="var(--muted)">${famille}</text>` +
        (annees ? `<text class="a2" x="${x + L - 8}" y="${y + 39}" font-size="8.5" text-anchor="end" fill="var(--muted)">${annees}</text>` : "") +
        `</g></a>`,
    );
  }

  const xs = [...positions.values()].map((v) => v.x);
  const ys = [...positions.values()].map((v) => v.y);
  const largeur = Math.max(...xs) + L / 2 + MARGE;
  const hauteur = Math.max(...ys) + H / 2 + MARGE;

  return {
    svg:
      `<g transform="translate(${MARGE},${MARGE})">` +
      traits.join("") +
      cartes.join("") +
      `</g>`,
    largeur,
    hauteur,
    compte: tous.length,
    caches: 0,
    positions,
    racine: positions.get(racineId) ?? { x: 0, y: 0 },
  };
}
