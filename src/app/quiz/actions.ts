"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Dépose une partie au classement.
 *
 * Le score n'est pas recalculé côté serveur : il vient du navigateur, et
 * quelqu'un qui tient à truquer le classement d'un quiz de famille y arrivera.
 * C'est assumé — la parade coûterait plus cher que le problème, et l'enjeu est
 * de savoir qui connaît le mieux ses cousins, pas de distribuer un prix.
 *
 * Ce qui est vérifié en revanche, c'est que la ligne est bien déposée au nom de
 * celui qui la dépose : la police d'insertion l'impose en base.
 */
export async function deposerScore(formData: FormData) {
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Rechargez la page." };

  const pseudo = String(formData.get("pseudo") ?? "").trim().slice(0, 24);
  const branche = String(formData.get("branche") ?? "").trim() || null;
  const score = Number(formData.get("score"));
  const justes = Number(formData.get("justes"));
  const total = Number(formData.get("total"));

  if (!pseudo) return { error: "Il faut un nom pour figurer au classement." };
  if (!Number.isFinite(score) || !Number.isFinite(justes) || !Number.isFinite(total)) {
    return { error: "Score illisible." };
  }

  const { error } = await supabase.from("scores").insert({
    user_id: user.id,
    pseudo,
    branche,
    score: Math.max(0, Math.round(score)),
    justes: Math.max(0, Math.round(justes)),
    total: Math.max(1, Math.round(total)),
  });

  if (error) return { error: "Le classement n'a pas pu être mis à jour." };

  revalidatePath("/quiz");
  return { ok: true };
}
