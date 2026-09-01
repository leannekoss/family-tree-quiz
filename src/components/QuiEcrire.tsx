"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FICHE_GARDIEN } from "@/lib/contact";

/**
 * « Écrivez au gardien », où Camille mène à sa fiche.
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
  const dehors = chemin.startsWith("/rejoindre") || chemin.startsWith("/donnees");

  return (
    <p className="text-sm text-muted">
      Une question, une correction, un accès qui ne marche pas ? Écrivez à{" "}
      {dehors ? (
        <strong>Camille</strong>
      ) : (
        <Link href={`/personne/${FICHE_GARDIEN}`} className="underline underline-offset-4">
          Camille
        </Link>
      )}
      .
    </p>
  );
}
