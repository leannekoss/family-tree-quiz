import Link from "next/link";
import Avatar from "@/components/Avatar";

export type Fete = {
  id: string;
  nom: string;
  prenom: string;
  photo_url: string | null;
  age: number;
  dans_x_jours: number;
  rond: boolean;
};

/**
 * Les anniversaires de la semaine, en tête de l'accueil.
 *
 * Le jour vient de la base, calculé en Europe/Paris — jamais de `new Date()`
 * ici : Vercel exécute en UTC et serait encore la veille entre minuit et 2 h du
 * matin heure de Paris en été, précisément quand la famille consulte le site le
 * soir. Un composant serveur qui reçoit des données déjà datées ne peut pas non
 * plus diverger du navigateur.
 *
 * Pourquoi une semaine et pas le jour même : 240 personnes ont une date
 * complète, réparties sur 173 jours de l'année. Un bandeau « c'est
 * l'anniversaire de X » serait donc vide **plus d'un jour sur deux**. Sur sept
 * jours, un seul jour de l'année est vide.
 */
export default function Anniversaires({
  fetes,
  photos,
}: {
  fetes: Fete[];
  photos: Map<string, string>;
}) {
  // Rien à dire : on ne dit rien. Un bandeau qui s'excuse d'être vide occupe le
  // haut du premier écran pour annoncer une absence.
  if (fetes.length === 0) return null;

  const aujourdhui = fetes.filter((f) => f.dans_x_jours === 0);
  // TOUS les anniversaires de la fenêtre, plus de coupe à trois. Le chargement
  // Chastel a doublé les dates connues : la semaine s'est remplie, et Yolaine —
  // à J+4 — passait à la trappe. La liste devient une bande qui GLISSE : elle
  // ne prend qu'une ligne quel que soit le nombre, et le doigt fait le reste.
  const bientot = fetes.filter((f) => f.dans_x_jours > 0);

  return (
    <section className="mb-6 rounded-xl border border-accent-line bg-accent-surface px-4 py-4">
      {aujourdhui.length > 0 ? (
        <>
          <h2 className="serif text-lg font-semibold">
            {aujourdhui.length > 1 ? "Deux anniversaires aujourd’hui" : "C’est son anniversaire"}
          </h2>
          <ul className="mt-3 space-y-2">
            {aujourdhui.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/personne/${f.id}`}
                  className="flex items-center gap-3 rounded-lg border border-line bg-card px-3 py-2.5"
                >
                  <Avatar
                    src={f.photo_url ? photos.get(f.photo_url) : null}
                    name={f.prenom}
                    size={40}
                  />
                  <span className="min-w-0">
                    <span className="serif block leading-tight">{f.nom}</span>
                    {/* Un âge rond se dit plus fort : c'est celui qu'on
                        souhaite, celui dont on parle à table. */}
                    <span className={f.rond ? "text-sm font-medium text-acquis" : "text-sm text-muted"}>
                      {f.rond ? `${f.age} ans aujourd’hui 🎉` : `${f.age} ans`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <h2 className="serif text-lg font-semibold">Les anniversaires de la semaine</h2>
      )}

      {bientot.length > 0 && (
        <div className={aujourdhui.length > 0 ? "mt-3" : "mt-2"}>
          {aujourdhui.length > 0 && (
            <p className="mb-1.5 text-xs uppercase tracking-wide text-muted">Et bientôt</p>
          )}
          {/* Une bande qui glisse, une carte par personne, dans l'ordre des
              jours. `snap` cale chaque carte au bord : on feuillette, on ne
              vise pas. Le dégradé du bord droit dit qu'il y a une suite —
              une bande qu'on peut glisser sans indice ne se glisse jamais. */}
          <div className="relative">
            <ul className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {bientot.map((f) => (
                <li key={f.id} className="snap-start">
                  <Link
                    href={`/personne/${f.id}`}
                    className="flex min-h-[44px] w-max items-center gap-2 rounded-lg border border-line bg-card px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="serif block whitespace-nowrap text-sm leading-tight">
                        {f.nom}
                      </span>
                      <span
                        className={`block whitespace-nowrap text-xs ${f.rond ? "font-medium text-acquis" : "text-muted"}`}
                      >
                        {f.age} ans {quand(f.dans_x_jours)}
                        {f.rond ? " 🎉" : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {bientot.length > 2 && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-accent-surface"
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * « demain », « dans 3 jours ». Le nom du jour de la semaine serait plus
 * naturel, mais il demanderait de connaître la date ici — et cette page ne doit
 * jamais recalculer un jour que la base a déjà tranché en heure de Paris.
 */
function quand(jours: number): string {
  if (jours === 1) return "demain";
  return `dans ${jours} jours`;
}
