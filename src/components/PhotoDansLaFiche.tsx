"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { decouperVisage } from "@/lib/decouper";

/**
 * Une photo de groupe telle qu'elle apparaît sur une fiche : entière, avec la
 * personne cerclée, de près quand on le demande — et son visage prêt à devenir
 * son portrait.
 *
 * 🔑 Deux vues, deux questions différentes. La vue d'ensemble dit « ce jour-là,
 * avec ces gens, devant cette maison » : c'est tout ce qui fait le prix d'une
 * photo d'avant-guerre. Le zoom dit « voilà son visage » — nécessaire quand
 * trente-trois personnes tiennent dans la largeur d'un téléphone. Le zoom se
 * fait par `transform-origin` posé sur le repère : l'image grossit AUTOUR de la
 * personne, sans calcul de décalage.
 *
 * 🔑 Et le portrait se découpe ICI. Une fiche sans visage affichait « Ajouter
 * une photo » — c'est-à-dire : allez en chercher une — alors que la personne
 * est là, à l'écran, sur la photo juste au-dessus. Découper ne défait rien : le
 * repère reste, et la photo de groupe continue de figurer sur sa fiche.
 */
export default function PhotoDansLaFiche({
  markId,
  photoId,
  personId,
  nom,
  prenom,
  aPhoto,
  src,
  caption,
  x,
  y,
}: {
  markId: number;
  photoId: number;
  personId: string;
  nom: string;
  prenom: string;
  /** A-t-elle déjà un portrait ? Décide du libellé, pas de la possibilité. */
  aPhoto: boolean;
  src: string;
  caption: string;
  x: number;
  y: number;
}) {
  const router = useRouter();
  const [pres, setPres] = useState(false);
  const [decoupe, setDecoupe] = useState(false);
  const [taille, setTaille] = useState(0.14);
  const [occupe, setOccupe] = useState(false);

  async function poser() {
    if (occupe) return;
    setOccupe(true);
    try {
      await decouperVisage(supabaseBrowser(), { src, personId, x, y, taille });
      setDecoupe(false);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "découpe impossible");
    } finally {
      setOccupe(false);
    }
  }

  /**
   * 🔑 Se tromper de personne est le geste le plus courant sur une photo de
   * 1915 : on reconnaît une allure, pas un visage. Or rien ne permettait de
   * revenir en arrière — « je ne retrouve pas comment dissocier ». Le repère
   * n'est donc PAS supprimé : il perd son nom et retourne dans « Reconnaître »,
   * où quelqu'un d'autre pourra le nommer. Personne ne perd le travail de
   * pointage, et l'erreur cesse d'être affichée.
   */
  async function dissocier() {
    if (occupe) return;
    setOccupe(true);
    const { error } = await supabaseBrowser()
      .from("photo_marks")
      .update({ person_id: null, named_by: null, named_at: null })
      .eq("id", markId);
    setOccupe(false);
    if (error) return alert(error.message);
    router.refresh();
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-line">
        <div
          style={{
            transform: pres && !decoupe ? "scale(3)" : "scale(1)",
            transformOrigin: `${x * 100}% ${y * 100}%`,
          }}
          className="transition-transform duration-300"
        >
          {/* 🔑 `lazy` : ces photos de groupe sont stockées en 2400 pixels —
              il le faut, on y découpe des visages — et la section vit en bas
              de la fiche. Quelqu'un qui figure sur trois photos les faisait
              toutes descendre avant même qu'on ait fait défiler, soit près de
              deux mégaoctets sur un téléphone. Le navigateur les charge
              maintenant quand elles approchent de l'écran. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={caption}
            loading="lazy"
            decoding="async"
            className="block w-full"
          />
        </div>

        {/* Pendant le réglage, le cercle laisse la place au cadre : deux
            marques concentriques sur un même visage ne se lisent plus. */}
        <span
          style={{ left: `${x * 100}%`, top: `${y * 100}%`, opacity: pres || decoupe ? 0 : 1 }}
          className="pointer-events-none absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] transition-opacity"
        />

        {decoupe && (
          <span
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: `${taille * 100}%`,
              aspectRatio: "1 / 1",
            }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
          />
        )}
      </div>

      {decoupe ? (
        <div className="mt-2 rounded-xl border border-accent-line bg-accent-surface p-4">
          <p className="text-sm">
            Ajustez le cadre autour du visage de <strong>{nom}</strong>. La photo
            reste reliée à sa fiche dans tous les cas.
          </p>
          <input
            type="range"
            min={4}
            max={45}
            value={Math.round(taille * 100)}
            onChange={(e) => setTaille(Number(e.target.value) / 100)}
            className="mt-3 w-full accent-[var(--accent)]"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              disabled={occupe}
              onClick={poser}
              className="min-h-11 rounded-lg bg-accent px-5 font-medium text-sur-plein disabled:opacity-50"
            >
              {occupe ? "Envoi…" : "En faire sa photo de profil"}
            </button>
            <button
              onClick={() => setDecoupe(false)}
              className="min-h-11 rounded-lg px-4 text-sm text-muted underline underline-offset-4"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={() => setPres(!pres)}
            className="min-h-11 rounded-lg border border-line bg-card px-4 text-sm"
          >
            {pres ? "Voir toute la photo" : "Zoomer sur son visage"}
          </button>
          <button
            onClick={() => {
              setPres(false);
              setDecoupe(true);
            }}
            className={`min-h-11 rounded-lg border px-4 text-sm ${
              aPhoto ? "border-line bg-card" : "border-accent-line bg-accent-surface text-accent"
            }`}
          >
            {aPhoto ? "Reprendre son portrait ici" : "En faire sa photo de profil"}
          </button>
          <Link
            href={`/photo/${photoId}`}
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-accent underline underline-offset-4"
          >
            Qui est qui sur cette photo
          </Link>
          <button
            disabled={occupe}
            onClick={dissocier}
            className="min-h-11 rounded-lg px-3 text-sm text-muted underline underline-offset-4 disabled:opacity-50"
          >
            Ce n&apos;est pas {prenom}
          </button>
        </div>
      )}
    </div>
  );
}
