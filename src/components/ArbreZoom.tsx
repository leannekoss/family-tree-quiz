"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { dessinerAscendance } from "@/lib/dessinAscendance";
import {
  dessinerArbre,
  replierSauf,
  type Dessin,
  type Orientation,
  type Personne,
  type Union,
} from "@/lib/dessinArbre";

/**
 * La loupe de l'arbre entier : molette, pincement, glisser — et les gestes
 * d'exploration : ouvrir une fiche, replier une branche, coucher l'arbre,
 * passer en plein écran.
 *
 * Sans librairie, et c'est un choix : le besoin tient en quelques gestes, et
 * une bibliothèque de cartographie embarquerait cent fois ça pour un écran.
 *
 * 🔑 Deux règles tiennent tout le fichier :
 *
 * 1. La transformation s'applique en style direct sur le nœud, jamais par
 *    setState : un état React par cran de molette re-rendrait sept cents cartes
 *    à chaque geste, et le zoom deviendrait poisseux précisément sur les
 *    téléphones des gens qu'on veut servir.
 * 2. Le dessin se refait en une chaîne posée en innerHTML, jamais en JSX —
 *    même raison, et c'est pourquoi `dessinerArbre` vit dans lib/ : le serveur
 *    fait la première image, ce composant fait toutes les suivantes.
 */
