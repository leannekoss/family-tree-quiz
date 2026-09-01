"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { lirePartie, type Partie } from "@/lib/partie";

/**
 * Pendant une partie, on quitte le quiz pour aller lire une fiche — c'est le
 * geste utile, celui qui fait qu'on apprend quelque chose. Sans ce bandeau, le
 * chemin du retour passe par le menu et la partie donne l'impression d'être
 * perdue : plus personne ne clique « Voir la fiche ».
 */
export default function RetourQuiz() {
  const [partie, setPartie] = useState<Partie | null>(null);

  // Le stockage de session n'existe pas côté serveur : lu au montage, sinon le
  // rendu serveur et le rendu client divergent. C'est le cas que la règle
  // « pas de setState dans un effet » ne couvre pas — on synchronise React
  // avec un système externe, et il n'y a pas d'autre moment pour le faire.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setPartie(lirePartie()), []);

  if (!partie) return null;

  const terminee = partie.step >= partie.questions.length;

  return (
    <Link
      href="/quiz"
      className="animate-monte mb-5 flex items-center justify-between gap-3 rounded-xl border border-accent-line bg-accent-surface px-4 py-3"
    >
      <span className="text-sm">
        {terminee
          ? "Partie terminée"
          : `Partie en cours — question ${partie.step + 1} sur ${partie.questions.length}`}
        <span className="block text-muted">{partie.score} points</span>
      </span>
      <span className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-sur-plein">
        {terminee ? "Voir mon score" : "Reprendre"}
      </span>
    </Link>
  );
}
