"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { deposerPhoto } from "@/lib/photo-envoi";
import Recadrer from "@/components/Recadrer";

export default function PhotoUpload({
  personId,
  hasPhoto,
}: {
  personId: string;
  hasPhoto: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [choisi, setChoisi] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirme, setConfirme] = useState(false);

  /**
   * Retirer la photo d'une fiche — parce qu'on s'est trompé de personne.
   *
   * 🔑 Le FICHIER n'est pas supprimé : on décroche `photo_url`, et l'image
   * reste dans le stockage. C'est la règle de tout le site — un visage mal
   * placé se retire, il ne se détruit pas, et le journal permet de revenir en
   * arrière si le retrait lui-même était une erreur.
   *
   * La confirmation en deux temps est indispensable : ce bouton voisine avec
   * « Changer la photo » sur une fiche que n'importe qui peut ouvrir.
   */
  async function retirer() {
    setBusy(true);
    setError(null);
    const { error: e } = await supabaseBrowser()
      .from("people")
      .update({ photo_url: null })
      .eq("id", personId);
    setBusy(false);
    setConfirme(false);
    if (e) {
      setError(e.message);
      return;
    }
    router.refresh();
  }

  async function send(source: Blob) {
    setBusy(true);
    setError(null);
    try {
      const fichier =
        source instanceof File ? source : new File([source], "visage.jpg", { type: "image/jpeg" });
      await deposerPhoto(supabaseBrowser(), personId, fichier);
      setChoisi(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "envoi impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          // La photo choisie n'est PAS envoyée tout de suite : on la garde en
          // mémoire le temps du cadrage. Ce qui n'est pas cadré ne quitte jamais
          // l'appareil — c'est ce qui rend utilisable une photo prise à deux,
          // avec un enfant à côté.
          if (f) setChoisi(f);
          e.target.value = "";
        }}
      />

      {choisi ? (
        <Recadrer
          fichier={choisi}
          onValider={send}
          onAnnuler={() => setChoisi(null)}
        />
      ) : confirme ? (
        /* 🔑 La confirmation disait « Oui, ce n'est pas la bonne personne » —
           et c'est ce qui a bloqué Isabelle : elle voulait retirer SA PROPRE
           photo, déposée par elle. On lui demandait d'affirmer quelque chose de
           faux, et une personne scrupuleuse n'ose pas cliquer. Le retrait a
           deux motifs (mauvaise personne, ou simplement je n'en veux plus) et
           la question ne doit en supposer aucun. */
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="text-sm">
            Supprimer cette photo&nbsp;?{" "}
            <span className="text-muted">
              Vous pourrez en remettre une autre quand vous voudrez.
            </span>
          </span>
          <button
            type="button"
            onClick={retirer}
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
        </span>
      ) : (
        <span className="inline-flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="rounded-lg border border-line px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {busy ? "Envoi…" : hasPhoto ? "Changer la photo" : "Ajouter une photo"}
          </button>
          {/* « Retirer » ne disait pas quoi — la fiche ? la personne ? — et le
              gris pâle le faisait passer pour un bouton désactivé : Isabelle a
              cru qu'elle ne POUVAIT pas retirer sa photo. Même discrétion, mais
              du texte normal et un verbe complet. */}
          {hasPhoto && (
            <button
              type="button"
              onClick={() => setConfirme(true)}
              className="rounded-lg border border-line px-3 py-1.5 text-sm"
            >
              Supprimer la photo
            </button>
          )}
        </span>
      )}

      {error && <p className="mt-2 text-sm text-alerte">{error}</p>}
    </div>
  );
}
