import Link from "next/link";
import { decrireParente, type Parente as Lien } from "@/lib/parente";

/**
 * « Cette personne, c'est qui pour moi ? »
 *
 * Placé juste sous le nom, avant l'arbre : c'est la question qu'on se pose en
 * arrivant sur une fiche, et jusqu'ici il fallait remonter l'arbre à la main
 * pour y répondre. Sur un téléphone, à une fête, personne ne le fera.
 *
 * L'encart est en couleur d'accent parce qu'il ne doit pas se lire comme une
 * ligne d'état de plus : c'est la seule information de la page qui parle du
 * lecteur.
 */
export default function Parente({
  lien,
  cibleFeminin,
}: {
  lien: Lien | null;
  cibleFeminin: boolean;
}) {
  if (!lien) return null;
  const dit = decrireParente(lien, cibleFeminin);
  if (!dit) return null;

  // Qui n'a pas dit qui il était ne voit pas un encart vide mais la raison pour
  // laquelle il est vide, et le geste qui le remplit.
  if (lien.relation === "inconnu") {
    return (
      <Link
        href="/"
        className="mb-6 block rounded-xl border border-line bg-card px-4 py-3"
      >
        <p className="text-sm font-medium">{dit.titre}</p>
        <p className="mt-1 text-sm text-muted">{dit.detail}</p>
      </Link>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-accent-line bg-accent-surface px-4 py-3">
      <p className="serif text-lg font-semibold text-accent">{dit.titre}</p>
      {dit.detail && <p className="mt-1 text-sm text-muted">{dit.detail}</p>}
    </div>
  );
}
