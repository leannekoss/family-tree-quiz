import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

// Sans cela, Next servirait à tout le monde la même « personne au hasard »
// pendant des heures — le tirage se ferait une fois, à la compilation.
export const dynamic = "force-dynamic";

/**
 * Une fiche au hasard, à chaque fois différente.
 *
 * La recherche suppose qu'on cherche quelqu'un. Or l'usage le plus fréquent
 * d'un annuaire de famille, c'est de flâner : ouvrir une fiche, tomber sur un
 * nom oublié, remonter à ses parents, et y passer un quart d'heure. Cette page
 * n'affiche rien elle-même, elle tire au sort et s'efface.
 *
 * Les cousins collatéraux de la page 35 sont écartés du tirage. Ils ont leur
 * place dans l'annuaire — c'est là qu'on les retrouve quand leur nom tombe —
 * mais tomber sur un inconnu ne donne pas envie de recommencer, et c'est
 * exactement ce qu'on attend de ce bouton.
 */
export default async function Hasard() {
  const supabase = await supabaseServer();

  // Compter puis tirer un rang, plutôt que rapatrier quatre cents
  // identifiants pour n'en garder qu'un.
  const { count } = await supabase
    .from("people")
    .select("id", { count: "exact", head: true })
    .eq("collateral", false);

  if (!count) redirect("/");

  const rang = Math.floor(Math.random() * count);
  const { data } = await supabase
    .from("people")
    .select("id")
    .eq("collateral", false)
    .order("id")
    .range(rang, rang)
    .maybeSingle();

  redirect(data ? `/personne/${data.id}` : "/");
}
