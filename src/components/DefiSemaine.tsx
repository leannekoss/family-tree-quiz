import Link from "next/link";

export type CampDefi = { camp: string; photos: number };

const BLASON: Record<string, string> = { Moulin: "🏰", "Bastide": "🏡" };

/**
 * Le défi de la semaine : la chasse aux visages, camp contre camp.
 *
 * Le duel du classement se joue au quiz ; celui-ci se joue en CONTRIBUANT.
 * Chaque photo posée compte pour le camp de celui qui la pose, et tout se
 * remet à zéro le lundi matin — c'est ce qui donne une raison de revenir, et
 * une place à prendre chaque semaine.
 *
 * 🔑 C'est la gamification qui sert le vrai but du site : trois cent
 * soixante-dix visages manquent, et la Bastide n'en a qu'une poignée. On ne fait
 * pas gagner des points pour des points — on fait remplir l'arbre.
 */
export default function DefiSemaine({
  camps,
  joursRestants,
}: {
  camps: CampDefi[];
  /** Calculés par la PAGE depuis la base — jamais de new Date() ici. */
  joursRestants: number;
}) {
  if (camps.length < 2) return null;
  const [tete, queue] = camps;
  const max = Math.max(tete.photos, 1);
  const rien = tete.photos === 0 && queue.photos === 0;

  return (
    <section className="mb-6 rounded-xl border border-line bg-card px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="serif text-lg font-semibold">Le défi de la semaine</h2>
        <span className="shrink-0 text-xs text-muted">
          {joursRestants > 1 ? `${joursRestants} jours restants` : "dernier jour"}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-muted">
        La chasse aux visages : chaque photo posée compte pour son camp.
      </p>

      <div className="mt-3 space-y-2">
        {camps.map((c) => (
          <div key={c.camp} className="flex items-center gap-2.5">
            <span aria-hidden className="shrink-0 text-lg">
              {BLASON[c.camp] ?? "🏅"}
            </span>
            <span className="w-16 shrink-0 text-sm font-medium">{c.camp}</span>
            {/* La barre du second est relative au premier : l'écart SE VOIT,
                on n'a pas à comparer deux nombres. */}
            <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-acquis transition-[width] duration-500"
                style={{ width: `${Math.max((c.photos / max) * 100, c.photos > 0 ? 4 : 0)}%` }}
              />
            </div>
            <span className="serif w-8 shrink-0 text-right font-semibold tabular-nums">
              {c.photos}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-2.5 text-sm">
        {rien ? (
          <>
            Personne n&apos;a encore marqué — la première photo prend la tête.{" "}
          </>
        ) : tete.photos === queue.photos ? (
          <>Égalité parfaite. </>
        ) : (
          <>
            <strong>{tete.camp}</strong> mène de {tete.photos - queue.photos} —{" "}
            {queue.camp} peut encore renverser.{" "}
          </>
        )}
        <Link href="/photos" className="font-medium text-accent underline underline-offset-4">
          Ajouter une photo
        </Link>
      </p>
    </section>
  );
}
