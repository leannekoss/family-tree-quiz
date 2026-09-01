"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { prevenirCreationPersonne } from "@/lib/alerte";
import { fullName } from "@/lib/types";

const empty = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

type Role = "enfant_de" | "parent_de" | "conjoint_de" | "frere_soeur_de";

/**
 * Créer une personne, et la rattacher DANS LE MÊME GESTE.
 *
 * 🔑 Le rattachement n'est pas une option : l'arbre se dessine par les liens.
 * Une fiche sans père, sans mère, sans conjoint et sans enfant n'apparaît nulle
 * part — ni dans l'arbre, ni dans une fratrie, ni dans le quiz. La créer serait
 * laisser quelqu'un travailler pour rien.
 *
 * Le formulaire grise déjà son bouton, mais on revérifie ici : un formulaire se
 * contourne, une action serveur non. C'est la même raison qui a mis la liste
 * fermée des emblèmes en contrainte de base plutôt qu'en règle d'interface.
 */
export async function creerPersonne(formData: FormData) {
  const supabase = await supabaseServer();

  const prenom = (formData.get("first_name") as string ?? "").trim();
  const nom = (formData.get("last_name") as string ?? "").trim();
  const role = formData.get("role") as Role;
  const cibleId = empty(formData.get("cible_id"));
  const sexe = empty(formData.get("sex"));

  if (!prenom || !nom) throw new Error("Le prénom et le nom sont nécessaires.");
  if (!cibleId)
    throw new Error(
      "Une nouvelle fiche doit être rattachée à quelqu'un de l'arbre, sinon elle n'apparaîtra nulle part.",
    );

  const { data: cible } = await supabase
    .from("people")
    .select("id, first_name, last_name, married_name, sex, father_id, mother_id")
    .eq("id", cibleId)
    .maybeSingle();
  if (!cible) throw new Error("La personne à qui rattacher cette fiche est introuvable.");

  // Échouer AVANT de créer : une fiche créée puis laissée sans lien parce que le
  // rattachement a échoué serait exactement la fiche invisible qu'on refuse.
  if (role === "parent_de" && !sexe)
    throw new Error(
      "Pour rattacher quelqu'un comme parent, il faut son sexe : c'est lui qui décide si la fiche devient le père ou la mère.",
    );
  if (role === "enfant_de" && !cible.sex)
    throw new Error(
      `Le sexe de ${fullName(cible)} n'est pas renseigné : impossible de savoir si cette fiche doit devenir son père ou sa mère. Complétez d'abord sa fiche.`,
    );
  if (role === "frere_soeur_de" && !cible.father_id && !cible.mother_id)
    throw new Error(
      `${fullName(cible)} n'a ni père ni mère connus : il n'y a pas de parents à partager. Rattachez plutôt cette fiche à un parent directement.`,
    );

  const { data: cree, error } = await supabase
    .from("people")
    .insert({
      first_name: prenom,
      last_name: nom,
      sex: sexe,
      birth_display: empty(formData.get("birth_display")),
      // La case est proposée, jamais cochée d'office : on ne fait pas mourir
      // les gens par défaut.
      deceased: formData.get("deceased") === "1",
      death_display: empty(formData.get("death_display")),
      branch_id: empty(formData.get("branch_id"))
        ? Number(formData.get("branch_id"))
        : null,
      // Une fiche créée à la main par la famille est de la famille : elle entre
      // dans le quiz et dans les visages à trouver. Seul l'import automatique
      // pose `collateral`.
      ...(role === "frere_soeur_de"
        ? { father_id: cible.father_id, mother_id: cible.mother_id }
        : {}),
      ...(role === "enfant_de"
        ? cible.sex === "M"
          ? { father_id: cible.id }
          : { mother_id: cible.id }
        : {}),
    })
    .select("id, first_name, last_name, married_name, sex")
    .single();

  if (error) throw new Error(error.message);

  if (role === "parent_de") {
    const { error: lien } = await supabase
      .from("people")
      .update(sexe === "M" ? { father_id: cree.id } : { mother_id: cree.id })
      .eq("id", cible.id);
    if (lien) throw new Error(lien.message);
  }

  if (role === "conjoint_de") {
    // « union » et non « mariage » : on sait qu'ils sont ensemble, pas qu'ils
    // se sont mariés. Le formulaire de la fiche permet de le préciser ensuite.
    const { error: lien } = await supabase
      .from("unions")
      .insert({ p1_id: cible.id, p2_id: cree.id, kind: "union" });
    if (lien) throw new Error(lien.message);
  }

  after(async () => {
    const { data: moi } = await supabase
      .from("members")
      .select("person:person_id(first_name, last_name)")
      .maybeSingle();
    const auteur = moi?.person
      ? `${moi.person.first_name} ${moi.person.last_name}`
      : "Quelqu'un";

    await prevenirCreationPersonne({
      personne: fullName(cree),
      personneId: cree.id,
      auteur,
      lien: DIT[role](fullName(cible)),
    });
  });

  revalidatePath(`/personne/${cible.id}`);
  redirect(`/personne/${cree.id}`);
}

/** Le lien, dit en français, pour le mail d'alerte. */
const DIT: Record<Role, (cible: string) => string> = {
  enfant_de: (c) => `enfant de ${c}`,
  parent_de: (c) => `parent de ${c}`,
  conjoint_de: (c) => `en couple avec ${c}`,
  frere_soeur_de: (c) => `frère ou sœur de ${c}`,
};
