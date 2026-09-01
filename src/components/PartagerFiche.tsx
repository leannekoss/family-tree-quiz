"use client";

import { useState } from "react";

/**
 * Envoyer la fiche de quelqu'un — à cette personne pour qu'elle la complète,
 * ou à n'importe qui d'autre pour la lui montrer.
 *
 * 🔑 UN seul bouton, et non deux. « Partager cette fiche » et « Lui demander de
 * la compléter » font exactement le même geste — ouvrir WhatsApp sur un lien
 * vers la même page — et seul le message diffère. Côte à côte ils faisaient
 * hésiter au lieu d'inciter, et la rangée de boutons changeait de contenu d'une
 * fiche à l'autre. Le bouton reste donc au même endroit sur toutes les fiches ;
 * c'est le MESSAGE qui s'adapte.
 *
 * 🔑 WhatsApp nommé, et en vert. C'est la décision déjà prise pour le partage
 * du score : « Partager » ne dit rien à qui n'a jamais rencontré le menu
 * système, alors que WhatsApp se reconnaît à quatre-vingt-cinq ans. Les fiches
 * utilisaient pourtant `navigator.share` — la décision existait, elle n'avait
 * pas été appliquée ici.
 */
export default function PartagerFiche({
  nom,
  prenom,
  /**
   * « une photo », « deux mots », ou les deux — quand la fiche est vide ET que
   * la personne peut la remplir elle-même. `null` le reste du temps : on
   * partage alors sans rien réclamer.
   */
  ilManque,
  /**
   * L'adresse ABSOLUE de la fiche, calculée sur le serveur depuis l'en-tête
   * `host`.
   *
   * ⚠️ Elle ne peut pas être devinée ici. `window.location.origin` n'existe pas
   * au rendu serveur, et le `href` d'un lien est écrit À CE MOMENT-LÀ : le
   * message partait donc avec « /personne/<id> » sans domaine — un lien mort
   * dans WhatsApp. Le piège ne se voyait pas en développant, parce que
   * l'ancien bouton construisait son texte dans un `onClick`, où `window`
   * existe. Passer du bouton au lien a suffi à le faire apparaître.
   */
  url,
  /** « monf*********** » — assez pour reconnaître, trop peu pour reconstituer. */
  indiceCode,
}: {
  nom: string;
  prenom: string;
  ilManque?: string | null;
  url: string;
  indiceCode?: string | null;
}) {
  const [etat, setEtat] = useState<"prêt" | "copié">("prêt");

  // Un brouillon, jamais un message tout fait : le partage le laisse modifiable,
  // et personne n'écrit à sa sœur comme un site l'aurait écrit.
  // « Il manque deux mots sur elle ou lui sur ta fiche » : le libellé est écrit
  // pour une phrase à la troisième personne — celle qu'on lit SUR la fiche — et
  // le message, lui, s'adresse à la personne. Le « sur elle ou lui » y devient
  // un doublon qui trahit la couture. On parle à quelqu'un : on dit « deux mots ».
  const aDemander = ilManque?.replace(" sur elle ou lui", "");

  const texte = ilManque
    ? `On complète l'arbre de la famille. Il manque ${aDemander} sur ta fiche — c'est ici : ${url}`
    : `${nom}, dans l'arbre de la famille : ${url}`;

  async function copier() {
    try {
      await navigator.clipboard.writeText(texte);
      setEtat("copié");
      setTimeout(() => setEtat("prêt"), 2500);
    } catch {
      setEtat("prêt");
    }
  }

  return (
    <div className="w-full">
      {/* La raison de cliquer, et non une décoration : c'est elle qui transforme
          un partage en demande. Elle ne s'affiche que quand il y a quelque chose
          à demander. */}
      {ilManque && (
        <p className="mb-2 text-sm text-muted">
          Sa fiche est presque vide — il manque {ilManque}.{" "}
          <strong className="text-inherit">
            Personne ne la connaît mieux que {prenom}.
          </strong>
        </p>
      )}

      {/* 🔑 Le lien seul ne suffit pas à quelqu'un qui n'est jamais venu : il
          arrive sur le code famille, et sans lui la page ne s'ouvre pas. C'est
          le bout du parcours de partage, et il manquait — on envoyait une porte
          sans dire qu'il fallait une clé.

          🔑 Un encadré AVANT le bouton, et non une fenêtre à fermer. Ce projet
          a déjà tranché ce débat : la case « avez-vous vérifié que cette
          personne n'existe pas déjà ? » a été retirée parce qu'« une case de ce
          genre se coche sans être lue — elle déplace la responsabilité sans
          rien empêcher ». Sur deux cents personnes, quatre-vingt-dix sont déjà
          membres : une fenêtre à chaque partage deviendrait un écran qu'on
          ferme sans lire, et le jour où elle compte, elle ne compterait plus.
          Lu avant de cliquer, il ne coûte aucun geste.

          Le code n'est PAS écrit ici, et ce n'est pas un oubli : il est le mot
          de passe de TOUS les comptes (raison pour laquelle celui du gardien en
          a été sorti, migration 0017). L'afficher sur chaque fiche le mettrait
          sur toute capture d'écran. Celui qui partage le connaît — il l'a tapé
          pour entrer. On lui rappelle de le transmettre, on ne le publie pas à
          sa place. */}
      <p className="mb-3 flex items-start gap-2 rounded-lg border border-accent-line bg-accent-surface px-3 py-2.5 text-sm">
        <span aria-hidden>🔑</span>
        <span>
          Si la personne n&apos;est jamais venue, pensez à lui donner le{" "}
          <strong>code famille</strong> : le lien le lui demandera avant
          d&apos;ouvrir la fiche.
          {/* L'indice plutôt que le code : on le tape une fois, la session
              dure, et dix jours plus tard il faut le retrouver pour dépanner
              quelqu'un. Quatre lettres suffisent à le faire revenir en
              mémoire. Elles ne l'apprennent à personne — il faut déjà être
              connecté, donc l'avoir saisi en entier, pour lire cette page. */}
          {indiceCode && (
            <>
              {" "}
              Il commence par <code className="font-mono">{indiceCode}</code>.
            </>
          )}
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {/* `wa.me` ouvre l'application sur téléphone et WhatsApp Web sur
            ordinateur, puis laisse choisir le destinataire : rien ne part sans
            qu'on ait vu le message.

            Le vert #128C7E et non le #25D366 des logos — celui-ci est trop
            clair, le texte blanc y tombe à 2,3:1. */}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(texte)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#128C7E] px-4 py-2 text-sm font-medium text-white"
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="size-[18px]">
            <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.69 8.23-8.25 8.23Z" />
          </svg>
          {ilManque ? "Lui demander de compléter" : "Partager cette fiche"}
        </a>
        {/* Le chemin de secours de qui n'a pas WhatsApp — un lien discret, pas
            une seconde option de même rang. */}
        <button
          type="button"
          onClick={copier}
          className="inline-flex min-h-[44px] items-center px-2 text-sm text-muted underline underline-offset-4"
        >
          {etat === "copié" ? "Message copié — collez-le" : "Copier le message"}
        </button>
      </div>

    </div>
  );
}
