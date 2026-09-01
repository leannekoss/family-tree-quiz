import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const BUCKET = "visages";
const TTL = 60 * 60; // une heure : le temps d'une visite, pas d'un partage

/** Où vit la vignette d'une photo — même règle que dans `photo-envoi`. */
const vignette = (original: string) => `vignettes/${original}`;

/**
 * Le bucket est privé : chaque affichage demande un lien signé. On les demande
 * par lot, sinon une fiche avec parents, fratrie et enfants déclenche une
 * douzaine d'allers-retours.
 *
 * 🔑 `petit` demande la VIGNETTE plutôt que la photo pleine. Les portraits sont
 * stockés en mille pixels — cent trente-sept kilo-octets en moyenne — et
 * s'affichent souvent en quarante : un classement de douze joueurs coûtait un
 * méga-octet et demi pour des ronds gros comme un ongle. Supabase sait
 * redimensionner à la volée, mais seulement sur son offre payante ; les
 * vignettes sont donc des fichiers à part, fabriqués au dépôt.
 *
 * 🔑 Repli systématique : une photo sans vignette — les deux cent trente-six
 * déposées avant ce changement — rend son lien plein. Rien ne disparaît jamais
 * de l'écran faute de miniature.
 */
export async function signedPhotos(
  supabase: SupabaseClient<Database>,
  paths: (string | null | undefined)[],
  options: { petit?: boolean } = {},
): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (wanted.length === 0) return new Map();

  // En mode vignette, on demande les deux versions d'un coup : un seul
  // aller-retour, et le repli ne coûte donc rien.
  const demandes = options.petit ? [...wanted.map(vignette), ...wanted] : wanted;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(demandes, TTL);

  // Une photo qui ne s'affiche pas ne doit pas faire tomber la fiche : on rend
  // ce qu'on a, l'initiale prend le relais pour le reste.
  if (error || !data) return new Map();

  const liens = new Map<string, string>();
  for (const d of data) {
    if (d.path && d.signedUrl) liens.set(d.path, d.signedUrl);
  }

  if (!options.petit) return liens;

  // La vignette d'abord, la photo pleine à défaut — toujours rangées sous le
  // chemin d'origine, pour que l'appelant n'ait rien à savoir de tout ceci.
  const sortie = new Map<string, string>();
  for (const p of wanted) {
    const url = liens.get(vignette(p)) ?? liens.get(p);
    if (url) sortie.set(p, url);
  }
  return sortie;
}
