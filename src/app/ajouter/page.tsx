import { supabaseServer } from "@/lib/supabase/server";
import FilAriane from "@/components/FilAriane";
import NouvellePersonne from "@/components/NouvellePersonne";
import { creerPersonne } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Ajouter quelqu'un que l'arbre ne connaît pas.
 *
 * On arrive ici depuis une recherche restée vide, et le nom cherché suit dans
 * l'adresse : c'est le moment exact où quelqu'un constate qu'une fiche manque,
 * et le seul où le contrôle des doublons est déjà fait — il vient de chercher.
 *
 * Les trois autres chemins de création (ajouter un parent, un enfant, un
 * conjoint) partent d'une fiche et restent les meilleurs quand on sait déjà de
 * qui l'on parle. Celui-ci part du nom.
 */
export default async function Ajouter({
  searchParams,
}: {
  searchParams: Promise<{ nom?: string }>;
}) {
  const { nom } = await searchParams;
  const supabase = await supabaseServer();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .order("name");

  return (
    <form action={creerPersonne} className="space-y-5 pb-12">
      <FilAriane etapes={[{ label: "Chercher", href: "/" }, { label: "Ajouter quelqu'un" }]} />

      <div>
        <h1 className="serif text-2xl font-semibold">Ajouter quelqu&apos;un</h1>
        <p className="mt-1 text-sm text-muted">
          Chaque création est enregistrée avec votre nom et datée. Rien
          n&apos;est définitif : tout se corrige ensuite depuis la fiche.
        </p>
      </div>

      <NouvellePersonne nomCherche={nom ?? ""} branches={branches ?? []} />
    </form>
  );
}
