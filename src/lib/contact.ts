/**
 * Le seul canal de contact du site, écrit une fois.
 *
 * Le numéro n'apparaît jamais en clair dans une page : le pied de page
 * s'affiche aussi sur /rejoindre, qui est publique, et un numéro écrit là se
 * fait moissonner comme une adresse email. Le lien wa.me le porte sans
 * l'afficher. Vide : les boutons WhatsApp ne s'affichent pas.
 */
const NUMERO = "";

import { AUTEUR } from "@/lib/famille";

/** Vide : le lien « suivez-moi » ne s'affiche pas. */
export const LINKEDIN = AUTEUR.linkedin ?? "";

/** Vide : le lien vers le code ne s'affiche pas. */
export const CODE_SOURCE = AUTEUR.code ?? "";

export { FICHE_GARDIEN } from "@/lib/famille";

/** Y a-t-il un numéro à joindre ? */
export const CONTACT_WHATSAPP = NUMERO !== "";

/**
 * Un lien WhatsApp, éventuellement pré-rempli.
 *
 * Le message pré-rempli fait tout le travail : quelqu'un qui signale une
 * erreur depuis son téléphone n'a ni le nom exact ni l'adresse de la fiche
 * sous la main. Sans eux, le message reçu est « il y a une faute sur la fiche
 * de ma cousine » — et il faut deux allers-retours pour savoir laquelle.
 */
export function lienWhatsApp(texte?: string) {
  return texte
    ? `https://wa.me/${NUMERO}?text=${encodeURIComponent(texte)}`
    : `https://wa.me/${NUMERO}`;
}
