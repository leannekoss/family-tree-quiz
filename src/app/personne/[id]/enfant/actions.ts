"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const empty = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

/**
 * Créer un enfant et le rattacher à ses deux parents d'un coup.
 *
 * Rattacher les deux importe plus qu'il n'y paraît : un enfant rattaché au seul
 * père n'apparaît pas dans la fratrie calculée du côté de la mère, et le calcul
 * de parenté le range une génération trop loin de la moitié de la famille. La
 * page présélectionne donc le conjoint quand il n'y en a qu'un.
 */
export async function ajouterEnfant(parentId: string, formData: FormData) {
  const supabase = await supabaseServer();

  const autre = empty(formData.get("autre_parent"));
  const parentEstPere = formData.get("parent_est_pere") === "1";

  // Le parent d'où l'on vient et le conjoint choisi se répartissent selon leur
  // sexe, pas selon l'ordre de saisie : on arrive aussi bien de la fiche de la
  // mère que de celle du père.
  const father_id = parentEstPere ? parentId : autre;
  const mother_id = parentEstPere ? autre : parentId;

  const prenom = (formData.get("first_name") as string).trim();
  const branche = empty(formData.get("branch_id"));

  const { error } = await supabase.from("people").insert({
    first_name: prenom,
    last_name: (formData.get("last_name") as string).trim(),
    sex: empty(formData.get("sex")),
    birth_display: empty(formData.get("birth_display")),
    father_id,
    mother_id,
    branch_id: branche ? Number(branche) : null,
    // Hérité du parent, jamais deviné. « Collatéral » veut dire « hors du
    // cercle de la fête » : les enfants d'un collatéral le sont aussi tant que
    // personne ne dit le contraire, sinon le quiz se met à demander de deviner
    // des gens que personne n'a jamais vus.
    collateral: formData.get("collateral") === "1",
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/personne/${parentId}`);
  // On revient sur le même formulaire, vidé, avec le prénom qui vient d'être
  // enregistré : personne n'ajoute un seul enfant, et repasser par la fiche
  // entre chaque frère est ce qui fait abandonner au deuxième.
  redirect(`/personne/${parentId}/enfant?ajoute=${encodeURIComponent(prenom)}`);
}
