"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const empty = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

/**
 * Déclarer un mariage ou une union.
 *
 * Deux chemins, et le second est le plus important : le conjoint n'est le plus
 * souvent PAS dans l'arbre. Un formulaire qui ne proposerait qu'une liste
 * pousserait à y prendre l'homonyme le plus proche — la famille compte
 * plusieurs Cécile, dont une déjà mariée à quelqu'un d'autre. Créer la fiche
 * doit donc être aussi facile que d'en choisir une.
 */
export async function ajouterConjoint(personneId: string, formData: FormData) {
  const supabase = await supabaseServer();

  let conjointId = empty(formData.get("conjoint_id"));

  // Personne nouvelle : sa fiche naît ici, avec le strict nécessaire. Le reste
  // se complétera depuis sa propre page.
  if (formData.get("mode") === "nouveau") {
    const { data, error } = await supabase
      .from("people")
      .insert({
        first_name: (formData.get("first_name") as string).trim(),
        last_name: (formData.get("last_name") as string).trim(),
        sex: empty(formData.get("sex")),
        birth_display: empty(formData.get("birth_display")),
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    conjointId = data.id;
  }

  if (!conjointId) throw new Error("aucun conjoint indiqué");
  if (conjointId === personneId) throw new Error("on ne s'épouse pas soi-même");

  // L'union n'a pas de sens de lecture : chercher dans les deux ordres évite
  // le doublon qu'on ne verrait qu'une fois affiché deux fois sur la fiche.
  const { data: deja } = await supabase
    .from("unions")
    .select("id")
    .or(
      `and(p1_id.eq.${personneId},p2_id.eq.${conjointId}),and(p1_id.eq.${conjointId},p2_id.eq.${personneId})`,
    )
    .maybeSingle();

  if (!deja) {
    const { error } = await supabase.from("unions").insert({
      p1_id: personneId,
      p2_id: conjointId,
      kind: (formData.get("kind") as string) || "mariage",
      date_display: empty(formData.get("date_display")),
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/personne/${personneId}`);
  revalidatePath(`/personne/${conjointId}`);
  redirect(`/personne/${personneId}`);
}
