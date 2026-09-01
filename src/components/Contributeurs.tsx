import Link from "next/link";

export type Contributeur = {
  pseudo: string;
  /** La fiche du contributeur, quand il s'est rattaché. */
  person_id: string | null;
  photos: number;
  corrections: number;
  fiches: number;
  points: number;
  a_moi: boolean;
};

/**
 * Ceux qui font l'arbre.
 *
 * Un tableau à côté de celui du quiz, jamais mélangé avec lui. Le quiz mesure ce
 * qu'on sait ; celui-ci mesure ce qu'on donne — et les deux ne se convertissent
 * pas l'un dans l'autre. Ajouter des points de contribution au score du quiz
 * ferait qu'on ne saurait plus si le premier connaît la famille ou s'il a vidé
 * son album photo.
 *
 * L'ordre met les photos devant, parce que c'est ce qui manque : deux cents
 * visages absents contre quelques dates approximatives.
 */
export default function Contributeurs({ lignes }: { lignes: Contributeur[] }) {
  if (lignes.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="serif text-lg font-semibold">Ceux qui font l&apos;arbre</h2>
      {/* Le barème est écrit, pas deviné. Un tableau qui affiche des points
          sans dire comment on les gagne se lit comme un jugement ; écrit, il
          devient une invitation — et on sait tout de suite que la photo qu'on
          a sur son téléphone vaut dix fois la date qu'on allait corriger. */}
      <p className="mt-1 text-sm text-muted">
        <strong className="text-accent">Une photo ajoutée vaut 10 points</strong>,
        une fiche créée 5, une correction 2. Ces points sont ceux de
        l&apos;entraide : ils ne comptent pas dans le quiz, qui mesure ce
        qu&apos;on sait quand celui-ci mesure ce qu&apos;on donne.
      </p>

      <ol className="mt-3 space-y-1.5">
        {lignes.map((l, i) => (
          <li
            key={l.pseudo + i}
            className={`flex items-baseline gap-3 rounded-lg border px-3 py-2 ${
              l.a_moi ? "border-accent-line bg-accent-surface" : "border-line bg-card"
            }`}
          >
            <span className="serif w-5 shrink-0 text-right text-lg tabular-nums text-muted">
              {i + 1}
            </span>
            {/* Le nom mène à la fiche, comme dans les deux classements
                au-dessus. Sans lien, on lit « Cédric » sans savoir lequel —
                et c'est justement en découvrant ces noms-là qu'on a envie
                d'aller voir qui ils sont. */}
            {l.person_id ? (
              <Link
                href={`/personne/${l.person_id}`}
                className={`min-w-0 flex-1 truncate underline decoration-dotted underline-offset-4 ${l.a_moi ? "font-medium text-accent" : ""}`}
              >
                {l.pseudo}
              </Link>
            ) : (
              <span className={`min-w-0 flex-1 truncate ${l.a_moi ? "font-medium text-accent" : ""}`}>
                {l.pseudo}
              </span>
            )}
            {/* Le détail sous le nom, le total à droite : on cherche d'abord
                son rang, et seulement ensuite d'où viennent les points. */}
            <span className="shrink-0 text-right">
              <span className="serif block leading-none tabular-nums">{l.points}</span>
              <span className="block text-[11px] text-muted">
                {l.photos > 0 && `${l.photos} photo${l.photos > 1 ? "s" : ""}`}
                {l.photos > 0 && l.corrections > 0 && " · "}
                {l.corrections > 0 && `${l.corrections} correction${l.corrections > 1 ? "s" : ""}`}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
