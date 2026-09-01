import Link from "next/link";

export type Pas = {
  person_id: string | null;
  prenom: string | null;
  a_photo: boolean;
  a_emoji: boolean;
  a_joue: boolean;
  a_donne: boolean;
  faits: number;
};

/**
 * Les premiers pas — quatre gestes d'une minute, et la liste disparaît.
 *
 * Vingt-huit inscrits sur quarante-deux ne sont jamais revenus. Ils sont
 * arrivés sur un champ de recherche sans savoir quoi y taper. Ce n'est pas un
 * tour du produit — personne ne lit un tour du produit : c'est ce qu'il reste
 * à faire, dit en une ligne par geste, avec le lien qui y mène.
 *
 * 🔑 Trois choix qui font tout le travail :
 *
 * 1. **La première case est déjà cochée.** « Vous avez rejoint l'arbre » est
 *    acquis avant d'arriver ici. Une liste qui commence à 1/5 se termine
 *    beaucoup plus souvent qu'une liste vide : on ne renonce pas aussi
 *    facilement à quelque chose de commencé.
 * 2. **Les consignes sont personnelles.** « Ajoutez une photo » ne fait rien.
 *    « Il manque votre portrait » fait lever de sa chaise.
 * 3. **Elle s'efface quand elle est finie**, comme la carte des visages à
 *    replacer. Une liste tout cochée n'est plus une invitation, c'est un
 *    meuble.
 */
export default function PremiersPas({ pas }: { pas: Pas }) {
  if (pas.faits >= 4) return null;

  const fiche = pas.person_id ? `/personne/${pas.person_id}` : null;

  type Geste = { fait: boolean; texte: string; href: string | null; duree: string | null };

  const gestes: Geste[] = [
    { fait: true, texte: "Vous avez rejoint l'arbre", href: null, duree: null },
  ];
  // Les deux gestes sur SA fiche n'existent que si l'on sait qui l'on est.
  // Sans fiche rattachée, `QuiSuisJe` occupe déjà le haut de la page : deux
  // listes de démarrage l'une sur l'autre ne diraient plus par où commencer.
  if (fiche) {
    gestes.push({
      fait: pas.a_photo,
      texte: pas.a_photo ? "Votre portrait est en ligne" : "Il manque votre portrait",
      href: fiche,
      duree: "30 secondes",
    });
    gestes.push({
      fait: pas.a_emoji,
      texte: pas.a_emoji ? "Vous avez votre emblème" : "Choisissez votre emblème",
      href: fiche,
      duree: "5 secondes",
    });
  }
  gestes.push({
    fait: pas.a_joue,
    texte: pas.a_joue ? "Vous avez joué une partie" : "Jouez une partie",
    href: "/quiz",
    duree: "deux minutes",
  });
  gestes.push({
    fait: pas.a_donne,
    texte: pas.a_donne
      ? "Vous avez donné un visage à l'arbre"
      : "Ajoutez la photo de quelqu'un d'autre",
    href: "/photos",
    duree: "une minute",
  });

  const total = gestes.length;
  const faits = gestes.filter((g) => g.fait).length;

  return (
    <section className="mb-6 rounded-xl border border-accent-line bg-accent-surface p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="serif text-lg">
          {pas.prenom ? `Bienvenue ${pas.prenom}` : "Pour bien commencer"}
        </h2>
        <span className="text-sm text-muted">
          {faits} sur {total}
        </span>
      </div>

      <ul className="space-y-1">
        {gestes.map((g) => (
          <li key={g.texte}>
            {g.fait ? (
              <span className="flex items-center gap-2 py-2 text-sm text-muted">
                <span aria-hidden className="text-accent">
                  ✓
                </span>
                <span className="line-through decoration-1">{g.texte}</span>
              </span>
            ) : (
              <Link
                href={g.href!}
                className="flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium"
              >
                <span
                  aria-hidden
                  className="inline-block size-4 shrink-0 rounded-full border border-accent"
                />
                <span className="underline underline-offset-4">{g.texte}</span>
                {g.duree && <span className="text-xs text-muted">· {g.duree}</span>}
              </Link>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-muted">
        Cette liste disparaîtra toute seule quand vous l&apos;aurez finie.
      </p>
    </section>
  );
}
