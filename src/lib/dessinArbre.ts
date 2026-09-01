import { couleurDeId } from "./branches";

/**
 * Le dessin de l'arbre entier — un SVG, en une fonction pure.
 *
 * 🔑 Ce fichier est appelé des DEUX côtés : le serveur en fait la première
 * image (rien à assembler à l'arrivée, la page s'affiche pleine), le client le
 * rappelle à chaque pli, dépli ou changement d'orientation. Sans ce partage, un
 * pli demanderait un aller-retour au serveur — la page se rechargerait et le
 * zoom repartirait de zéro à chaque geste, ce qui rend une exploration
 * impossible.
 *
 * Et pas de React ici : sept cents cartes posées en JSX figent un téléphone
 * d'entrée de gamme. Une chaîne de caractères posée en une fois coûte quelques
 * millisecondes, à l'arrivée comme à chaque redessin.
 */

export type Personne = {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  birth_year: number | null;
  death_year: number | null;
  deceased: boolean;
  father_id: string | null;
  mother_id: string | null;
  branch_id: number | null;
};

export type Union = { p1_id: string; p2_id: string };

export type Orientation = "vertical" | "horizontal";

export type Options = {
  racineId: string;
  moiId?: string | null;
  orientation?: Orientation;
  /** Les fiches dont la descendance est repliée. */
  plies?: Iterable<string>;
};

export type Dessin = {
  svg: string;
  largeur: number;
  hauteur: number;
  /** Cartes réellement dessinées. */
  compte: number;
  /** Personnes escamotées par les plis. */
  caches: number;
  /** Le centre de chaque carte, dans le repère du dessin (marge comprise). */
  positions: Map<string, { x: number; y: number }>;
  /** Le centre de la racine : le repli quand le lecteur n'a pas de fiche. */
  racine: { x: number; y: number };
};

// La géométrie d'une carte. Large assez pour un prénom composé, basse assez
// pour que dix générations tiennent dans un écran une fois dézoomé.
const L = 150;
const H = 44;
const ECART_CONJOINT = 4;
export const MARGE = 24;

type Noeud = {
  p: Personne;
  conjoints: Personne[];
  enfants: Noeud[];
  /** Taille du sous-arbre sur l'axe transverse (la fratrie). */
  large: number;
  /** Position sur l'axe transverse (centre) et sur l'axe des générations. */
  t: number;
  d: number;
  /** Descendants escamotés quand ce nœud est replié — 0 s'il est ouvert. */
  caches: number;
};

