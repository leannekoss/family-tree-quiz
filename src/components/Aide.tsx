/**
 * Une aide qui s'ouvre au toucher, pas au survol.
 *
 * Le survol n'existe pas sur un téléphone, et cette application se consultera
 * surtout debout dans un jardin du Lot-et-Garonne. Un tooltip classique y serait
 * invisible — de l'aide réservée à celui qui n'en a pas besoin.
 *
 * `<details>` fait le travail sans une ligne de JavaScript : ouverture au clic
 * ou au clavier, annoncé correctement par les lecteurs d'écran, et le texte
 * reste affiché pendant qu'on le lit.
 */
export default function Aide({
  titre,
  children,
}: {
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group mt-2">
      {/* 44 px de haut, pas 20 : une aide qu'on ne peut pas viser au doigt est
          une aide réservée à qui n'en a pas besoin. Le texte garde sa taille,
          c'est la zone touchable qui s'agrandit. */}
      <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 py-2 text-sm text-muted underline decoration-dotted underline-offset-4 marker:hidden">
        <span
          aria-hidden
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-line text-[10px] leading-none"
        >
          ?
        </span>
        {titre}
      </summary>
      <div className="mt-2 rounded-lg border border-line bg-card px-3 py-2.5 text-sm text-muted [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-medium [&_strong]:text-foreground">
        {children}
      </div>
    </details>
  );
}
