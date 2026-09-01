import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { deposerPhoto } from "@/lib/photo-envoi";

/**
 * Découper un visage dans une photo de groupe et le poser sur une fiche.
 *
 * Le même geste se fait depuis DEUX endroits — la page de la photo, quand on
 * vient de nommer quelqu'un ; et la fiche, quand on y voit la personne sur une
 * photo sans avoir son portrait. Deux copies de ce calcul auraient fini par
 * diverger sur la qualité ou le centrage.
 *
 * `taille` est le côté du carré, en fraction de la LARGEUR de la photo.
 */
export async function decouperVisage(
  supabase: SupabaseClient<Database>,
  {
    src,
    personId,
    x,
    y,
    taille,
  }: { src: string; personId: string; x: number; y: number; taille: number },
): Promise<void> {
  // L'image est rapatriée en blob avant le canvas : le stockage est sur un
  // autre domaine, et dessiner une image distante « salit » le canvas, qui
  // refuse ensuite de rendre ses pixels.
  const source = await createImageBitmap(await (await fetch(src)).blob());
  try {
    // Le cadre est carré EN PIXELS : un carré exprimé en pourcentage donnerait
    // un rectangle dès que la photo n'est pas carrée.
    const cote = Math.round(source.width * taille);
    const cx = Math.round(source.width * x);
    const cy = Math.round(source.height * y);
    const x0 = Math.max(0, Math.min(source.width - cote, cx - cote / 2));
    const y0 = Math.max(0, Math.min(source.height - cote, cy - cote / 2));

    const canvas = document.createElement("canvas");
    canvas.width = cote;
    canvas.height = cote;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas indisponible");
    ctx.drawImage(source, x0, y0, cote, cote, 0, 0, cote, cote);

    const blob = await new Promise<Blob>((ok, ko) =>
      canvas.toBlob((b) => (b ? ok(b) : ko(new Error("découpe impossible"))), "image/jpeg", 0.9),
    );
    await deposerPhoto(
      supabase,
      personId,
      new File([blob], "visage.jpg", { type: "image/jpeg" }),
      "-groupe",
    );
  } finally {
    source.close();
  }
}
