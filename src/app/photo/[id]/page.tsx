import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { signedPhotos } from "@/lib/photos";
import QuiEstQui, { type Repere } from "@/components/QuiEstQui";
import FilAriane from "@/components/FilAriane";
import { fullName } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Une photo de groupe, et le jeu du « qui est qui ».
 *
 * 🔑 Le geste est inversé par rapport au dépôt d'origine. Avant : je déclare
 * qui figure sur la photo, puis les autres découpent les visages — ce qui
 * demandait de cocher trente noms dans une liste de quatre cents AVANT même
 * d'envoyer le fichier. La photo du bulletin n'est jamais montée.
 *
 * Maintenant : on dépose, on pointe les têtes — « je ne sais pas qui c'est »
 * est une réponse valable — et la famille les nomme. Une photo de trente-trois
 * personnes devient trente-trois questions posées à deux cents cousins, au
 * lieu d'un travail de saisie pour une seule personne.
 */
export default async function Photo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: member } = await supabase.from("members").select("user_id").maybeSingle();
  if (!member) redirect("/rejoindre");

  const { data: photo } = await supabase
    .from("group_photos")
    .select("id, storage_path, caption, source, taken")
    .eq("id", Number(id))
    .maybeSingle();
  if (!photo) notFound();

  // 🔑 La liste des personnes n'est PAS chargée ici. Elle l'a été, et
  // `select("people").order("last_name")` sans limite ramenait mille lignes —
  // le plafond silencieux de PostgREST — sur plus de trois mille fiches. La
  // recherche se faisant en mémoire dans ce tableau tronqué, la moitié de
  // l'alphabet était introuvable : « je ne peux pas lier cette photo à Auguste
  // Velay » (Camille, page 11). Aucune erreur nulle part, juste des gens qui
  // n'existaient pas. On interroge maintenant `search_people` à la frappe,
  // comme la recherche du site.
  const { data: marks } = await supabase
    .from("photo_marks")
    .select("id, person_id, x, y, people:person_id(first_name, last_name, married_name, photo_url)")
    .eq("photo_id", photo.id)
    .order("id");

  const urls = await signedPhotos(supabase, [photo.storage_path]);
  const src = urls.get(photo.storage_path);

  const reperes: Repere[] = (marks ?? []).map((m) => ({
    id: m.id,
    person_id: m.person_id,
    x: m.x,
    y: m.y,
    nom: m.people ? fullName(m.people) : null,
    aPhoto: Boolean(m.people?.photo_url),
  }));

  const anonymes = reperes.filter((r) => !r.person_id).length;
  const nommes = reperes.length - anonymes;

  return (
    <div className="pb-56">
      <FilAriane
        etapes={[
          { label: "Chercher", href: "/" },
          { label: "Les photos", href: "/photos" },
          { label: photo.caption },
        ]}
      />

      <header className="mb-4">
        <h1 className="serif text-2xl font-semibold">{photo.caption}</h1>
        <p className="mt-1 text-sm text-muted">
          {photo.taken ? `${photo.taken} · ` : ""}
          {photo.source}
          {reperes.length > 0 && (
            <>
              {" "}
              · {nommes} personne{nommes > 1 ? "s" : ""} nommée{nommes > 1 ? "s" : ""}
              {anonymes > 0 && `, ${anonymes} à trouver`}
            </>
          )}
        </p>
      </header>

      {src ? (
        <QuiEstQui photoId={photo.id} src={src} reperes={reperes} />
      ) : (
        <p className="text-muted">Image indisponible.</p>
      )}

      {/* Les visages nommés, en toutes lettres sous la photo : sur un
          téléphone, survoler un rond ne dit rien, et l'on veut pouvoir lire la
          liste sans viser. */}
      {nommes > 0 && (
        <ul className="mt-5 flex flex-wrap gap-1.5">
          {reperes
            .filter((r) => r.person_id)
            .map((r) => (
              <li key={r.id}>
                <Link
                  href={`/personne/${r.person_id}`}
                  className="inline-block rounded-full border border-line px-3 py-1.5 text-sm"
                >
                  {r.nom}
                </Link>
              </li>
            ))}
        </ul>
      )}

      <p className="mt-8 border-t border-line pt-5 text-sm text-muted">
        Chaque tête nommée devient une question du quiz et peut donner son
        portrait à une fiche. Vous n&apos;avez pas besoin de tout savoir :
        posez un repère, quelqu&apos;un d&apos;autre mettra le nom.
      </p>
    </div>
  );
}