const echappe = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function dessinerArbre(
  gens: Personne[],
  unions: Union[],
  options: Options,
): Dessin {
  const horizontal = options.orientation === "horizontal";
  const plies = new Set(options.plies ?? []);
  const moiId = options.moiId ?? null;

  // Sur l'axe transverse, une carte occupe sa largeur debout, sa hauteur
  // couchée : c'est tout ce qui change entre les deux orientations, et le reste
  // du calcul l'ignore.
  const TAILLE_T = horizontal ? H : L;
  const TAILLE_D = horizontal ? L : H;
  const ECART_T = horizontal ? 8 : 10;
  const ECART_D = horizontal ? 56 : 64;

  const parId = new Map(gens.map((p) => [p.id, p]));

  const conjointsDe = new Map<string, string[]>();
  for (const u of unions) {
    conjointsDe.set(u.p1_id, [...(conjointsDe.get(u.p1_id) ?? []), u.p2_id]);
    conjointsDe.set(u.p2_id, [...(conjointsDe.get(u.p2_id) ?? []), u.p1_id]);
  }

  const enfantsDe = new Map<string, Personne[]>();
  for (const p of gens) {
    for (const par of [p.father_id, p.mother_id]) {
      if (par) enfantsDe.set(par, [...(enfantsDe.get(par) ?? []), p]);
    }
  }

  // ── L'arbre ──
  // Il se construit ENTIER, plis compris : c'est lui qui sait combien de gens
  // dorment sous une branche repliée, et cette promesse chiffrée (« + 34 ») est
  // la seule chose qui donne envie de la rouvrir.
  const vus = new Set<string>();

  function construire(p: Personne): Noeud {
    vus.add(p.id);
    const conjoints = (conjointsDe.get(p.id) ?? [])
      .map((id) => parId.get(id))
      .filter((c): c is Personne => c !== undefined && !vus.has(c.id));
    conjoints.forEach((c) => vus.add(c.id));

    const enfants = (enfantsDe.get(p.id) ?? [])
      .filter((e) => !vus.has(e.id))
      .sort((a, b) => (a.birth_year ?? 9999) - (b.birth_year ?? 9999))
      .map(construire);

    return { p, conjoints, enfants, large: 0, t: 0, d: 0, caches: 0 };
  }

  const peuple = (n: Noeud): number =>
    1 +
    n.conjoints.length +
    n.enfants.reduce((s, e) => s + peuple(e), 0);

  // Taille d'un sous-arbre : ses propres cartes ou la somme de ses enfants, la
  // plus grande des deux. Règle classique du dessin d'arbre : chaque famille
  // reçoit exactement la place de sa descendance, ni plus ni moins.
  function mesurer(n: Noeud) {
    const propre =
      (1 + n.conjoints.length) * TAILLE_T + n.conjoints.length * ECART_CONJOINT;

    if (plies.has(n.p.id) && n.enfants.length > 0) {
      n.caches = n.enfants.reduce((s, e) => s + peuple(e), 0);
      n.large = propre;
      return;
    }
    n.caches = 0;
    n.enfants.forEach(mesurer);
    const dessous =
      n.enfants.reduce((s, e) => s + e.large, 0) +
      Math.max(0, n.enfants.length - 1) * ECART_T;
    n.large = Math.max(propre, dessous);
  }

  function placer(n: Noeud, t: number, d: number) {
    n.t = t + n.large / 2;
    n.d = d;
    if (n.caches > 0) return;
    const total =
      n.enfants.reduce((s, e) => s + e.large, 0) +
      Math.max(0, n.enfants.length - 1) * ECART_T;
    let ct = t + (n.large - total) / 2;
    for (const e of n.enfants) {
      placer(e, ct, d + TAILLE_D + ECART_D);
      ct += e.large + ECART_T;
    }
  }

  const depart = parId.get(options.racineId) ?? gens[0];
  const tronc = construire(depart);
  mesurer(tronc);
  placer(tronc, 0, 0);

  // ── Le dessin ──
  // Tout le calcul s'est fait en (transverse, génération) ; la projection est
  // le SEUL endroit qui sait dans quel sens l'arbre est couché.
  const X = (t: number, d: number) => (horizontal ? d : t);
  const Y = (t: number, d: number) => (horizontal ? t : d);

  const cartes: string[] = [];
  const traits: string[] = [];
  const positions = new Map<string, { x: number; y: number }>();
  let compte = 0;
  let caches = 0;
  let maxD = 0;

  function carte(p: Personne, t: number, d: number) {
    compte++;
    const x = X(t, d);
    const y = Y(t, d);
    positions.set(p.id, { x: x + L / 2 + MARGE, y: y + H / 2 + MARGE });
    const estMoi = p.id === moiId;
    const nom = echappe(p.nickname || p.first_name.split(" ")[0]);
    // Le patronyme inconnu ne s'écrit pas « ? » sur une carte : il s'écrit en
    // toutes lettres, et c'est une invitation à corriger.
    const famille = p.last_name === "?" ? "nom à retrouver" : echappe(p.last_name);
    const annees = p.birth_year
      ? p.deceased
        ? `${p.birth_year}–${p.death_year ?? "?"}`
        : `${p.birth_year}`
      : p.deceased
        ? "†"
        : "";
    const liseré = couleurDeId(p.branch_id);
    cartes.push(
      `<a href="/personne/${p.id}"><g>` +
        // Le fond de la carte porte la couleur de sa branche, diluée : vu de
        // loin l'arbre devient des masses colorées — c'est la forme qu'on est
        // venu voir — et vu de près le texte reste lisible sur la teinte.
        // `non-scaling-stroke` garde un contour d'un pixel à TOUTE échelle :
        // sans lui, à 0,007 de zoom, les contours faisaient un centième de
        // pixel et la page semblait vide.
        `<rect x="${x}" y="${y}" width="${L}" height="${H}" rx="7" fill="${estMoi ? "var(--accent)" : (liseré ?? "var(--line)")}" fill-opacity="${estMoi ? "0.30" : "0.18"}" stroke="${estMoi ? "var(--accent)" : (liseré ?? "var(--muted)")}" stroke-width="${estMoi ? 2.5 : 1}" vector-effect="non-scaling-stroke"/>` +
        (liseré ? `<rect x="${x}" y="${y + 4}" width="3.5" height="${H - 8}" rx="1.5" fill="${liseré}"/>` : "") +
        `<text class="a1" x="${x + 12}" y="${y + 17}" font-size="12" font-weight="600" fill="${p.deceased ? "var(--muted)" : "var(--foreground)"}">${nom}</text>` +
        `<text class="a2" x="${x + 12}" y="${y + 30}" font-size="10.5" fill="var(--muted)">${famille}</text>` +
        (annees ? `<text class="a2" x="${x + L - 8}" y="${y + 39}" font-size="8.5" text-anchor="end" fill="var(--muted)">${annees}</text>` : "") +
        `</g></a>`,
    );
  }

  /**
   * La poignée qui plie et déplie, sous la carte (ou à sa droite, couché).
   *
   * Fermée elle annonce ce qu'elle cache — « + 34 » — parce qu'un chevron nu
   * ne dit pas s'il y a un enfant ou trois générations derrière. Le disque
   * transparent qui l'entoure porte la zone tactile à 44 px sans grossir le
   * dessin : au doigt, on vise une pastille de dix pixels et on la manque.
   */
  function poignee(n: Noeud, t: number, d: number) {
    if (n.enfants.length === 0) return;
    const ferme = n.caches > 0;
    const cx = horizontal ? X(t, d) + L + 9 : X(t, d) + L / 2;
    const cy = horizontal ? Y(t, d) + H / 2 : Y(t, d) + H + 9;
    const large = ferme && n.caches > 9 ? 15 : 9;
    cartes.push(
      `<g data-plier="${n.p.id}" class="poignee" role="button" tabindex="0" aria-label="${ferme ? `déplier ${n.caches} personnes` : "replier cette branche"}">` +
        `<rect x="${cx - large}" y="${cy - 9}" width="${large * 2}" height="18" rx="9" fill="var(--card)" stroke="${ferme ? "var(--accent)" : "var(--muted)"}" stroke-width="1" vector-effect="non-scaling-stroke"/>` +
        `<text x="${cx}" y="${cy + 3.5}" font-size="10" font-weight="600" text-anchor="middle" fill="${ferme ? "var(--accent)" : "var(--muted)"}">${ferme ? `+${n.caches}` : "−"}</text>` +
        // Le disque de visée, invisible et large : c'est lui que le doigt touche.
        `<circle cx="${cx}" cy="${cy}" r="22" fill="transparent"/>` +
        `</g>`,
    );
  }

  function dessiner(n: Noeud) {
    const groupe =
      (1 + n.conjoints.length) * TAILLE_T + n.conjoints.length * ECART_CONJOINT;
    const debut = n.t - groupe / 2;
    carte(n.p, debut, n.d);
    n.conjoints.forEach((c, i) => {
      const ct = debut + (i + 1) * (TAILLE_T + ECART_CONJOINT);
      // Le trait double du mariage, entre les deux cartes.
      const a = horizontal
        ? `M ${X(ct, n.d) + L / 2 - 2} ${Y(ct, n.d) - ECART_CONJOINT} v ${ECART_CONJOINT} M ${X(ct, n.d) + L / 2 + 2} ${Y(ct, n.d) - ECART_CONJOINT} v ${ECART_CONJOINT}`
        : `M ${X(ct, n.d) - ECART_CONJOINT} ${Y(ct, n.d) + H / 2 - 2} h ${ECART_CONJOINT} M ${X(ct, n.d) - ECART_CONJOINT} ${Y(ct, n.d) + H / 2 + 2} h ${ECART_CONJOINT}`;
      traits.push(
        `<path d="${a}" stroke="var(--muted)" stroke-width="1" vector-effect="non-scaling-stroke"/>`,
      );
      carte(c, ct, n.d);
    });
    maxD = Math.max(maxD, n.d + TAILLE_D);
    poignee(n, debut, n.d);

    if (n.caches > 0) {
      caches += n.caches;
      return;
    }
    if (n.enfants.length === 0) return;

    // Le bus : du couple vers la ligne de fratrie, la ligne elle-même, puis
    // chaque enfant. Couché, la même figure pivote d'un quart de tour.
    const busD = n.d + TAILLE_D + ECART_D / 2;
    const trait = (dd: string) =>
      traits.push(
        `<path d="${dd}" stroke="var(--muted)" stroke-width="1.5" fill="none" vector-effect="non-scaling-stroke"/>`,
      );

    if (horizontal) {
      trait(`M ${X(n.t, n.d) + L} ${Y(n.t, n.d) + H / 2} H ${busD}`);
      const y1 = Y(n.enfants[0].t, 0) + H / 2;
      const y2 = Y(n.enfants[n.enfants.length - 1].t, 0) + H / 2;
      if (n.enfants.length > 1) trait(`M ${busD} ${y1} V ${y2}`);
      for (const e of n.enfants) {
        trait(`M ${busD} ${Y(e.t, e.d) + H / 2} H ${X(e.t, e.d)}`);
        dessiner(e);
      }
    } else {
      trait(`M ${X(n.t, n.d)} ${Y(n.t, n.d) + H} V ${busD}`);
      const x1 = X(n.enfants[0].t, 0);
      const x2 = X(n.enfants[n.enfants.length - 1].t, 0);
      if (n.enfants.length > 1) trait(`M ${x1} ${busD} H ${x2}`);
      for (const e of n.enfants) {
        trait(`M ${X(e.t, e.d)} ${busD} V ${Y(e.t, e.d)}`);
        dessiner(e);
      }
    }
  }

  dessiner(tronc);

  // La poignée dépasse la dernière carte : la marge de fin lui laisse la place,
  // sinon elle se fait couper par le bord du dessin.
  const etendueT = tronc.large + MARGE * 2;
  const etendueD = maxD + MARGE * 2 + 24;
  const largeur = Math.ceil(horizontal ? etendueD : etendueT);
  const hauteur = Math.ceil(horizontal ? etendueT : etendueD);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}" viewBox="${-MARGE} ${-MARGE} ${largeur} ${hauteur}" font-family="ui-sans-serif, system-ui, sans-serif">` +
    traits.join("") +
    cartes.join("") +
    `</svg>`;

  return {
    svg,
    largeur,
    hauteur,
    compte,
    caches,
    positions,
    racine: {
      x: X(tronc.t, tronc.d) + L / 2 + MARGE,
      y: Y(tronc.t, tronc.d) + H / 2 + MARGE,
    },
  };
}

