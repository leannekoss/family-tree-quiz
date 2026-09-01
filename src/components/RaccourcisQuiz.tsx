"use client";

import { useEffect, useRef } from "react";

/**
 * Répondre au clavier : 1 à 4, puis Entrée pour enchaîner.
 *
 * Ce n'est pas du confort. Le score dépend de la vitesse — cent points de plus
 * au mieux, et le multiplicateur de série par-dessus — or viser un bouton à la
 * souris coûte une bonne seconde de plus qu'appuyer sur une touche. Sans
 * raccourcis, un joueur sur ordinateur ne peut pas atteindre les scores d'un
 * joueur sur téléphone, dont le pouce est déjà posé sur l'écran.
 *
 * Un seul abonnement pour toute la partie : les valeurs courantes sont lues
 * dans une référence. Le chrono change dix fois par seconde, et se réabonner à
 * chaque battement ferait dix mille poses d'écouteur par partie.
 */
export default function RaccourcisQuiz({
  actif,
  nb,
  onRepondre,
  onSuivante,
}: {
  /** Faux une fois la réponse donnée : les chiffres ne servent plus. */
  actif: boolean;
  nb: number;
  onRepondre: (i: number) => void;
  onSuivante: () => void;
}) {
  const etat = useRef({ actif, nb, onRepondre, onSuivante });
  useEffect(() => {
    etat.current = { actif, nb, onRepondre, onSuivante };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ne jamais voler une touche à un champ de saisie : le pseudonyme du
      // classement se tape sur ce même écran, et un « 2 » dedans doit rester
      // un « 2 ».
      const cible = e.target as HTMLElement | null;
      if (
        cible &&
        (cible.tagName === "INPUT" ||
          cible.tagName === "TEXTAREA" ||
          cible.tagName === "SELECT" ||
          cible.isContentEditable)
      ) {
        return;
      }
      // Les combinaisons appartiennent au navigateur : Ctrl+1 change d'onglet,
      // et le lui prendre serait une trahison silencieuse.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const { actif, nb, onRepondre, onSuivante } = etat.current;

      if (actif) {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= nb) {
          e.preventDefault();
          onRepondre(n - 1);
        }
        return;
      }

      // Après la réponse : Entrée ou Espace enchaînent. Le bouton « Suivante »
      // reçoit déjà le focus, donc Entrée y marcherait — mais plus si l'on a
      // cliqué ailleurs entre-temps, par exemple sur « Voir la fiche ».
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSuivante();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
