"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export async function inviter(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const note = String(formData.get("note") ?? "").trim();

  if (!email.includes("@")) throw new Error("Adresse invalide.");

  const supabase = await supabaseServer();
  // Une seule opération : la personne est autorisée ET son compte est créé, avec
  // le code famille pour mot de passe. Elle peut entrer immédiatement, sans
  // qu'aucun email ne parte.
  const { error } = await supabase.rpc("inviter_membre", {
    nouvel_email: email,
    qui: note || undefined,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/acces");
}

export async function retirer(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const supabase = await supabaseServer();

  const { error } = await supabase.from("allowed_emails").delete().eq("email", email);
  if (error) throw new Error(error.message);

  revalidatePath("/acces");
}