export default function ArbreZoom({
  gens,
  unions,
  racineId,
  moiId,
  svg,
  largeur,
  hauteur,
  racineXY,
  moiXY,
  ascendance = false,
}: {
  gens: Personne[];
  unions: Union[];
  /** Vue « d'où l'on vient » : le moteur, et les gestes, ne sont pas les mêmes. */
  ascendance?: boolean;
  racineId: string;
  moiId: string | null;
  /** La première image, dessinée par le serveur. */
  svg: string;
  largeur: number;
  hauteur: number;
  /** Le centre de la racine : le repli quand le lecteur n'a pas de fiche. */
  racineXY: { x: number; y: number };
  /** La carte du lecteur, quand il en a une : c'est elle que l'arrivée vise. */
  moiXY: { x: number; y: number } | null;
}) {
  const router = useRouter();
  const enveloppe = useRef<HTMLDivElement>(null);
  const cadre = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const vue = useRef({ x: 0, y: 0, k: 1 });
  const doigts = useRef(new Map<number, { x: number; y: number }>());
  const pince = useRef<{ d: number; k: number } | null>(null);
  const depart = useRef<{ x: number; y: number; bouge: boolean } | null>(null);

  // Le dessin courant. `null` tant que celui du serveur est à l'écran : on ne
  // recalcule rien tant que rien n'a changé — l'arrivée ne paie pas le prix
  // d'une exploration qui n'a pas encore commencé.
  const dessin = useRef<Dessin | null>(null);
  const taille = useRef({ largeur, hauteur });
  const zoomRef = useRef<((f: number, x: number, y: number) => void) | null>(null);

  const [orientation, setOrientation] = useState<Orientation>("vertical");
  const [plies, setPlies] = useState<string[]>([]);
  const [plein, setPlein] = useState(false);

  // L'état de l'exploration existe en double : en `useState` pour que les
  // boutons se redessinent, en `ref` pour que les gestes — qui vivent dans des
  // écouteurs posés une fois — lisent toujours la valeur du moment plutôt que
  // celle qu'ils ont capturée à leur naissance. Le ref se met à jour dans les
  // gestes eux-mêmes, jamais pendant un rendu.
  const etat = useRef({ orientation, plies });

  /** Le dessin courant, calculé au premier besoin. */
  const courant = useCallback((): Dessin => {
    if (!dessin.current) {
      // 🔑 Le composant redessine à chaque geste : sans ce choix de moteur,
      // coucher l'arbre en vue « ancêtres » le remplacerait silencieusement
      // par une descendance.
      dessin.current = ascendance
        ? dessinerAscendance(gens, {
            racineId,
            moiId,
            orientation: etat.current.orientation,
          })
        : dessinerArbre(gens, unions, {
            racineId,
            moiId,
            orientation: etat.current.orientation,
            plies: etat.current.plies,
          });
    }
    return dessin.current;
  }, [gens, unions, racineId, moiId, ascendance]);

  const appliquer = useCallback(() => {
    const s = scene.current;
    if (!s) return;
    const { x, y, k } = vue.current;
    s.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    // Le détail se retire quand il devient illisible : à un dixième d'échelle,
    // les années et les patronymes ne sont plus que du gris qui rame. C'est le
    // « niveau de détail » du dessin de cartes — on ne dessine que ce qui se
    // lit à la distance où l'on est.
    s.classList.toggle("arbre-loin", k < 0.34);
    s.classList.toggle("arbre-tres-loin", k < 0.12);
  }, []);

  /** Le plancher du zoom : la vue « tout », quelle que soit la taille du dessin. */
  const bornes = useCallback(() => {
    const c = cadre.current;
    const { largeur: la, hauteur: ha } = taille.current;
    if (!c) return { MIN: 0.05, MAX: 3 };
    return {
      MIN: Math.min(0.05, c.clientWidth / la, c.clientHeight / ha),
      MAX: 3,
    };
  }, []);

  const viser = useCallback(
    (p: { x: number; y: number } | null, k = 0.9) => {
      const c = cadre.current;
      if (!c) return;
      if (!p) {
        // Sans point de mire : la racine, à hauteur d'écran.
        const ha = taille.current.hauteur;
        const kk = Math.max(bornes().MIN, Math.min(c.clientHeight / ha, 1));
        vue.current = {
          k: kk,
          x: c.clientWidth / 2 - racineXY.x * kk,
          y: (c.clientHeight - ha * kk) / 2,
        };
      } else {
        vue.current = {
          k,
          x: c.clientWidth / 2 - p.x * k,
          y: c.clientHeight / 2 - p.y * k,
        };
      }
      appliquer();
    },
    [appliquer, bornes, racineXY],
  );

  /**
   * Redessiner sans perdre le lecteur.
   *
   * Un pli change TOUTES les coordonnées : à largeur constante, l'arbre se
   * réorganise et la carte qu'on regardait part à l'autre bout. La parade est
   * l'ancre — la fiche qu'on vient de toucher reste exactement sous le doigt,
   * et le reste s'ouvre ou se referme autour d'elle. Sans cela, chaque pli
   * demande de se retrouver, et l'on renonce au bout de deux.
   */
  const redessiner = useCallback(
    (suite: { orientation?: Orientation; plies?: string[] }, ancre?: string) => {
      const c = cadre.current;
      const s = scene.current;
      if (!c || !s) return;

      const avant = ancre ? courant().positions.get(ancre) : undefined;
      const v = vue.current;
      const ecran = avant
        ? { x: avant.x * v.k + v.x, y: avant.y * v.k + v.y }
        : null;

      const prochain = {
        orientation: suite.orientation ?? etat.current.orientation,
        plies: suite.plies ?? etat.current.plies,
      };
      const d = ascendance
        ? dessinerAscendance(gens, {
            racineId,
            moiId,
            orientation: prochain.orientation ?? etat.current.orientation,
          })
        : dessinerArbre(gens, unions, { racineId, moiId, ...prochain });
      dessin.current = d;
      etat.current = prochain;
      taille.current = { largeur: d.largeur, hauteur: d.hauteur };
      // On écrit DANS le div de React, jamais à sa place : sa prop `__html` ne
      // change plus jamais, React n'y touchera donc pas, et l'arbre reste
      // maître de son contenu sans que la réconciliation ait son mot à dire.
      (s.firstElementChild as HTMLElement).innerHTML = d.svg;

      const apres = ancre ? d.positions.get(ancre) : undefined;
      if (ecran && apres) {
        vue.current = {
          k: v.k,
          x: ecran.x - apres.x * v.k,
          y: ecran.y - apres.y * v.k,
        };
        appliquer();
      } else if (suite.orientation) {
        // Coucher l'arbre change tout : on revient sur soi plutôt que de
        // laisser le lecteur au milieu d'un dessin qui a pivoté.
        viser(moiId ? (d.positions.get(moiId) ?? null) : null);
      } else {
        appliquer();
      }

      if (suite.orientation) setOrientation(suite.orientation);
      if (suite.plies) setPlies(suite.plies);
    },
    [appliquer, courant, gens, moiId, racineId, unions, viser, ascendance],
  );

  const basculer = useCallback(
    (id: string) => {
      const s = new Set(etat.current.plies);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      redessiner({ plies: [...s] }, id);
    },
    [redessiner],
  );

  // ── Les gestes ──
  useEffect(() => {
    const c = cadre.current;
    if (!c) return;

    const zoomer = (facteur: number, px: number, py: number) => {
      const { MIN, MAX } = bornes();
      const v = vue.current;
      const k = Math.max(MIN, Math.min(MAX, v.k * facteur));
      const r = k / v.k;
      vue.current = { k, x: px - (px - v.x) * r, y: py - (py - v.y) * r };
      appliquer();
    };
    zoomRef.current = zoomer;

    const surMolette = (e: WheelEvent) => {
      e.preventDefault();
      const b = c.getBoundingClientRect();
      zoomer(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - b.left, e.clientY - b.top);
    };

    const surAppui = (e: PointerEvent) => {
      doigts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      depart.current = { x: e.clientX, y: e.clientY, bouge: false };
      if (doigts.current.size === 2) {
        const [a, b] = [...doigts.current.values()];
        pince.current = { d: Math.hypot(a.x - b.x, a.y - b.y), k: vue.current.k };
        depart.current.bouge = true;
      }
    };

    const surMouvement = (e: PointerEvent) => {
      const avant = doigts.current.get(e.pointerId);
      if (!avant) return;
      const apres = { x: e.clientX, y: e.clientY };
      doigts.current.set(e.pointerId, apres);

      if (doigts.current.size === 2 && pince.current) {
        const [a, b] = [...doigts.current.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const box = c.getBoundingClientRect();
        const cible = pince.current.k * (d / pince.current.d);
        zoomer(cible / vue.current.k, (a.x + b.x) / 2 - box.left, (a.y + b.y) / 2 - box.top);
        return;
      }
      if (doigts.current.size !== 1 || !depart.current) return;

      // 🔑 La capture du pointeur n'arrive qu'APRÈS le seuil de glissement.
      // Capturée dès l'appui, elle détournait tous les événements vers le
      // cadre : le navigateur ne cherchait plus ce qu'il y avait sous le doigt
      // et AUCUN lien de l'arbre ne s'ouvrait jamais. Le seuil rend l'appui
      // immobile à ce qu'il est — un clic.
      const loin =
        Math.hypot(apres.x - depart.current.x, apres.y - depart.current.y) > 6;
      if (!loin && !depart.current.bouge) return;
      if (!depart.current.bouge) {
        depart.current.bouge = true;
        c.setPointerCapture(e.pointerId);
      }
      vue.current.x += apres.x - avant.x;
      vue.current.y += apres.y - avant.y;
      appliquer();
    };

    const surRelache = (e: PointerEvent) => {
      doigts.current.delete(e.pointerId);
      if (doigts.current.size < 2) pince.current = null;
    };

    /**
     * Un appui immobile ouvre quelque chose : la poignée d'une branche, ou la
     * fiche de la personne. La navigation passe par le routeur et non par le
     * lien natif — un rechargement complet pour changer de page ferait perdre
     * la position dans l'arbre, et prendrait deux secondes sur un téléphone.
     */
    const surClic = (e: MouseEvent) => {
      const cible = e.target as HTMLElement | null;
      if (!cible) return;
      // detail === 0 : activation au clavier, qui n'a ni glissement ni doigt.
      if (e.detail !== 0 && depart.current?.bouge) {
        e.preventDefault();
        return;
      }
      const poignee = cible.closest?.("[data-plier]");
      if (poignee) {
        e.preventDefault();
        basculer(poignee.getAttribute("data-plier")!);
        return;
      }
      const lien = cible.closest?.("a");
      const href = lien?.getAttribute("href");
      if (href) {
        e.preventDefault();
        router.push(href);
      }
    };

    c.addEventListener("wheel", surMolette, { passive: false });
    c.addEventListener("pointerdown", surAppui);
    c.addEventListener("pointermove", surMouvement);
    c.addEventListener("pointerup", surRelache);
    c.addEventListener("pointercancel", surRelache);
    c.addEventListener("click", surClic);

    return () => {
      c.removeEventListener("wheel", surMolette);
      c.removeEventListener("pointerdown", surAppui);
      c.removeEventListener("pointermove", surMouvement);
      c.removeEventListener("pointerup", surRelache);
      c.removeEventListener("pointercancel", surRelache);
      c.removeEventListener("click", surClic);
    };
  }, [appliquer, basculer, bornes, router]);

  const zoom = (f: number) => {
    const c = cadre.current;
    if (c) zoomRef.current?.(f, c.clientWidth / 2, c.clientHeight / 2);
  };

  // L'arrivée vise le lecteur : sa carte au centre, surlignée, à une échelle où
  // elle se lit. On ouvre cette page pour se trouver dans l'arbre.
  useEffect(() => {
    viser(moiXY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const surSortie = () => setPlein(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", surSortie);
    return () => document.removeEventListener("fullscreenchange", surSortie);
  }, []);

  const surMoi = () => {
    const d = dessin.current;
    viser(d && moiId ? (d.positions.get(moiId) ?? null) : moiXY);
  };

  const pleinEcran = async () => {
    const e = enveloppe.current;
    if (!e) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await e.requestFullscreen?.();
  };

  const bouton =
    "inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-sm";

  return (
    <div ref={enveloppe} className={plein ? "bg-background p-2" : ""}>
      {/* Les commandes AU-DESSUS du dessin, en toutes lettres. Des icônes
          seules dans un coin, c'est une devinette de plus pour une famille dont
          le quart a plus de soixante-dix ans. */}
      <div className="mb-2 flex flex-wrap gap-2">
        <button
          onClick={() =>
            redessiner({
              orientation: orientation === "vertical" ? "horizontal" : "vertical",
            })
          }
          className={bouton}
        >
          <span aria-hidden>{orientation === "vertical" ? "↔" : "↕"}</span>
          {orientation === "vertical" ? "Coucher l'arbre" : "Redresser l'arbre"}
        </button>
        <button onClick={pleinEcran} className={bouton}>
          <span aria-hidden>{plein ? "✕" : "⛶"}</span>
          {plein ? "Quitter le plein écran" : "Plein écran"}
        </button>
        {plies.length > 0 ? (
          <button
            onClick={() => redessiner({ plies: [] }, moiId ?? racineId)}
            className={`${bouton} border-accent-line bg-accent-surface text-accent`}
          >
            <span aria-hidden>⊕</span> Tout rouvrir
          </button>
        ) : (
          <button
            onClick={() =>
              redessiner({ plies: replierSauf(gens, unions, racineId, moiId) }, moiId ?? racineId)
            }
            className={bouton}
          >
            <span aria-hidden>⊖</span> Ne garder que ma lignée
          </button>
        )}
      </div>

      <div className="relative">
        <div
          ref={cadre}
          className={`${plein ? "h-[calc(100vh-4.5rem)]" : "h-[70vh]"} cursor-grab touch-none overflow-hidden rounded-xl border border-line bg-card active:cursor-grabbing`}
        >
          <div ref={scene} className="origin-top-left will-change-transform">
            {/* Le SVG vient du serveur, déjà dessiné : le client n'assemble
                rien tant que le lecteur n'a rien plié. dangerouslySetInnerHTML
                est sûr ici parce que CHAQUE texte inséré passe par
                l'échappement — même règle que les bulles de la carte. */}
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
        </div>

        {/* Les trois boutons pour qui n'a ni molette ni l'habitude du
            pincement : c'est-à-dire une bonne partie de la famille. 44 px. */}
        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          <button
            onClick={() => zoom(1.4)}
            aria-label="agrandir"
            className="size-11 rounded-lg border border-line bg-card text-xl font-medium shadow-sm"
          >
            +
          </button>
          <button
            onClick={() => zoom(1 / 1.4)}
            aria-label="réduire"
            className="size-11 rounded-lg border border-line bg-card text-xl font-medium shadow-sm"
          >
            −
          </button>
          <button
            onClick={surMoi}
            aria-label="revenir à ma fiche"
            className="size-11 rounded-lg border border-accent-line bg-accent-surface text-xs font-medium text-accent shadow-sm"
          >
            moi
          </button>
        </div>
      </div>
    </div>
  );
}
