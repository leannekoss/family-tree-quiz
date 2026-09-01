"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import RattacherHabitants, { type Gens } from "@/components/RattacherHabitants";
import HistoireMaison from "@/components/HistoireMaison";
import "leaflet/dist/leaflet.css";

export type MapPlace = {
  id: number;
  name: string;
  commune: string | null;
  lat: number | null;
  lon: number | null;
  geo_precision: string | null;
  geo_source: string | null;
  occupants: string | null;
  residents: { id: string; name: string }[];
  /**
   * Loin du pays — Prayssas, Saint-Cernin, Saint-Vite. Le drapeau ne dit plus
   * « à cacher » mais « à ne pas cadrer » : ces trois maisons ont des
   * coordonnées exactes et méritent leur point, mais les faire entrer dans le
   * cadre de départ tasserait les vingt-sept autres au centre. On les pose, on
   * ne les vise pas.
   */
  outside: boolean;
  /** Le récit du bulletin : dix lignes, puis tout le reste derrière un pli. */
  resume: string | null;
  histoire: string | null;
  histoire_source: string | null;
};

// Fond IGN plutôt qu'OpenStreetMap : le Plan IGN nomme les lieux-dits et les
// fermes isolées, ce qui est exactement l'échelle qui nous intéresse, et les
// tuiles viennent d'un organisme public français.
const IGN_TILES =
  "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
  "&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM" +
  "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png";

const CENTRE: [number, number] = [44.5333, 0.7667]; // Monflanquin

