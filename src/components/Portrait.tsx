"use client";

import { useRef } from "react";
import Avatar from "./Avatar";

/**
 * Le portrait d'une fiche, qu'on peut toucher pour le voir en grand.
 *
 * Le réflexe existe avant la fonction : devant une photo de 72 pixels sur un
 * téléphone, on tape dessus. Jusqu'ici il ne se passait rien — et un geste sans
 * réponse se lit comme une panne, pas comme une absence de fonctionnalité.
 *
 * Il y avait de quoi répondre : les photos sont réduites à 1000 pixels de côté
 * à l'envoi, soit quatorze fois plus de détail que la pastille n'en montre. Un
 * visage qu'on ne reconnaissait pas devient reconnaissable.
 *
 * `<dialog>` plutôt qu'une fenêtre maison : le navigateur gère seul la touche
 * Échap, le retour du focus, le piège au clavier et le fond assombri. Trois
 * lignes de balisage contre une centaine à écrire et à corriger.
 */
export default function Portrait({
  src,
  name,
  size = 72,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  const boite = useRef<HTMLDialogElement>(null);

  // Pas de photo, pas de geste : une initiale agrandie n'apprendrait rien, et
  // un bouton qui ouvre le vide déçoit plus qu'il ne sert.
  if (!src) return <Avatar src={null} name={name} size={size} />;

  return (
    <>
      <button
        type="button"
        onClick={() => boite.current?.showModal()}
        aria-label={`Voir le portrait de ${name} en grand`}
        className="shrink-0 cursor-zoom-in rounded-full"
      >
        <Avatar src={src} name={name} size={size} />
      </button>

      <dialog
        ref={boite}
        // On ferme où que l'on touche. Sur un téléphone, viser une croix de
        // quinze pixels après avoir ouvert une image en plein écran est le
        // genre de détail qui fait dire « je n'arrive pas à revenir ».
        onClick={() => boite.current?.close()}
        className="m-auto max-h-[92vh] max-w-[94vw] border-0 bg-transparent p-0 backdrop:bg-black/75"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- lien signé
            temporaire, l'optimiseur de Next le remettrait en cache après
            expiration. */}
        <img
          src={src}
          alt={name}
          // 85vh et non 92 : une photo prise à la verticale occuperait sinon
          // toute la hauteur et pousserait la légende hors de l'écran.
          className="animate-monte max-h-[85vh] max-w-full rounded-xl object-contain"
        />
        <p className="mt-3 text-center text-sm text-white/70">
          {name} · touchez pour fermer
        </p>
      </dialog>
    </>
  );
}
