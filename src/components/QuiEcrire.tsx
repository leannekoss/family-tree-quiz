"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FICHE_GARDIEN, LINKEDIN } from "@/lib/contact";
import { NOM_GARDIEN } from "@/lib/famille";

/**
 * « Écrivez au gardien », où le nom mène à sa fiche.
 *
 * Le lien n'apparaît que pour qui est entré. Le pied de page s'affiche aussi
 * sur les deux pages publiques — la connexion et « Où sont vos données » — et
 * un lien vers une fiche depuis celles-là renverrait le visiteur à l'écran de
 * connexion : il croirait avoir été déconnecté alors qu'il n'était pas encore
 * entré.
 *
 * Le nom reste écrit dans les deux cas. C'est lui qui rassure : on n'écrit pas
 * à un site, on écrit à quelqu'un.
 */
export default function QuiEcrire() {
  const chemin = usePathname();
  const dehors = chemin.startsWith("/rejoindre") || chemin.startsWith("/donnees") || chemin.startsWith("/credits");

  return (
    <p className="text-sm text-muted">
      Une question, une correction, un accès qui ne marche pas ? Écrivez à{" "}
      {LINKEDIN ? (
        <a href={LINKEDIN} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          {NOM_GARDIEN}
        </a>
      ) : dehors ? (
        <strong>{NOM_GARDIEN}</strong>
      ) : (
        <Link href={`/personne/${FICHE_GARDIEN}`} className="underline underline-offset-4">
          {NOM_GARDIEN}
        </Link>
      )}
      .
    </p>
  );
}
