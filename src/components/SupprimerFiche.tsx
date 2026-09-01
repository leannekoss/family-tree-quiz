"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Effacer une fiche — réservé au gardien, et pour un seul cas : le doublon.
 *
 * 🔑 Ce bouton n'existait pas, et c'était délibéré (migration 0017, 10/08) :
 * « corriger doit rester libre, effacer non ». Rien ne change à cette règle —
 * la policy `people_del` refuse toujours le DELETE à tout le monde sauf au
 * gardien, et ce composant ne s'affiche que pour lui. On ne rend pas la
 * suppression possible, on rend visible celle qui l'était déjà.
 *
 * Ce qui l'a rendu nécessaire : le 22/08/2026, un membre crée « Léonie Morel »
 * en double et écrit « je sais pas comment faire le delete 😬 ». Il ne pouvait
 * pas : ni bouton, ni droit. Chaque doublon passait donc par un message au
 * gardien, puis par une requête écrite à la main.
 *
 * ⚠️ Une suppression ne passe PAS par le journal — contrairement à toute
 * correction, elle ne se remonte pas. D'où la confirmation en deux temps, et
 * surtout le fait qu'elle nomme la personne : « supprimer » se clique
 * distraitement, « supprimer Léonie Morel » beaucoup moins.
 */
export default function SupprimerFiche({
  personId,
  nom,
  /** Une fiche qui a des enfants ou un conjoint n'est jamais un doublon récent. */
  rattachee,
}: {
  personId: string;
  nom: string;
  rattachee: boolean;
}) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function supprimer() {
    setBusy(true);
    setErreur(null);
    // 🔑 `return=representation` : sous RLS, un DELETE qui ne touche AUCUNE
    // ligne ne renvoie PAS d'erreur. Sans ce retour, un refus de policy se
    // lirait comme une réussite — la fiche resterait et l'écran dirait le
    // contraire. On exige donc la ligne effacée comme preuve.
    const { data, error } = await supabaseBrowser()
      .from("people")
      .delete()
      .eq("id", personId)
      .select("id");

    if (error) {
      setErreur(error.message);
      setBusy(false);
      return;
    }
    if (!data || data.length === 0) {
      setErreur("La fiche n'a pas été supprimée — vous n'en avez pas le droit.");
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (rattachee) {
    return (
      <p className="mt-2 text-sm text-muted">
        {nom} a des proches rattachés : sa fiche ne peut pas être supprimée
        d&apos;ici. Détachez-les d&apos;abord, ou corrigez la fiche plutôt que
        de l&apos;effacer.
      </p>
    );
  }

  if (!confirme) {
    return (
      <button
        type="button"
        onClick={() => setConfirme(true)}
        className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted"
      >
        Supprimer cette fiche
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-sm">
        Supprimer définitivement <strong>{nom}</strong>&nbsp;?{" "}
        <span className="text-muted">
          Contrairement à une correction, cela ne pourra pas être annulé.
        </span>
      </span>
      <button
        type="button"
        onClick={supprimer}
        disabled={busy}
        className="min-h-11 rounded-lg border border-alerte px-3 text-sm text-alerte disabled:opacity-50"
      >
        {busy ? "…" : "Oui, supprimer"}
      </button>
      <button
        type="button"
        onClick={() => setConfirme(false)}
        className="min-h-11 rounded-lg px-3 text-sm text-muted underline underline-offset-4"
      >
        Annuler
      </button>
      {erreur && <p className="w-full text-sm text-alerte">{erreur}</p>}
    </span>
  );
}
