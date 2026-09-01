/**
 * Le seul canal de contact du site, écrit une fois.
 *
 * Le numéro n'apparaît jamais en clair dans une page : le pied de page
 * s'affiche aussi sur /rejoindre, qui est publique, et un numéro écrit là se
 * fait moissonner comme une adresse email. Le lien wa.me le porte sans
 * l'afficher.
 */
const NUMERO = "33600000000";

export const LINKEDIN = "https://www.linkedin.com/in/exemple";

/**
 * La fiche d'Camille dans l'arbre.
 *
 * Écrite ici plutôt que cherchée en base à chaque page : le pied de page est
 * rendu partout, et une requête par page pour retrouver un identifiant qui ne
 * changera jamais serait payée deux cents fois par jour pour rien.
 */
export const FICHE_GARDIEN = "a0000000-0000-4000-8000-000000000043";

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
