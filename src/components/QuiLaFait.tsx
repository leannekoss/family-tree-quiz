"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FICHE_GARDIEN, LINKEDIN } from "@/lib/contact";

/**
 * Qui a fait ce site, et où le suivre.
 *
 * Le pied de page portait une cartouche « LinkedIn » à côté de « WhatsApp » :
 * deux boutons de même rang, dont l'un ne demandait rien. Personne ne clique un
 * nom de plateforme — on clique une personne, ou une suite.
 *
 * 🔑 Deux liens et non un, parce que ce sont deux publics. Le cousin qui lit
 * « fait par Camille » veut savoir QUI c'est : il va sur la fiche, dans l'arbre,
 * là où il se situe par rapport à lui. Celui que le site intrigue veut voir ce
 * que cette personne fabrique d'autre : il va ailleurs. Les fondre en un seul
 * lien obligerait à choisir lequel des deux on déçoit.
 *
 * Sur les deux pages publiques, la fiche disparaît : elle renverrait à l'écran
 * de connexion, et quelqu'un qui n'est pas encore entré croirait avoir été mis
 * dehors. Le nom reste, l'invitation aussi.
 */
export default function QuiLaFait() {
  const chemin = usePathname();
  const dehors = chemin.startsWith("/rejoindre") || chemin.startsWith("/donnees");

  return (
    <>
      Fait par{" "}
      {dehors ? (
        <strong>Camille</strong>
      ) : (
        <Link href={`/personne/${FICHE_GARDIEN}`} className="underline underline-offset-4">
          Camille
        </Link>
      )}
      , à partir du bulletin <em>La Gazette</em> et de ce que la famille y ajoute.{" "}
      <a
        href={LINKEDIN}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[44px] items-center font-medium text-accent underline underline-offset-4"
      >
        Suivez-moi pour la suite des aventures →
      </a>
    </>
  );
}
