import Link from "next/link";

export type PhotoGroupe = {
  id: number;
  caption: string;
  taken: string | null;
  reperes: number;
  nommes: number;
  anonymes: number;
};

/**
 * Les photos de groupe où il reste des têtes à nommer.
 *
 * Sa place est ici, sur « Reconnaître », et non sur « Ajouter une photo » :
 * déposer et identifier sont deux gestes différents, faits par deux personnes
 * différentes — celui qui a la photo la dépose, celui qui reconnaît les
 * visages passe derrière. Ranger la liste du côté du dépôt revenait à la
 * cacher à ceux qui viennent précisément pour aider.
 */
export default function PhotosANommer({ photos }: { photos: PhotoGroupe[] }) {
  if (photos.length === 0) return null;

  const aFaire = photos.filter((p) => p.reperes === 0 || p.anonymes > 0);

  return (
    <section className="mb-8">
      <h2 className="serif text-xl">Qui est qui sur ces photos&nbsp;?</h2>
      <p className="mb-3 mt-1 text-sm text-muted">
        Touchez une tête, dites qui c&apos;est. Vous n&apos;avez pas besoin de
        tout savoir : posez un repère et quelqu&apos;un d&apos;autre mettra le
        nom.
      </p>

      <ul className="space-y-2">
        {photos.map((p) => (
          <li key={p.id}>
            <Link
              href={`/photo/${p.id}`}
              className={`flex flex-wrap items-baseline justify-between gap-2 rounded-xl border p-3 ${
                p.reperes === 0 || p.anonymes > 0
                  ? "border-accent-line bg-accent-surface"
                  : "border-line bg-card"
              }`}
            >
              <span className="font-medium">
                {p.caption}
                {p.taken && <span className="font-normal text-muted"> · {p.taken}</span>}
              </span>
              <span className="shrink-0 text-sm text-muted">
                {p.reperes === 0
                  ? "aucune tête pointée"
                  : p.anonymes > 0
                    ? `${p.anonymes} à identifier`
                    : `${p.nommes} nommée${p.nommes > 1 ? "s" : ""}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {aFaire.length === 0 && (
        <p className="mt-2 text-sm text-muted">
          Toutes les têtes pointées portent un nom. Déposez une autre photo pour
          en ajouter.
        </p>
      )}
    </section>
  );
}
