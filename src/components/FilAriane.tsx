import Link from "next/link";

export type Etape = { label: string; href?: string };

/**
 * Le chemin parcouru, cliquable en arrière.
 *
 * Pas un fil d'Ariane d'arborescence — « Accueil › Personnes › Camille » serait
 * faux, il n'existe pas de page « Personnes ». Celui-ci dit d'où l'on vient et
 * permet d'y retourner d'un pouce : sur une fiche on arrive par la recherche,
 * le quiz, la carte ou l'arbre de quelqu'un d'autre, et jusqu'ici le seul retour
 * était le bouton du navigateur.
 *
 * La dernière étape n'est pas un lien : elle nomme la page où l'on se trouve.
 */
export default function FilAriane({ etapes }: { etapes: Etape[] }) {
  return (
    <nav aria-label="Chemin" className="mb-4 flex flex-wrap items-center gap-x-1.5 text-sm">
      {etapes.map((e, i) => {
        const dernier = i === etapes.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <span aria-hidden className="text-line">
                ›
              </span>
            )}
            {e.href && !dernier ? (
              <Link href={e.href} className="text-muted underline underline-offset-4">
                {e.label}
              </Link>
            ) : (
              <span className={dernier ? "text-foreground" : "text-muted"} aria-current={dernier ? "page" : undefined}>
                {e.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
