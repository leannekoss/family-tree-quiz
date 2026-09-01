"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Les emblèmes, rangés par ce qu'ils disent.
 *
 * La liste est FERMÉE, et c'est le cœur de la décision. N'importe quel membre
 * peut corriger n'importe quelle fiche — c'est ce qui fait vivre l'arbre — mais
 * un emoji posé par un tiers sur la fiche de quelqu'un d'autre peut blesser là
 * où une date fausse ne fait rien. Le clavier libre ouvrirait la porte au
 * clown, au cochon, au fantôme. Soixante-quinze images choisies : on peut être
 * drôle, on ne peut pas être méchant.
 *
 * 🔑 La même liste est écrite en contrainte sur la table. Un formulaire se
 * contourne — un `insert` depuis la console du navigateur suffit — une
 * contrainte non. Les deux doivent rester d'accord : toute image ajoutée ici
 * doit l'être aussi dans la dernière migration `*_emblemes_*`.
 */
const FAMILLES: { titre: string; emojis: string[] }[] = [
  {
    titre: "Le pays",
    emojis: ["🌻", "🍇", "🌰", "🍑", "🌾", "🌳", "🐓", "🦆", "🐝", "🍄", "🏰", "⛪", "🐴", "🐑", "🌲", "🦋"],
  },
  {
    titre: "La table",
    emojis: ["🥖", "🧀", "🍷", "🥘", "🍰", "☕", "🍯", "🫒", "🍓", "🥐", "🍺"],
  },
  {
    titre: "Le grand air",
    emojis: ["⚽", "🎾", "🏊", "🚴", "🥾", "⛵", "🎿", "🏇", "🎣", "🧘", "🏉", "🏄", "🏃", "🚣"],
  },
  {
    titre: "Ce qu'on aime",
    emojis: ["📚", "🎨", "🎭", "🎸", "🎹", "🎤", "📷", "🎬", "♟️", "🧶", "🪴", "🍳", "🎻", "🥁", "🎮", "🌍", "✍️"],
  },
  {
    titre: "Le métier",
    emojis: ["⚕️", "⚖️", "🔧", "🧪", "💻", "✈️", "🚜", "🏗️", "📐", "🎓", "💼", "🔬", "🌱"],
  },
  {
    titre: "Le caractère",
    emojis: ["🦉", "🐢", "🦊", "🐿️", "🦁", "🐻", "🐇"],
  },
];

/**
 * Choisir son emblème.
 *
 * Quatre cent soixante-sept fiches, quatre-vingt-dix-sept photos : la grande
 * majorité des gens n'a qu'une initiale grise dans un rond. Une initiale ne
 * fait reconnaître personne, et déposer une photo demande d'aller la chercher,
 * de la recadrer, d'y penser. Un emoji se choisit en trois secondes.
 *
 * Il ne remplace pas le portrait — il se pose à côté. C'est important : sinon
 * on croirait la fiche complète, et les trois cent soixante-dix visages qui
 * manquent cesseraient d'être un manque visible.
 */
export default function ChoisirEmoji({
  personId,
  nom,
  actuel,
}: {
  personId: string;
  nom: string;
  actuel: string | null;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [choisi, setChoisi] = useState(actuel);
  const [erreur, setErreur] = useState<string | null>(null);

  async function poser(emoji: string | null) {
    const avant = choisi;
    setChoisi(emoji); // l'écran répond d'abord, la base confirme ensuite
    setErreur(null);

    const { error } = await supabaseBrowser()
      .from("people")
      .update({ emoji })
      .eq("id", personId);

    if (error) {
      // On remet ce qui était : un emblème qui s'affiche sans être enregistré
      // est pire que pas d'emblème du tout.
      setChoisi(avant);
      setErreur(`Pas enregistré : ${error.message}`);
      return;
    }
    setOuvert(false);
    router.refresh();
  }

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-sm"
      >
        {choisi ? (
          <>
            <span className="text-lg">{choisi}</span>
            <span className="text-muted">changer d&apos;emblème</span>
          </>
        ) : (
          <>
            <span aria-hidden>✨</span>
            Choisir un emblème
          </>
        )}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-accent-line bg-accent-surface p-3">
      <p className="text-sm font-medium">
        Un emblème pour {nom}
        <span className="ml-1 font-normal text-muted">
          · il apparaîtra au classement et sur sa fiche
        </span>
      </p>

      {FAMILLES.map((f) => (
        <div key={f.titre} className="mt-3">
          <p className="text-xs uppercase tracking-wide text-muted">{f.titre}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {f.emojis.map((e) => (
              <li key={e}>
                {/* 44 px de côté : c'est la taille d'un pouce, et cette grille
                    sera manœuvrée par des gens de quatre-vingts ans autant que
                    par des enfants. */}
                <button
                  onClick={() => poser(e)}
                  aria-label={`choisir ${e}`}
                  aria-pressed={choisi === e}
                  className={`flex size-11 items-center justify-center rounded-lg border text-xl ${
                    choisi === e
                      ? "border-accent bg-accent-soft"
                      : "border-line bg-card"
                  }`}
                >
                  {e}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {erreur && <p className="mt-2 text-sm text-alerte">{erreur}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {choisi && (
          <button
            onClick={() => poser(null)}
            className="rounded-lg border border-line bg-card px-3 py-2 text-sm"
          >
            Retirer l&apos;emblème
          </button>
        )}
        <button
          onClick={() => setOuvert(false)}
          className="rounded-lg border border-line px-3 py-2 text-sm"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