/**
 * Les noms viennent de la base et de ce que la famille y écrit. Leaflet attend
 * du HTML pour ses bulles : sans échappement, une apostrophe typographique
 * passerait, mais un nom contenant un chevron ouvrirait une balise. On ne colle
 * jamais une donnée de la base dans du HTML sans la neutraliser.
 */
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export default function PlacesMap({
  places: initial,
  gens,
  viser = null,
}: {
  places: MapPlace[];
  gens: Gens[];
  /** La maison à ouvrir en arrivant, quand on vient de la recherche. */
  viser?: number | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [places, setPlaces] = useState(initial);
  const [active, setActive] = useState<MapPlace | null>(null);
  const [editing, setEditing] = useState(false);
  const [placing, setPlacing] = useState<MapPlace | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [modifie, setModifie] = useState(false);

  // Les gestionnaires Leaflet sont attachés une fois ; ils lisent l'état
  // courant par référence plutôt que d'être recréés à chaque rendu.
  // Mise à jour après le rendu et non pendant : écrire dans une ref au milieu
  // d'un rendu est ce que React interdit désormais, et les gestionnaires Leaflet
  // ne lisent la valeur qu'au moment d'un clic — toujours après.
  const state = useRef({ editing, placing, active });
  useEffect(() => {
    state.current = { editing, placing, active };
  });

  const view = useRef<{ center: [number, number]; zoom: number } | null>(null);

  // La maison visée n'est ouverte QU'UNE FOIS. Sans ce garde-fou, chaque
  // reconstruction de la carte — après un déplacement de point, par exemple —
  // ramènerait le lecteur de force sur la maison d'origine, et son propre
  // déplacement serait annulé sous ses doigts.
  const vise = useRef(false);

  // La carte et ses points, gardés sous la main pour que la LISTE puisse leur
  // parler. Sans cela, toucher une maison dans la liste ne remplissait qu'un
  // panneau situé sous la carte : sur un téléphone, rien ne bougeait à l'écran
  // et on croyait que le toucher n'avait pas pris.
  const carte = useRef<import("leaflet").Map | null>(null);
  const marqueurs = useRef(new Map<number, import("leaflet").Marker>());

  /**
   * Montrer une maison : la carte s'y rend, sa bulle s'ouvre, et la page
   * remonte jusqu'à la carte.
   *
   * Le retour en haut est la moitié du geste. La liste est longue — trente
   * maisons — et quand on touche la dernière, la carte est à deux écrans plus
   * haut : elle aurait beau se centrer, personne ne le verrait.
   */
  function montrerSurLaCarte(p: MapPlace) {
    const m = carte.current;
    if (!m || p.lat === null || p.lon === null) return;

    // Zoom 16 : la maison et ses abords. On ne descend jamais en dessous du
    // zoom courant — quelqu'un qui a zoomé l'a fait exprès.
    m.setView([p.lat, p.lon], Math.max(m.getZoom(), 16), { animate: true });
    marqueurs.current.get(p.id)?.openPopup();
    container.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /**
   * Corriger le nom, la commune ou les habitants d'une maison.
   *
   * On pouvait déplacer un point, jamais le renommer : une maison mal
   * orthographiée sur le relevé du bulletin, ou vendue depuis, restait fausse
   * pour tout le monde. Le nom est ce par quoi on la reconnaît — c'est la
   * première chose à pouvoir réparer.
   */
  async function modifierMaison(
    id: number,
    champs: { name: string; commune: string | null; occupants: string | null },
  ) {
    const { error } = await supabaseBrowser().from("places").update(champs).eq("id", id);
    if (error) {
      setSaved(`« ${champs.name} » n'a pas pu être enregistré : ${error.message}`);
      return;
    }
    setPlaces((all) => all.map((p) => (p.id === id ? { ...p, ...champs } : p)));
    setActive((a) => (a && a.id === id ? { ...a, ...champs } : a));
    setSaved(`« ${champs.name} » enregistré.`);
    setModifie(false);
  }

  async function move(place: MapPlace, lat: number, lon: number) {
    const supabase = supabaseBrowser();
    const { error } = await supabase
      .from("places")
      .update({
        lat,
        lon,
        geo_precision: "exact",
        geo_source: "famille",
        note: null,
      })
      .eq("id", place.id);

    if (error) {
      setSaved(`« ${place.name} » n'a pas pu être enregistré : ${error.message}`);
      return;
    }
    setPlaces((all) =>
      all.map((p) => (p.id === place.id ? { ...p, lat, lon, geo_source: "famille" } : p)),
    );
    setSaved(`« ${place.name} » déplacé et enregistré.`);
    setPlacing(null);
  }

  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    let map: import("leaflet").Map | null = null;
    const layers: import("leaflet").Layer[] = [];
    // Le nom porté par chaque point, avec ce qu'il faut pour arbitrer quand
    // deux se disputent la même place à l'écran.
    const etiquettes: {
      marker: import("leaflet").Marker;
      nom: string;
      habitee: boolean;
    }[] = [];

    // Les étiquettes se disputent la place autour de Monflanquin : on les
    // écarte en alternant leur côté, et `ajusterEtiquettes` masque celles qui
    // se recouvrent encore. Il n'y a plus de seuil de zoom à régler — c'est la
    // place réellement disponible qui décide, ce qu'aucune constante ne sait.

    // Leaflet touche à `window` dès l'import : chargement après montage.
    import("leaflet").then((L) => {
      if (cancelled || !container.current) return;

      map = L.map(container.current, { scrollWheelZoom: false });
      carte.current = map;
      L.tileLayer(IGN_TILES, { maxZoom: 18, attribution: "© IGN — Géoplateforme" }).addTo(map);

      // Après un déplacement la carte est reconstruite : on remet la vue là où
      // elle était, sinon on perd son zoom à chaque correction.
      const situated = places.filter((p) => p.lat !== null && p.lon !== null);
      // Le cadre de départ ne retient que les maisons du pays. Prayssas est à
      // quarante kilomètres de Monflanquin : l'y faire entrer ferait reculer la
      // carte au point de tasser les vingt-sept autres en une grappe illisible.
      // Elles restent posées et se trouvent en dézoomant — ou depuis la liste.
      const aCadrer = situated.filter((p) => !p.outside);
      if (view.current) {
        map.setView(view.current.center, view.current.zoom);
      } else if (aCadrer.length > 0 || situated.length > 0) {
        map.fitBounds(
          L.latLngBounds(
            (aCadrer.length > 0 ? aCadrer : situated).map(
              (p) => [p.lat!, p.lon!] as [number, number],
            ),
          ),
          { padding: [30, 30] },
        );
      } else {
        map.setView(CENTRE, 12);
      }

      // Poser une maison qui n'avait pas de position : un clic sur la carte.
      const remember = () => {
        const c = map!.getCenter();
        view.current = { center: [c.lat, c.lng], zoom: map!.getZoom() };
      };

      /**
       * Les noms apparaissent un à un, à mesure que le zoom leur fait de la
       * place.
       *
       * Avant, un seuil unique décidait pour tout le monde : en dessous, aucun
       * nom ; au-dessus, les trente d'un coup, dont six se chevauchaient dans
       * les deux kilomètres autour de La Prade. La carte était illisible d'un
       * côté du seuil et muette de l'autre.
       *
       * Ici chaque étiquette est posée si elle ne recouvre aucune de celles
       * déjà posées. En zoomant, les points s'écartent, les places se libèrent,
       * et les noms sortent progressivement — sans réglage à trouver.
       *
       * ⚠️ Une maison n'est JAMAIS cachée : seul son nom l'est. Le point reste,
       * et le toucher ouvre sa bulle. Escamoter des maisons ferait croire
       * qu'elles n'existent pas, ce qui est le défaut qu'on est venu corriger.
       */
      const ajusterEtiquettes = () => {
        const posees: DOMRect[] = [];
        // Les maisons habitées passent devant : entre deux noms qui se
        // disputent la même place, celui qui abrite quelqu'un est le plus utile.
        // Ordre stable ensuite, sinon l'affichage change à chaque mouvement.
        const ordre = [...etiquettes].sort(
          (a, b) => Number(b.habitee) - Number(a.habitee) || a.nom.localeCompare(b.nom),
        );

        for (const e of ordre) {
          const el = e.marker.getTooltip()?.getElement();
          if (!el) continue;

          // `visibility` et surtout PAS `display: none` : Leaflet centre chaque
          // étiquette d'après sa largeur, or un élément en `display: none` en a
          // une nulle. Les étiquettes masquées se retrouvaient donc décalées,
          // on mesurait des boîtes fausses, et des noms continuaient de se
          // chevaucher au zoom fort. Masquée en `visibility`, l'étiquette garde
          // sa place et sa taille — elle est seulement invisible.
          const r = el.getBoundingClientRect();

          const chevauche = posees.some(
            (p) =>
              r.left < p.right && r.right > p.left && r.top < p.bottom && r.bottom > p.top,
          );
          el.style.visibility = chevauche ? "hidden" : "";
          if (!chevauche) posees.push(r);
        }
      };

      map.on("moveend", remember);
      map.on("zoomend", () => {
        remember();
        // Deux images d'attente avant de mesurer : `zoomend` est émis quand
        // l'animation de la carte se termine, mais Leaflet repositionne les
        // étiquettes juste après. Mesurer tout de suite donne les anciennes
        // coordonnées — quatre chevauchements survivaient ainsi au zoom fort.
        requestAnimationFrame(() => requestAnimationFrame(ajusterEtiquettes));
      });

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        const target = state.current.placing;
        if (target) void move(target, e.latlng.lat, e.latlng.lng);
      });

      for (const p of situated) {
        // Une maison est habitée dès que le bulletin nomme quelqu'un, même sans
        // fiche rattachée : ces noms-là sont souvent la seule trace qu'on ait
        // de cousins par alliance.
        const known = p.residents.length > 0 || Boolean(p.occupants);

        // L'annuaire national place mal les fermes isolées : La Borie, La
        // Farlouse et Laroque en sont sortis faux. Ces points-là s'annoncent
        // comme à vérifier plutôt que de se faire passer pour justes.
        const doubtful = p.geo_source === "ban";
        const size = known ? 20 : 14;

        // Deux informations, deux canaux — et c'était le défaut. Le cercle
        // creux pointillé disait « position à vérifier », mais il effaçait le
        // remplissage qui disait « quelqu'un habite ici » : neuf maisons sur
        // vingt-six, toutes habitées, s'affichaient exactement comme une maison
        // vide. Un tiers de la carte mentait sur son contenu.
        //
        // Désormais le disque porte l'habitation, l'anneau extérieur porte le
        // doute sur la position. Les deux se lisent d'un coup d'œil et ne se
        // disputent plus.
        const marker = L.marker([p.lat!, p.lon!], {
          draggable: editing,
          icon: L.divIcon({
            className: "",
            html: `<span style="display:block;width:${size}px;height:${size}px;
              border-radius:9999px;box-sizing:border-box;
              border:2px solid #fff;
              background:${known ? "#9c4221" : "#7d7269"};
              ${doubtful ? "outline:2px dashed #9c4221;outline-offset:2px;" : ""}
              box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          }),
        }).addTo(map!);

        // Étiquette affichée en permanence : sur un téléphone il n'y a pas de
        // survol, les noms restaient donc invisibles jusqu'au toucher. Elles
        // s'effacent en dessous d'un certain zoom, où six maisons tiennent dans
        // deux kilomètres et où tous les noms se chevaucheraient.
        // Un côté différent d'un point à l'autre : deux maisons voisines ne
        // portent donc jamais leur nom au même endroit.
        const cotes = ["top", "right", "bottom", "left"] as const;
        const cote = cotes[etiquettes.length % cotes.length];
        const ecart: Record<string, [number, number]> = {
          top: [0, -6], bottom: [0, 6], left: [-6, 0], right: [6, 0],
        };

        // `escapeHtml` et non `p.name` brut : Leaflet insère le contenu d'une
        // étiquette en innerHTML quand c'est une chaîne (leaflet-src.js,
        // `node.innerHTML = content`). Or le nom d'une maison est écrit par les
        // membres, et l'étiquette est PERMANENTE — du code glissé dans un nom
        // s'exécuterait chez tous ceux qui ouvrent la carte, sans un clic.
        // La bulle, elle, échappait déjà : c'est l'étiquette qui avait été
        // oubliée.
        marker.bindTooltip(escapeHtml(p.name), {
          direction: cote,
          offset: ecart[cote],
          className: "etiquette-lieu",
          permanent: true,
        });
        etiquettes.push({ marker, nom: p.name, habitee: known });
        marqueurs.current.set(p.id, marker);

        // La page promet « touchez un point pour voir qui y habite ». Elle ne
        // tenait pas parole : le toucher ne faisait que surligner une ligne
        // dans la liste, plus bas, hors de l'écran sur un téléphone. On tapait,
        // rien ne bougeait, et on en concluait que l'application était cassée.
        // La bulle répond sur place, à l'endroit où le doigt s'est posé.
        //
        // Les noms mènent aux fiches. Une liste de noms qu'on ne peut pas
        // toucher est une impasse : on lit « Nathalie Vernet », on veut
        // savoir qui c'est, et il faut ressortir de la carte pour la chercher.
        // Un lien ordinaire plutôt qu'une navigation interne — Leaflet écrit
        // cette bulle hors de React, et un rechargement de page vaut mieux
        // qu'un lien mort.
        const fiches = p.residents
          .map(
            (r) =>
              `<a href="/personne/${encodeURIComponent(r.id)}" style="color:#9c4221;font-weight:500">${escapeHtml(r.name)}</a>`,
          )
          .join(", ");

        const qui = [
          fiches && `<br><span style="opacity:.7">Habitent ici :</span> ${fiches}`,
          // Le relevé du bulletin, tel quel : il nomme des gens qui n'ont pas
          // de fiche, et c'est souvent la seule fois où leur nom apparaît.
          p.occupants &&
            `<br><span style="opacity:.7">${fiches ? "Sur la carte du bulletin" : "D'après le bulletin"} :</span> ${escapeHtml(p.occupants)}`,
          !fiches && !p.occupants && `<br>Personne n'est encore rattaché à cette maison.`,
        ]
          .filter(Boolean)
          .join("");

        // La maison est déjà posée au mètre près : la vue aérienne ne coûte donc
        // aucune saisie, juste un lien. On y voit la ferme en 1950, les
        // dépendances disparues, le bois qui a poussé — ce que trois
        // générations racontent sans pouvoir le montrer.
        //
        // 800 m de large : on ne vient pas voir un toit, on vient voir le
        // domaine — les champs, le bois, le chemin, ce qui a changé autour.
        // À 150 m la maison remplit l'image et l'on ne compare plus rien d'un
        // millésime à l'autre. Quatre décimales (~11 m) suffisent et évitent de
        // publier une position plus précise que nécessaire.
        //
        // `noreferrer` : cet arbre est privé et non indexable. Un lien sortant
        // ordinaire annoncerait son adresse aux journaux d'un site public.
        const remonter =
          `<br><a href="https://remonter-le-temps.vercel.app/?lat=${p.lat!.toFixed(4)}` +
          `&lon=${p.lon!.toFixed(4)}&w=800" target="_blank" rel="noreferrer"` +
          ` style="color:#9c4221;font-weight:500">Voir l’évolution depuis 1950 ↗</a>`;

        marker.bindPopup(
          `<strong>${escapeHtml(p.name)}</strong>` +
            (p.commune ? `<br><span style="opacity:.7">${escapeHtml(p.commune)}</span>` : "") +
            qui +
            remonter +
            (doubtful
              ? `<br><span style="opacity:.7">Position à vérifier — la vue aérienne peut tomber à côté.</span>`
              : ""),
          { closeButton: true, autoPan: true },
        );

        marker.on("click", () =>
          setActive(state.current.active?.id === p.id ? null : p),
        );
        marker.on("dragend", () => {
          const { lat, lng } = marker.getLatLng();
          void move(p, Number(lat.toFixed(6)), Number(lng.toFixed(6)));
        });

        layers.push(marker);
      }

      // Premier passage : la vue initiale peut déjà être trop large.
      ajusterEtiquettes();

      // La maison qu'on est venu voir. C'est ici et pas plus tôt : la fonction
      // a besoin des marqueurs, qui n'existent qu'une fois Leaflet chargé et
      // les points posés.
      //
      // Chercher « La Borie » ouvrait la carte des trente maisons, à charge
      // pour le lecteur de retrouver la sienne au milieu — sur un téléphone,
      // c'est-à-dire pas du tout.
      if (viser && !vise.current) {
        const cible = places.find((p) => p.id === viser);
        if (cible) {
          vise.current = true;
          setActive(cible);
          montrerSurLaCarte(cible);
        }
      }
    });

    return () => {
      cancelled = true;
      layers.length = 0;
      map?.remove();
    };
  }, [places, editing]);

  // Ajouter une maison que le bulletin a oubliée. Elle naît sans position :
  // elle rejoint la liste « sans position », où un doigt la posera.
  async function ajouter(nom: string, habitants: string, commune: string) {
    const { data, error } = await supabaseBrowser()
      .from("places")
      .insert({
        name: nom.trim(),
        occupants: habitants.trim() || null,
        commune: commune.trim() || null,
        outside: false,
      })
      .select("id, name, commune, lat, lon, geo_precision, geo_source, occupants, outside, resume, histoire, histoire_source")
      .single();

    if (error) {
      setSaved(`« ${nom} » n'a pas pu être ajoutée : ${error.message}`);
      return;
    }
    setPlaces((all) => [...all, { ...data, residents: [] }]);
    setSaved(`« ${data.name} » ajoutée. Touchez-la ci-dessous puis la carte pour la poser.`);
  }

  const situated = places.filter((p) => p.lat !== null);
  const unplaced = places.filter((p) => p.lat === null);
  const doubtfulCount = situated.filter((p) => p.geo_source === "ban").length;
  const inhabited = situated.filter((p) => p.residents.length > 0);
  const others = situated.filter((p) => p.residents.length === 0);

  return (
    <div>
      <div
        ref={container}
        className={`h-[55vh] min-h-[320px] w-full overflow-hidden rounded-xl border ${
          placing ? "border-accent" : "border-line"
        }`}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {placing
            ? `Touchez la carte à l'endroit exact de « ${placing.name} ».`
            : editing
              ? "Faites glisser un point pour le corriger. C'est enregistré aussitôt."
              : doubtfulCount > 0
                ? `Touchez un point pour savoir qui y habite. ${doubtfulCount} position${
                    doubtfulCount > 1 ? "s viennent" : " vient"
                  } d'un annuaire national et mérite${
                    doubtfulCount > 1 ? "nt" : ""
                  } un coup d'œil — ceux qu'un pointillé entoure.`
                : "Touchez un point pour savoir qui y habite."}
        </p>
        <button
          onClick={() => {
            setEditing(!editing);
            setPlacing(null);
          }}
          className={`rounded-lg border px-3 py-1.5 text-sm ${
            editing ? "border-accent bg-accent-soft" : "border-line"
          }`}
        >
          {editing ? "Terminer" : "Corriger les positions"}
        </button>
      </div>

      {saved && <p className="mt-2 text-sm text-accent">{saved}</p>}

      {unplaced.length > 0 && (
        <section className="mt-6 rounded-xl border border-line bg-card p-4">
          <h2 className="serif text-lg">
            {unplaced.length} maison{unplaced.length > 1 ? "s" : ""} sans position
          </h2>
          <p className="mt-1 text-sm text-muted">
            Aucun annuaire ne les connaît. Choisissez-en une, puis touchez la carte
            au bon endroit.
          </p>
          {/* Le nom des habitants est ce qui permet de retrouver la maison :
              « Fourneque » ne dit rien à personne, « chez Martine » situe. */}
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {unplaced.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setPlacing(placing?.id === p.id ? null : p)}
                  className={`w-full rounded-lg border px-3 py-2 text-left ${
                    placing?.id === p.id
                      ? "border-accent bg-accent-soft"
                      : "border-line"
                  }`}
                >
                  <span className="serif block text-sm font-medium">
                    {p.name}
                    {p.commune && <span className="text-muted"> · {p.commune}</span>}
                  </span>
                  {p.occupants && (
                    <span className="mt-0.5 block text-xs text-muted">{p.occupants}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {active && modifie && (
        <CorrigerMaison
          key={active.id}
          maison={active}
          onEnregistrer={(champs) => modifierMaison(active.id, champs)}
          onAnnuler={() => setModifie(false)}
        />
      )}

      {active && !modifie && (
        <div className="mt-4 rounded-xl border border-accent bg-accent-surface p-4">
          <h2 className="serif text-xl">{active.name}</h2>
          {active.commune && (
            <p className="text-sm text-muted">commune de {active.commune}</p>
          )}

          {/* Le relevé du bulletin, tel quel. Il nomme des gens qui n'ont pas de
              fiche — cousins par alliance, voisins de toujours — et c'est
              souvent la seule fois où leur nom apparaît quelque part. */}
          {active.occupants && (
            <p className="mt-2 text-sm">{active.occupants}</p>
          )}

          {active.residents.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {active.residents.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/personne/${r.id}`}
                    className="inline-block rounded-lg border border-line bg-card px-3 py-1.5 text-sm"
                  >
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {active.residents.length === 0 && (
            <p className="mt-2 text-xs text-muted">
              Personne d&apos;ici n&apos;a encore de fiche dans l&apos;arbre.
            </p>
          )}

          <RattacherHabitants
            maisonId={active.id}
            maisonNom={active.name}
            gens={gens}
          />

          {/* L'histoire APRÈS les habitants. On ouvre une maison pour savoir qui
              y est — c'est la question de la carte — et c'est une fois qu'on l'a
              trouvée qu'on veut savoir ce qui s'y est passé.

              La clé force le remontage quand on passe d'une maison à l'autre :
              sans elle, React garde l'état du composant et les souvenirs de
              La Prade s'afficheraient un instant sous le nom de Pautard. */}
          <HistoireMaison
            key={active.id}
            maisonId={active.id}
            resume={active.resume}
            histoire={active.histoire}
            source={active.histoire_source}
          />

          <div className="mt-4 border-t border-accent-line pt-3">
            <button
              onClick={() => setModifie(true)}
              className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm"
            >
              Corriger cette maison
            </button>
          </div>
        </div>
      )}

      <PlaceList title="Habitées par la descendance" places={inhabited} active={active}
        onPick={(p) => {
          setActive(p);
          montrerSurLaCarte(p);
        }}
      />
      <PlaceList title="Branches cousines" places={others} active={active}
        onPick={(p) => {
          setActive(p);
          montrerSurLaCarte(p);
        }}
      />

      <AjouterMaison onAjout={ajouter} />
    </div>
  );
}

/**
 * Corriger une maison : son nom, sa commune, qui y habite d'après le bulletin.
 *
 * Trois champs, pas un de plus. La position se corrige déjà en faisant glisser
 * le point, et la mêler à un formulaire donnerait deux façons de faire la même
 * chose — celle qu'on choisit au hasard et celle qu'on cherche ensuite.
 */
function CorrigerMaison({
  maison,
  onEnregistrer,
  onAnnuler,
}: {
  maison: MapPlace;
  onEnregistrer: (champs: {
    name: string;
    commune: string | null;
    occupants: string | null;
  }) => void;
  onAnnuler: () => void;
}) {
  const [nom, setNom] = useState(maison.name);
  const [commune, setCommune] = useState(maison.commune ?? "");
  const [habitants, setHabitants] = useState(maison.occupants ?? "");

  const champ =
    "w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-accent";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!nom.trim()) return;
        onEnregistrer({
          name: nom.trim(),
          commune: commune.trim() || null,
          occupants: habitants.trim() || null,
        });
      }}
      className="mt-4 space-y-3 rounded-xl border border-accent bg-accent-surface p-4"
    >
      <h2 className="serif text-xl">Corriger « {maison.name} »</h2>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Nom de la maison</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} required className={champ} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Commune</span>
        <input
          value={commune}
          onChange={(e) => setCommune(e.target.value)}
          className={champ}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Qui y habite</span>
        <input
          value={habitants}
          onChange={(e) => setHabitants(e.target.value)}
          className={champ}
        />
        {/* Ce champ est du texte libre, et c'est voulu : il porte les noms de
            gens qui n'ont pas de fiche — cousins par alliance, voisins de
            toujours — et souvent la seule trace qu'on ait d'eux. */}
        <span className="mt-1 block text-xs text-muted">
          Écrit tel quel, même pour des gens qui n&apos;ont pas de fiche
        </span>
      </label>

      <div className="flex gap-3 pt-1">
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-sur-plein">
          Enregistrer
        </button>
        <button
          type="button"
          onClick={onAnnuler}
          className="rounded-lg border border-line px-4 py-2 text-sm"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

/**
 * La carte du bulletin ne connaît que vingt-neuf maisons. Il en manque
 * forcément — celles des cousins par alliance, celles vendues depuis. Le
 * formulaire reste replié : c'est une contribution, pas la tâche principale.
 */
function AjouterMaison({
  onAjout,
}: {
  onAjout: (nom: string, habitants: string, commune: string) => Promise<void>;
}) {
  const [nom, setNom] = useState("");
  const [habitants, setHabitants] = useState("");
  const [commune, setCommune] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <details className="group mt-10 rounded-xl border border-line bg-card p-4">
      <summary className="cursor-pointer list-none text-sm underline decoration-dotted underline-offset-4 marker:hidden">
        Il manque une maison ?
      </summary>

      <p className="mt-3 text-sm text-muted">
        Ajoutez-la ici, puis posez-la sur la carte d&apos;un doigt. Elle
        apparaîtra pour toute la famille.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Nom de la maison</span>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Le Pigeonnier"
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-base outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Qui y habite</span>
          <input
            value={habitants}
            onChange={(e) => setHabitants(e.target.value)}
            placeholder="Marie et Jean Dupont"
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-base outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Commune</span>
          <input
            value={commune}
            onChange={(e) => setCommune(e.target.value)}
            placeholder="Monflanquin"
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-base outline-none focus:border-accent"
          />
        </label>
      </div>

      <button
        onClick={async () => {
          setBusy(true);
          await onAjout(nom, habitants, commune);
          setNom(""); setHabitants(""); setCommune("");
          setBusy(false);
        }}
        disabled={busy || nom.trim().length < 2}
        className="mt-3 rounded-lg bg-accent px-4 py-2.5 font-medium text-sur-plein disabled:opacity-40"
      >
        {busy ? "…" : "Ajouter cette maison"}
      </button>
    </details>
  );
}

function PlaceList({
  title,
  places,
  active,
  onPick,
}: {
  title: string;
  places: MapPlace[];
  active: MapPlace | null;
  onPick: (p: MapPlace) => void;
}) {
  if (places.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="serif mb-3 text-lg">{title}</h2>
      {/* Les noms sont écrits sous chaque maison plutôt que cachés derrière un
          clic : « qui habite où » est la question qu'on vient poser, et la
          faire tenir dans une pastille obligeait à ouvrir les vingt-neuf. */}
      <ul className="grid gap-2 sm:grid-cols-2">
        {places.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => onPick(p)}
              className={`w-full rounded-lg border px-3 py-2 text-left ${
                active?.id === p.id ? "border-accent bg-accent-soft" : "border-line"
              }`}
            >
              <span className="serif block text-sm font-medium">
                {p.name}
                {p.commune && <span className="text-muted"> · {p.commune}</span>}
              </span>
              {p.occupants && (
                <span className="mt-0.5 block text-xs text-muted">{p.occupants}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
