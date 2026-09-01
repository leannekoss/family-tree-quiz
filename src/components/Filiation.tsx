"use client";

import { useState } from "react";
import ChercherPersonne, { type Choix, type Trouve } from "./ChercherPersonne";

export type { Choix };

/** Un parent a au moins quinze ans de plus que son enfant. */
const ECART_MINIMAL = 15;

/**
 * Choisir le père et la mère de quelqu'un.
 *
 * Ces deux champs étaient des menus déroulants, et c'était la bonne réponse
 * tant que l'arbre tenait en quatre cent soixante-sept fiches. L'import des
 * huit branches en a mis sept mille : le menu du père de Julien Morel comptait
 * SIX MILLE NEUF CENT TRENTE lignes, dont quatre-vingt-quatorze pour cent
 * d'aïeux allemands du seizième siècle. Personne ne fait défiler ça sur un
 * téléphone — on corrige au hasard, ou on renonce.
 */
export default function Filiation({
  personneId,
  pereInitial,
  mereInitial,
  neEn,
}: {
  /** Celui dont on choisit les parents — jamais candidat à être le sien. */
  personneId: string;
  pereInitial: Choix | null;
  mereInitial: Choix | null;
  /** L'année de naissance de l'enfant, quand on la connaît. */
  neEn: number | null;
}) {
  const [pere, setPere] = useState<Choix | null>(pereInitial);
  const [mere, setMere] = useState<Choix | null>(mereInitial);

  // Le sexe inconnu reste plausible : cinq prénoms mixtes sont volontairement
  // sans genre en base, et les exclure priverait leurs enfants de leur parent.
  const ecarter = (attendu: "M" | "F") => (p: Trouve) => {
    if (p.sex && p.sex !== attendu) return "autre sexe";
    if (neEn !== null && p.birth_year !== null && neEn - p.birth_year < ECART_MINIMAL)
      return "trop jeune";
    return null;
  };

  return (
    <>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Père</span>
        <ChercherPersonne
          name="father_id"
          placeholder="Chercher le père par son nom"
          sauf={personneId}
          choisi={pere}
          onChoisir={setPere}
          ecarter={ecarter("M")}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Mère</span>
        <ChercherPersonne
          name="mother_id"
          placeholder="Chercher la mère par son nom"
          sauf={personneId}
          choisi={mere}
          onChoisir={setMere}
          ecarter={ecarter("F")}
        />
      </label>
    </>
  );
}
