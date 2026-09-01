import Link from "next/link";

export type Anecdote = {
  id: number;
  titre: string;
  texte: string;
  source: string;
  person_id: string | null;
  prenom: string | null;
  nom: string | null;
  place_id: number | null;
  maison: string | null;
  combien: number;
};

/**
 * Une histoire par jour, tirée du mémoire de famille.
 *
 * 🔑 Un arbre dit qui a existé, jamais ce qui s'est passé. Le cahier
 * dactylographié d'Édouard Augustin Vernet (1952) est plein de scènes que
 * personne ne connaît plus — un duel devant l'église, une jument tondue, une
 * aïeule enterrée sous un sureau pendant les dragonnades. Elles dormaient dans
 * un cahier qu'on n'ouvre pas.
 *
 * 🔑 Une par jour, et non une page qui les contient toutes : la page se lit une
 * fois, l'histoire du jour fait revenir demain. C'est le même ressort que les
 * anniversaires, et c'est pour ça qu'elle se place juste à côté.
 *
 * Le choix du jour est fait par la base, en heure de Paris. Ici on affiche, on
 * ne décide pas — sinon Vercel, qui tourne en UTC, changerait d'histoire à
 * 2 h du matin, en plein pendant que la famille lit le site le soir.
 */
export default function AnecdoteDuJour({ a }: { a: Anecdote }) {
  return (
    <section className="mb-6 rounded-xl border border-line bg-card px-4 py-4">
      <p className="text-xs uppercase tracking-wide text-muted">
        L&apos;histoire du jour
      </p>
      <h2 className="serif mt-1 text-lg font-semibold">{a.titre}</h2>
      <p className="mt-2 text-sm leading-relaxed">{a.texte}</p>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>{a.source}</span>
        {a.person_id && a.prenom && (
          <Link href={`/personne/${a.person_id}`} className="underline underline-offset-4">
            La fiche {a.prenom === "Édouard Henry" ? "de l'auteur" : `de ${a.prenom}`}
          </Link>
        )}
        {a.place_id && a.maison && (
          <Link href={`/lieux?maison=${a.place_id}`} className="underline underline-offset-4">
            {a.maison} sur la carte
          </Link>
        )}
      </p>
    </section>
  );
}
