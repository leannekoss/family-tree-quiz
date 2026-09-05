"use client";

import { useEffect, useState } from "react";
import { CONTACT_WHATSAPP, lienWhatsApp } from "@/lib/contact";

/**
 * « Demander une correction » — la porte de sortie de ceux qui ne corrigeront
 * pas eux-mêmes.
 *
 * Une fiche modifiable ne suffit pas. Il reste trois cas où l'on sait qu'une
 * information est fausse sans pouvoir la réparer : on ignore la bonne valeur,
 * la correction est délicate (un décès, une séparation, un prénom qu'on ne
 * porte plus), ou l'on n'ose pas toucher à la fiche de quelqu'un d'autre. Sans
 * ce bouton, ces trois cas se terminent de la même façon : l'erreur reste.
 *
 * Volontairement plus discret que « Corriger cette fiche » : l'auto-service
 * passe à l'échelle sur deux cents personnes, une boîte WhatsApp non.
 */
export default function Signaler({ nom }: { nom: string }) {
  // L'adresse de la fiche n'existe qu'une fois la page ouverte dans un
  // navigateur ; la lire après l'hydratation évite d'écrire le domaine en dur
  // et de le voir se périmer au premier changement d'adresse du site.
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(window.location.href), []);

  if (!CONTACT_WHATSAPP) return null;

  const message =
    `Bonjour, il y a une correction à faire sur la fiche de ${nom}.` +
    (url ? `\n${url}` : "") +
    `\n\nCe qu'il faudrait changer : `;

  return (
    <a
      href={lienWhatsApp(message)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block rounded-lg px-3 py-2 text-sm text-muted underline underline-offset-4"
    >
      Demander une correction
    </a>
  );
}
