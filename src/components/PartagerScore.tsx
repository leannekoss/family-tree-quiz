"use client";

import { useState } from "react";

const SITE = "https://votre-arbre.vercel.app";

/**
 * Partager son score, parce que c'est ce qui fait revenir les autres.
 *
 * Le lien circule déjà dans un groupe WhatsApp familial : un score qui s'y pose
 * fait plus pour l'usage du site que n'importe quelle relance. « Tu as fait
 * combien ? » est la seule phrase qui ramène quelqu'un un dimanche soir.
 *
 * Le code famille n'est PAS dans le message, volontairement. Il voyage déjà
 * dans l'invitation d'Camille ; l'ajouter à chaque partage multiplierait les
 * chemins par lesquels il peut sortir du cercle, pour ne faire gagner qu'un
 * aller-retour à celui qui ne l'a pas.
 */
export default function PartagerScore({
  score,
  justes,
  total,
  rang,
  joueurs,
}: {
  score: number;
  justes: number;
  total: number;
  /** Renseigné depuis le classement : le rang pique plus que le score seul. */
  rang?: number;
  joueurs?: number;
}) {
  const [etat, setEtat] = useState<"prêt" | "copié">("prêt");

  // Un rang désigne ceux qui sont devant sans les nommer, et c'est ce qui fait
  // rejouer : « 3e sur 12 » se lit comme un défi, « 2294 points » comme une
  // statistique.
  const texte = rang
    ? `Je suis ${rang}${rang === 1 ? "er" : "e"}${joueurs ? ` sur ${joueurs}` : ""} au quiz de la famille, avec ${score} points.\n` +
      `Tu fais mieux ? ${SITE}/quiz`
    : `J'ai fait ${score} points au quiz de la famille — ${justes} bonnes réponses sur ${total}.\n` +
      `À toi d'essayer : ${SITE}/quiz`;

  async function partager() {
    // `navigator.share` ouvre le menu natif du téléphone : WhatsApp s'y trouve
    // en premier, ce qui est exactement là où le message doit aller. Il n'existe
    // pas sur la plupart des ordinateurs — on copie alors dans le presse-papiers,
    // ce qui demande un geste de plus mais ne laisse personne sans solution.
    if (navigator.share) {
      try {
        await navigator.share({ text: texte });
        return;
      } catch {
        // Partage refusé ou annulé : on retombe sur la copie plutôt que de ne
        // rien faire, ce qui se lirait comme un bouton cassé.
      }
    }
    try {
      await navigator.clipboard.writeText(texte);
      setEtat("copié");
      setTimeout(() => setEtat("prêt"), 2500);
    } catch {
      setEtat("prêt");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* WhatsApp nommé, et en premier. C'est là que va le message — le lien du
          site y circule déjà — et surtout c'est un mot que tout le monde
          reconnaît, y compris à 85 ans. « Partager » ne dit rien à qui n'a
          jamais rencontré le menu système.

          `wa.me` ouvre l'application sur téléphone et WhatsApp Web sur
          ordinateur, puis laisse choisir le destinataire : rien n'est envoyé
          sans qu'on ait vu le message. */}
      <a
        href={`https://wa.me/?text=${encodeURIComponent(texte)}`}
        target="_blank"
        rel="noreferrer"
        // Le vert de WhatsApp, et c'est la seule couleur de l'application qui
        // vienne d'ailleurs. Elle est là pour être reconnue avant d'être lue :
        // en terracotta, ce bouton était un bouton de plus au milieu des
        // boutons du site. Le vert #128C7E plutôt que le #25D366 des logos —
        // celui-ci est trop clair, le texte blanc y tombe à 2,3:1.
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#128C7E] px-5 py-2.5 text-sm font-medium text-white"
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="size-[18px]">
          <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.69 8.23-8.25 8.23Z" />
        </svg>
        Envoyer sur WhatsApp
      </a>
      {/* « Autre » ne disait rien : autre quoi, autre où ? Un bouton doit
          nommer ce qu'il fait, et celui-ci copie le message pour qu'on le colle
          où l'on veut — SMS, mail, Messenger. Il devient un lien discret :
          c'est le chemin de secours de qui n'a pas WhatsApp, pas une seconde
          option de même rang. */}
      <button
        type="button"
        onClick={partager}
        className="inline-flex min-h-[44px] items-center px-2 text-sm text-muted underline underline-offset-4"
      >
        {etat === "copié" ? "Message copié — collez-le" : "Copier le message"}
      </button>
    </div>
  );
}
