"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { prevenirChangementFiliation } from "@/lib/alerte";
import { fullName } from "@/lib/types";
import { NOM_GARDIEN } from "@/lib/famille";

const empty = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

export async function savePerson(id: string, formData: FormData) {
  const supabase = await supabaseServer();

  const branch = empty(formData.get("branch_id"));
  const place = empty(formData.get("place_id"));
  const father_id = empty(formData.get("father_id"));
  const mother_id = empty(formData.get("mother_id"));

  // L'état d'avant, lu avant d'écrire : c'est le seul moment où l'on peut
  // encore dire ce qui a changé. On ne le demande que pour la filiation, la
  // seule modification dont on prévient.
  const { data: avant } = await supabase
    .from("people")
    .select(
      "first_name, last_name, married_name, sex, father_id, mother_id, father:father_id(first_name, last_name, married_name, sex), mother:mother_id(first_name, last_name, married_name, sex)",
    )
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("people")
    .update({
      first_name: (formData.get("first_name") as string).trim(),
      last_name: (formData.get("last_name") as string).trim(),
      married_name: empty(formData.get("married_name")),
      nickname: empty(formData.get("nickname")),
      sex: empty(formData.get("sex")),
      birth_display: empty(formData.get("birth_display")),
      deceased: formData.get("deceased") === "on",
      death_display: empty(formData.get("death_display")),
      father_id,
      mother_id,
      branch_id: branch ? Number(branch) : null,
      place_id: place ? Number(place) : null,
      place_detail: empty(formData.get("place_detail")),
      notes: empty(formData.get("notes")),
    })
    .eq("id", id);

  // Échouer fort : une erreur RLS ou de contrainte ne doit pas passer pour un
  // enregistrement réussi.
  if (error) throw new Error(error.message);

  const filiationChange =
    avant && (avant.father_id !== father_id || avant.mother_id !== mother_id);

  if (filiationChange) {
    // `after` fait partir le mail une fois la page rendue : personne n'attend
    // devant un écran figé qu'une API tierce réponde.
    after(async () => {
      const [{ data: nouveaux }, { data: moi }] = await Promise.all([
        supabase
          .from("people")
          .select(
            "father:father_id(first_name, last_name, married_name, sex), mother:mother_id(first_name, last_name, married_name, sex)",
          )
          .eq("id", id)
          .maybeSingle(),
        supabase.from("members").select("person:person_id(first_name, last_name)").maybeSingle(),
      ]);

      // Se prévenir de ses propres corrections n'apprend rien et finit par
      // faire ignorer l'alerte le jour où elle compte.
      const auteur = moi?.person
        ? `${moi.person.first_name} ${moi.person.last_name}`
        : "Quelqu'un";
      if (auteur === NOM_GARDIEN) return;

      const nom = (p: { first_name: string; last_name: string; married_name?: string | null; sex?: string | null } | null) =>
        p ? fullName(p) : null;

      await prevenirChangementFiliation({
        personne: fullName(avant),
        personneId: id,
        auteur,
        avant: { pere: nom(avant.father), mere: nom(avant.mother) },
        apres: { pere: nom(nouveaux?.father ?? null), mere: nom(nouveaux?.mother ?? null) },
      });
    });
  }

  revalidatePath(`/personne/${id}`);
  redirect(`/personne/${id}`);
}
