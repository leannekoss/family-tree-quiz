import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const MAX_SIDE = 1000;

/**
 * Une photo de groupe se garde plus grande, et c'est indispensable : on y
 * découpe des visages. À 1000 pixels, onze convives d'un mariage font 90 pixels
 * de tête chacun — un avatar où personne ne se reconnaît. À 2400, chaque visage
 * en garde plus de deux cents, ce qui suffit pour une pastille nette.
 */
const MAX_GROUPE = 2400;
const QUALITY = 0.85;

/**
 * Réduit la photo dans le navigateur avant l'envoi. Une photo de téléphone pèse
 * 3 à 5 Mo pour un visage affiché en 150 px : sans cette étape, deux cents
 * fiches saturent le stockage et chaque page devient lente sur mobile.
 *
 * Ce fichier touche au canvas et n'a donc de sens que côté navigateur — il est
 * séparé de `photos.ts`, que les pages serveur importent.
 */
/**
 * Décode l'image en la réduisant AU PASSAGE, pas après.
 *
 * C'est la différence entre une photo qui passe et un onglet qui meurt : un
 * capteur de 108 mégapixels donne un bitmap décompressé de plus de quatre cents
 * mégaoctets, et un téléphone d'entrée de gamme tue l'onglet avant même qu'on
 * arrive au canvas. `resizeWidth` demande au décodeur de ne jamais monter cette
 * image en mémoire à sa taille d'origine.
 *
 * `imageOrientation: "from-image"` redresse les photos prises en portrait :
 * l'appareil enregistre l'image couchée avec une étiquette « tourne-moi », que
 * le canvas ignore. Sans ça, la moitié des portraits arrivent sur le flanc et
 * personne ne le signale — on croit juste que le site est mal fait.
 */
async function decoder(file: File, cote = MAX_SIDE): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // 🔑 `resizeWidth` AGRANDIT autant qu'il réduit. Un visage découpé dans une
    // photo de groupe fait deux cents pixels : le demander en mille le gonflait
    // à mille, et le portrait arrivait sur la fiche en bouillie. Sous un mégo
    // et demi, le fichier ne menace pas la mémoire du téléphone — on le décode
    // à sa taille réelle et `reduire()` s'occupe seul du cas où il est trop
    // grand. Au-dessus, la consigne de réduction reste indispensable : un
    // capteur de cent mégapixels tue l'onglet avant d'arriver au canvas.
    const petit = file.size < 1_500_000;
    return await createImageBitmap(file, {
      imageOrientation: "from-image",
      ...(petit ? {} : { resizeWidth: cote, resizeQuality: "high" as const }),
    });
  } catch {
    // Repli pour les formats qu'un navigateur affiche mais ne sait pas décoder
    // par cette voie. Le décodage passe alors par le rendu normal des images.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((ok, ko) => {
        img.onload = () => ok();
        img.onerror = () => ko(new Error("format d'image non reconnu"));
        img.src = url;
      });
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function reduire(file: File, cote = MAX_SIDE): Promise<Blob> {
  const source = await decoder(file, cote);
  const largeur = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const hauteur = source instanceof HTMLImageElement ? source.naturalHeight : source.height;

  // `resizeWidth` n'agit que sur la largeur : une photo en portrait ressort
  // encore trop haute, d'où cette seconde réduction sur la plus grande
  // dimension. Sur le chemin de repli, c'est elle qui fait tout le travail.
  const scale = Math.min(1, cote / Math.max(largeur, hauteur));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(largeur * scale);
  canvas.height = Math.round(hauteur * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponible");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (source instanceof ImageBitmap) source.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("conversion impossible"))),
      "image/jpeg",
      QUALITY,
    ),
  );
}

/**
 * Le côté d'une vignette. Deux cent quarante pixels couvrent le plus grand
 * usage — le portrait de 72 px d'une fiche sur un écran à trois fois la
 * densité — sans jamais servir à afficher grand : la version pleine reste là
 * pour ça.
 */
const COTE_VIGNETTE = 240;

/**
 * Où vit la vignette d'une photo.
 *
 * 🔑 Un préfixe séparé, et non un suffixe ajouté au nom : il est ainsi
 * IMPOSSIBLE qu'une vignette écrase l'original, quel que soit le chemin de
 * départ. C'est la garantie qui compte — on ne perd jamais une photo de
 * famille pour gagner des kilo-octets.
 */
export const cheminVignette = (original: string) => `vignettes/${original}`;

