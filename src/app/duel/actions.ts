"use server";

import { supabaseServer } from "@/lib/supabase/server";

export async function creerDuel(adversaires: string[]): Promise<{ code?: string; erreur?: string }> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erreur: "Non connecté" };

  const { data: duel, error } = await supabase
    .from("duels")
    .insert({ created_by: user.id })
    .select("id, code")
    .single();

  if (error || !duel) return { erreur: `Création du duel : ${error?.message ?? "inconnu"}` };

  const membres = [user.id, ...adversaires.filter((id) => id !== user.id)];
  const { error: errMembres } = await supabase
    .from("duel_members")
    .insert(membres.map((user_id) => ({ duel_id: duel.id, user_id })));

  if (errMembres) return { erreur: `Ajout des participants : ${errMembres.message}` };

  return { code: duel.code as string };
}
