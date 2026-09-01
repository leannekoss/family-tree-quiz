"use client";

import { useEffect, useState } from "react";

const CLE = "arbre.confort";

/**
 * « Écrire plus gros » : le réglage pour ceux qui plissent les yeux.
 *
 * Tout le site est mesuré en rem — textes, marges, boutons. Grossir la taille
 * racine de 16 à 20 pixels agrandit donc TOUT de 25 %, d'un seul coup et sans
 * rien casser : les cibles de 44 px passent à 55, les textes de 16 à 20. C'est
 * la manière propre de faire un « mode confort » — une règle, pas un thème
 * parallèle à maintenir.
 *
 * 🔑 Un bouton dans l'en-tête plutôt qu'un réglage système : les navigateurs
 * savent déjà grossir le texte, mais les gens de quatre-vingts ans ne
 * trouveront jamais ce réglage — et c'est précisément pour eux qu'on le fait.
 * Le bouton dit « Aa », le geste que tout le monde comprend, et le choix est
 * retenu sur l'appareil.
 */
export default function BoutonConfort() {
  const [actif, setActif] = useState(false);

  useEffect(() => {
    // L'état vient de l'appareil ; la classe est déjà posée par le script de
    // démarrage avant le premier rendu — ici on ne fait que synchroniser le
    // bouton, jamais provoquer un saut de mise en page.
    setActif(document.documentElement.classList.contains("confort"));
  }, []);

  function basculer() {
    const apres = !actif;
    setActif(apres);
    document.documentElement.classList.toggle("confort", apres);
    try {
      localStorage.setItem(CLE, apres ? "1" : "0");
    } catch {
      /* navigation privée : le réglage vaudra pour cette visite */
    }
  }

  return (
    <button
      onClick={basculer}
      aria-pressed={actif}
      className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${
        actif
          ? "border-accent bg-accent-soft font-medium"
          : "border-line bg-card"
      }`}
    >
      <span aria-hidden className="leading-none">
        <span className="text-xs">A</span>
        <span className="text-lg font-semibold">A</span>
      </span>
      {actif ? "Texte agrandi" : "Écrire plus gros"}
    </button>
  );
}