/**
 * Fabrique et dépose la vignette d'une image déjà stockée. Rend `true` si elle
 * a été écrite, `false` si elle existait déjà ou si l'image est illisible : la
 * vignette est un confort, son échec ne doit jamais empêcher quoi que ce soit.
 */
export async function deposerVignette(
  supabase: SupabaseClient<Database>,
  original: string,
  urlSignee: string,
): Promise<boolean> {
  try {
    const source = await recupererFichier(urlSignee);
    const petite = await reduire(source, COTE_VIGNETTE);
    const { error } = await supabase.storage
      .from("visages")
      .upload(cheminVignette(original), petite, {
        contentType: "image/jpeg",
        // `upsert: false` : si la vignette existe, on n'y touche pas. Et de
        // toute façon on n'écrit jamais ailleurs que sous `vignettes/`.
        upsert: false,
      });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Rapatrie une image déjà déposée dans le stockage pour la renvoyer ailleurs —
 * c'est le cas d'un candidat trouvé en ligne qu'on valide : le fichier existe,
 * il doit juste devenir la photo de quelqu'un. Le stockage répond
 * « Access-Control-Allow-Origin: * », ce fetch passe donc depuis le navigateur.
 */
export async function recupererFichier(url: string): Promise<File> {
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`image illisible (${reponse.status})`);
  const blob = await reponse.blob();
  return new File([blob], "visage.jpg", { type: blob.type || "image/jpeg" });
}

/**
 * Envoie la photo et la rattache à la fiche. Un chemin par personne, horodaté :
 * remplacer une photo n'écrase pas l'ancienne, et l'historique reste dans le
 * stockage.
 */
export async function deposerPhoto(
  supabase: SupabaseClient<Database>,
  personId: string,
  file: File,
  suffixe = "",
): Promise<string> {
  const blob = await reduire(file);
  const path = `${personId}/${Date.now()}${suffixe}.jpg`;

  const { error: up } = await supabase.storage
    .from("visages")
    .upload(path, blob, { contentType: "image/jpeg" });
  if (up) throw up;

  // La vignette part dans la foulée, depuis l'image déjà réduite en mémoire :
  // pas de second aller-retour réseau, et un échec ici ne compromet rien —
  // l'affichage retombe sur la version pleine.
  try {
    const petite = await reduire(
      new File([blob], "v.jpg", { type: "image/jpeg" }),
      COTE_VIGNETTE,
    );
    await supabase.storage
      .from("visages")
      .upload(cheminVignette(path), petite, { contentType: "image/jpeg", upsert: false });
  } catch {
    /* la photo est déposée, c'est le seul geste qui compte */
  }

  const { error: db } = await supabase
    .from("people")
    .update({ photo_url: path })
    .eq("id", personId);
  if (db) throw db;

  return path;
}

/**
 * Dépose une photo de groupe. Dire qui s'y trouve est FACULTATIF.
 *
 * Chaque personne cochée devient une tâche de découpe : quelqu'un touchera sa
 * tête sur « Reconnaître » et la pastille partira sur sa fiche. Mais la liste
 * peut rester vide — c'était le mur qui bloquait la meilleure photo du site,
 * trente noms à cocher avant même d'envoyer le fichier. Les têtes se pointent
 * ensuite, à plusieurs, sur la page de la photo.
 *
 * Rend l'identifiant de la photo : c'est vers elle qu'on repart pour nommer.
 */
export async function deposerGroupe(
  supabase: SupabaseClient<Database>,
  file: File,
  info: { caption: string; source: string; taken: string | null },
  personnes: string[],
): Promise<number> {
  const blob = await reduire(file, MAX_GROUPE);
  const path = `groupes/${Date.now()}.jpg`;

  const { error: up } = await supabase.storage
    .from("visages")
    .upload(path, blob, { contentType: "image/jpeg" });
  if (up) throw new Error(up.message);

  const { data, error } = await supabase
    .from("group_photos")
    .insert({ storage_path: path, caption: info.caption, source: info.source, taken: info.taken })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Les tâches en un seul appel : un aller-retour par personne ferait onze
  // requêtes, et un échec au milieu laisserait une photo à moitié déclarée.
  if (personnes.length > 0) {
    const { error: tach } = await supabase
      .from("photo_tasks")
      .insert(personnes.map((person_id) => ({ photo_id: data.id, person_id })));
    if (tach) throw new Error(tach.message);
  }

  return data.id;
}
