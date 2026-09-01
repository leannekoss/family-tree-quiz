"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Nav from "@/components/Nav";
import BoutonConfort from "@/components/BoutonConfort";

/**
 * L'en-tête, et surtout : ce qu'il ne montre pas avant l'entrée.
 *
 * Sur /rejoindre, ni la barre de navigation ni le retour à l'accueil n'ont de
 * sens — tout y ramène à /rejoindre, silencieusement, sans un mot. Six boutons
 * occupaient le haut du premier écran, au-dessus du formulaire : le premier
 * écran est celui où l'on abandonne. Le titre reste, en texte simple, parce
 * qu'il dit où l'on est arrivé.
 */
export default function Entete() {
  const chemin = usePathname();
  const avantEntree = chemin === "/rejoindre";

  return (
    <header className="border-b border-line">
      <div className="mx-auto max-w-3xl px-4 py-3">
        {avantEntree ? (
          <div className="flex items-center justify-between gap-3">
            <p className="serif py-0.5 text-lg font-semibold tracking-tight">
              L&apos;arbre de la famille
            </p>
            {/* Sur la page d'entrée AUSSI : c'est le premier écran que voient
                les plus âgés, et celui où l'on abandonne. */}
            <BoutonConfort />
          </div>
        ) : (
          // Le titre ramenait déjà à l'accueil, mais rien ne le disait : sans
          // flèche ni soulignement, personne ne pense à taper dessus.
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="serif flex items-baseline gap-2 py-0.5 text-lg font-semibold tracking-tight"
            >
              L&apos;arbre de la famille
              <span className="text-sm font-normal text-muted" aria-hidden>
                ↩ accueil
              </span>
            </Link>
            <BoutonConfort />
          </div>
        )}
        <Nav />
      </div>
    </header>
  );
}