/**
 * Le chemin de la racine jusqu'à soi : tout ce qui n'est pas dessus se replie.
 *
 * C'est le geste « focus + contexte » du dessin d'information : on garde son
 * fil d'ascendance ouvert — le contexte, qui dit d'où l'on vient — et on ferme
 * les six cents cousins qui n'aident pas à le lire. Sans lui, « replier » se
 * ferait branche par branche, cent fois.
 */
export function replierSauf(
  gens: Personne[],
  unions: Union[],
  racineId: string,
  cibleId: string | null,
): string[] {
  const parId = new Map(gens.map((p) => [p.id, p]));

  /**
   * Le chemin de la racine jusqu'à quelqu'un, en remontant.
   *
   * 🔑 Les DEUX parents sont explorés à chaque pas, en largeur. Suivre le père
   * par défaut paraît naturel et ne marche pas : l'ascendance qui mène au
   * tronc change de sexe à chaque génération ou presque — Camille descend des
   * Vernet par sa mère, et suivre les Vernet sortait de la famille dès le
   * premier pas. Le chemin obtenu part de la racine et redescend jusqu'à la
   * cible, ce qui est exactement ce qu'il faut garder ouvert : un maillon
   * manquant, et tout ce qui est dessous cesse d'être dessiné.
   */
  const chemin = (depart: string | null | undefined): string[] | null => {
    if (!depart || !parId.has(depart)) return null;
    const venuDe = new Map<string, string | null>([[depart, null]]);
    let file = [depart];
    while (file.length) {
      const suivant: string[] = [];
      for (const id of file) {
        if (id === racineId) {
          const c: string[] = [];
          let x: string | null = id;
          while (x) {
            c.push(x);
            x = venuDe.get(x) ?? null;
          }
          return c;
        }
        const p = parId.get(id);
        for (const par of [p?.father_id, p?.mother_id]) {
          if (par && parId.has(par) && !venuDe.has(par)) {
            venuDe.set(par, id);
            suivant.push(par);
          }
        }
      }
      file = suivant;
    }
    return null;
  };

  // Une pièce rapportée n'a pas d'ascendance dans l'arbre : sa lignée, c'est
  // celle de son conjoint. Sans ce report, le bouton ne lui montrerait rien.
  let garder = chemin(cibleId);
  if (!garder && cibleId) {
    for (const u of unions) {
      const autre = u.p1_id === cibleId ? u.p2_id : u.p2_id === cibleId ? u.p1_id : null;
      garder = chemin(autre);
      if (garder) break;
    }
  }
  // Faute de chemin, la racine seule : l'arbre s'ouvre sur sa première
  // génération, ce qui reste une vue honnête plutôt qu'un écran inchangé.
  const ouverts = new Set(garder ?? [racineId]);
  // On replie tout parent qui n'est pas sur le chemin : ses enfants
  // disparaissent, mais lui reste visible — l'arbre garde sa forme.
  return gens.filter((q) => !ouverts.has(q.id)).map((q) => q.id);
}
