export type Source = {
  pid: string;
  nom_complet: string;
  ne: number | null;
  mort: number | null;
};

/**
 * D'où viennent les informations de cette fiche, quand une source extérieure
 * la confirme.
 *
 * 🔑 Rien n'est recopié dans les notes. La correspondance vit dans la table du
 * relevé, et la fiche la lit : écrire ces quarante-sept sources à la main
 * aurait produit quarante-sept lignes dans le journal familial, toutes signées
 * du même nom, un jour où la famille regarde ce journal pour voir ce que font
 * les autres.
 *
 * 🔑 L'identifiant FamilySearch (PID) est PERMANENT. C'est ce qui permettra,
 * dans dix ans, de retrouver la même personne même si son nom y a été corrigé
 * entre-temps — et c'est ce qui rendra l'import du GEDCOM sans doublon.
 */
export default function Sources({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;

  return (
    <section className="mt-6 rounded-xl border border-line bg-card p-4">
      <h2 className="text-xs uppercase tracking-wide text-muted">
        Aussi relevé ailleurs
      </h2>
      <ul className="mt-2 space-y-1.5 text-sm">
        {sources.map((s) => (
          <li key={s.pid}>
            <a
              href={`https://ancestors.familysearch.org/fr/${s.pid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-4"
            >
              FamilySearch
            </a>{" "}
            {/* Le nom du relevé est donné tel quel : il porte souvent des
                prénoms que le bulletin ne connaît pas — « Blanche Marie Delcourt » là où l'arbre dit « Blanche Delcourt ». */}
            <span className="text-muted">
              · {s.nom_complet}
              {s.ne && ` (${s.ne}${s.mort ? `–${s.mort}` : ""})`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
