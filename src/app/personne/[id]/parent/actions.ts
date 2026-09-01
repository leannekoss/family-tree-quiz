"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const empty = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

/**
 * Créer un père ou une mère et l'accrocher à l'enfant, en un geste.
 *
 * Le formulaire de correction savait CHOISIR un parent parmi les fiches
 * existantes ; il ne savait pas en créer un. Or c'est le cas courant en
 * remontant : le père de la pièce rapportée, la grand-mère que le bulletin
 * n'a jamais suivie — ces gens-là n'ont pas de fiche, et il fallait renoncer.
 *
 * Le rôle décide du sexe et du champ de destination : un « père » est un homme
 * dans `father_id`. La demi-fratrie éventuelle est rattachée en même temps si
 * on le demande — voir le formulaire.
 */
export async function ajouterParent(enfantId: string, formData: FormData) {
  const supabase = await supabaseServer();

  const role = formData.get("role") === "mere" ? "mere" : "pere";
  const prenom = (formData.get("first_name") as string).trim();

  const { data: cree, error } = await supabase
    .from("people")
    .insert({
      first_name: prenom,
      last_name: (formData.get("last_name") as string).trim(),
      sex: role === "pere" ? "M" : "F",
      birth_display: empty(formData.get("birth_display")),
      // En remontant, la personne est souvent disparue : la case est proposée,
      // jamais cochée d'office — on ne fait pas mourir les gens par défaut.
      deceased: formData.get("deceased") === "1",
      death_display: empty(formData.get("death_display")),
      branch_id: empty(formData.get("branch_id"))
        ? Number(formData.get("branch_id"))
        : null,
      collateral: formData.get("collateral") === "1",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Le lien, tout de suite : une fiche de parent créée sans être accrochée
  // serait pire que rien — elle existerait sans apparaître nulle part.
  // L'objet est écrit en toutes lettres plutôt qu'avec une clé calculée :
  // TypeScript vérifie alors que la colonne existe vraiment.
  const { error: lien } = await supabase
    .from("people")
    .update(role === "pere" ? { father_id: cree.id } : { mother_id: cree.id })
    .eq("id", enfantId);
  if (lien) throw new Error(lien.message);

  revalidatePath(`/personne/${enfantId}`);
  redirect(`/personne/${enfantId}?parent_ajoute=${encodeURIComponent(prenom)}`);
}
