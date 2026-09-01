import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import PoserVisages, { type Tache } from "@/components/PoserVisages";
import PhotosANommer, { type PhotoGroupe } from "@/components/PhotosANommer";
import ValiderCandidats, { type Candidat } from "@/components/ValiderCandidats";
import Aide from "@/components/Aide";
import { fullName, ageLisible } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ligne = {
  id: number;
  position: string | null;
  passed_by: string[] | null;
  photo: { storage_path: string; source: string; caption: string; taken: string | null } | null;
  person: {
    id: string;
    first_name: string;
    last_name: string;
    married_name: string | null;
    sex: string | null;
    photo_url: string | null;
  } | null;
};

export default async function Visages() {
  const supabase = await supabaseServer();

  const { data: member } = await supabase.from("members").select("user_id").maybeSingle();
  if (!member) redirect("/rejoindre");

  const { data: { user } } = await supabase.auth.getUser();

  // Les photos de groupe où des têtes attendent un nom. Elles vivent ici et
  // non sur « Ajouter une photo » : déposer et reconnaître sont deux gestes,
  // faits par deux personnes — et c'est ici que vient celui qui veut aider.
  const { data: groupes } = await supabase.rpc("photos_de_groupe");
  const photosGroupe = (groupes ?? []) as PhotoGroupe[];

  const { data } = await supabase
    .from("photo_tasks")
    .select(
      `id, position, passed_by,
       photo:photo_id(storage_path, source, caption, taken),
       person:person_id(id, first_name, last_name, married_name, sex, photo_url)`,
    )
    .order("photo_id")
    .order("id");

  // Deux filtres que PostgREST ne sait pas poser sur une jointure : la personne
  // n'a pas encore de visage, et je n'ai pas déjà dit que je ne la reconnaissais
  // pas. Vingt-quatre lignes, autant les trier ici.
  const restantes = ((data ?? []) as Ligne[]).filter(
    (l) =>
      l.photo &&
      l.person &&
      !l.person.photo_url &&
      !(user && (l.passed_by ?? []).includes(user.id)),
  );

  // Un lien signé par photo, pas par tâche : treize personnes partagent le même
  // dîner.
  const chemins = [...new Set(restantes.map((l) => l.photo!.storage_path))];
  const { data: liens } = chemins.length
    ? await supabase.storage.from("visages").createSignedUrls(chemins, 60 * 60)
    : { data: [] };
  const lien = new Map((liens ?? []).map((l) => [l.path ?? "", l.signedUrl]));

  const taches: Tache[] = restantes
    .filter((l) => lien.get(l.photo!.storage_path))
    .map((l) => ({
      id: l.id,
      position: l.position,
      nom: fullName(l.person!),
      personId: l.person!.id,
      source: l.photo!.source,
      caption: l.photo!.caption,
      taken: l.photo!.taken,
      url: lien.get(l.photo!.storage_path)!,
    }));

  // Les photos trouvées en ligne, jamais posées d'office. On écarte celles dont
  // la personne a déjà un visage, et celles que ce lecteur a déjà refusées.
  const { data: propositions } = await supabase
    .from("photo_candidates")
    .select(
      `id, storage_path, source_site, source_title, source_url, why, confiance, refused_by,
       person:person_id(id, first_name, last_name, married_name, sex, birth_display, birth_year, death_year, deceased, photo_url)`,
    )
    .order("id");

  type Proposition = {
    id: number;
    storage_path: string;
    source_site: string;
    source_title: string;
    source_url: string;
    why: string | null;
    confiance: string;
    refused_by: string[] | null;
    person: Parameters<typeof fullName>[0] & {
      id: string;
      photo_url: string | null;
      birth_display: string | null;
      birth_year: number | null;
      death_year: number | null;
      deceased: boolean;
    } | null;
  };

  const aJuger = ((propositions ?? []) as Proposition[]).filter(
    (p) => p.person && !p.person.photo_url && !(user && (p.refused_by ?? []).includes(user.id)),
  );

  const { data: vignettes } = aJuger.length
    ? await supabase.storage
        .from("visages")
        .createSignedUrls(aJuger.map((p) => p.storage_path), 60 * 60)
    : { data: [] };
  const vignette = new Map((vignettes ?? []).map((v) => [v.path ?? "", v.signedUrl]));

  const candidats: Candidat[] = aJuger
    .filter((p) => vignette.get(p.storage_path))
    .map((p) => ({
      id: p.id,
      personId: p.person!.id,
      nom: fullName(p.person!),
      age: ageLisible(p.person!),
      site: p.source_site,
      titre: p.source_title,
      lien: p.source_url,
      pourquoi: p.why,
      confiance: p.confiance,
      url: vignette.get(p.storage_path)!,
    }));

  // Rien à faire ici veut dire que le travail est fini, pas que la page est
  // cassée — mais un écran presque blanc dit le contraire. On compte donc ce
  // qui a été fait et ce qui reste ailleurs : c'est la seule chose qui
  // transforme une page vide en page utile.
  const vide = taches.length === 0 && candidats.length === 0;

  const [{ count: poses }, { count: aPourvoir }, { data: parBranche }, { count: decoupes }] = vide
    ? await Promise.all([
        supabase
          .from("people")
          .select("id", { count: "exact", head: true })
          .eq("collateral", false)
          .not("photo_url", "is", null),
        supabase
          .from("people")
          .select("id", { count: "exact", head: true })
          .eq("collateral", false)
          .is("photo_url", null),
        supabase
          .from("people")
          .select("branch_id, branches(name)")
          .eq("collateral", false)
          .is("photo_url", null),
        // Le nombre de découpes du bulletin, lu et non écrit en dur : il
        // grandira le jour où d'autres photos de groupe arriveront.
        supabase.from("photo_tasks").select("id", { count: "exact", head: true }),
      ])
    : [{ count: null }, { count: null }, { data: null }, { count: null }];

  // La branche la plus démunie : c'est par elle qu'il faut commencer, et le
  // dire vaut mieux que laisser choisir au hasard parmi sept.
  const retard = (() => {
    if (!parBranche) return null;
    const compte = new Map<string, number>();
    for (const p of parBranche) {
      const nom = (p.branches as { name: string } | null)?.name;
      if (nom) compte.set(nom, (compte.get(nom) ?? 0) + 1);
    }
    const [pire] = [...compte.entries()].sort((a, b) => b[1] - a[1]);
    return pire ? { nom: pire[0], combien: pire[1] } : null;
  })();

  if (vide) {
    return (
      <div>
        <PhotosANommer photos={photosGroupe} />

        <header className="mb-5">
          <h1 className="serif text-2xl font-semibold">Tout le monde est placé</h1>
          <p className="mt-1 text-muted">
            Les {decoupes ?? 0} visages des photos du bulletin ont trouvé leur
            fiche. Il n&apos;y a plus rien à découper ici — ce qui manque encore
            ne se trouve que dans vos albums.
          </p>
        </header>

        <div className="rounded-xl border border-accent-line bg-accent-surface p-5">
          <p className="serif text-xl">
            {poses ?? 0} visages ajoutés, {aPourvoir ?? 0} encore absents
          </p>
          {retard && (
            <p className="mt-2 text-sm">
              La branche <strong>{retard.nom}</strong> est la plus démunie :{" "}
              {retard.combien} personnes sans photo. C&apos;est par là que
              commencer.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/photos"
              className="rounded-lg bg-accent px-5 py-3 font-medium text-sur-plein"
            >
              Ajouter une photo
            </Link>
            <Link
              href="/hasard"
              className="rounded-lg border border-line bg-card px-5 py-3"
            >
              Ouvrir une fiche au hasard
            </Link>
          </div>
        </div>

        {/* Ce qui rendrait cette page vivante à nouveau : d'autres photos de
            groupe. Le dire ici, c'est demander au bon moment — à quelqu'un qui
            vient précisément d'essayer d'aider. */}
        <p className="mt-6 text-sm text-muted">
          Vous avez une photo de groupe où plusieurs cousins sont reconnaissables
          — un mariage, un déjeuner sous les tilleuls ? C&apos;est ce qui fait
          revivre cette page : envoyez-la au gardien et elle donnera dix visages
          d&apos;un coup.
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-5">
        <h1 className="serif text-2xl font-semibold">Retrouver les visages</h1>
        {/* Le jeu expliqué en TROIS PAS numérotés, plus en paragraphe. Le
            retour de la famille : « on ne comprend pas ce qu'on peut y
            faire ». Une consigne se lit quand elle ressemble à une notice de
            jeu de société — un pas, un geste. */}
        <ol className="mt-3 space-y-1.5 text-sm">
          <li className="flex gap-2.5">
            <span className="serif shrink-0 font-semibold text-accent">1.</span>
            Une photo s&apos;affiche, avec le nom de quelqu&apos;un qui s&apos;y
            trouve.
          </li>
          <li className="flex gap-2.5">
            <span className="serif shrink-0 font-semibold text-accent">2.</span>
            Touchez sa tête sur la photo, ajustez le cadre.
          </li>
          <li className="flex gap-2.5">
            <span className="serif shrink-0 font-semibold text-accent">3.</span>
            <span>
              Son portrait rejoint sa fiche —{" "}
              <strong className="text-accent">et vous gagnez 10 points</strong>.
            </span>
          </li>
        </ol>
        <Aide titre="Et si je ne reconnais personne ?">
          Passez : la question ira à quelqu&apos;un d&apos;autre, et elle ne vous
          sera plus reposée.{" "}
          <strong>Ne devinez jamais.</strong> Une photo ajoutée sur la mauvaise
          fiche ne se corrige que si quelqu&apos;un s&apos;en aperçoit, alors
          qu&apos;un visage manquant finit toujours par trouver preneur. Chaque
          nom renvoie à sa fiche si vous voulez vérifier de qui il s&apos;agit.
        </Aide>
      </header>

      <PhotosANommer photos={photosGroupe} />

      {/* Les candidats d'abord : un oui ou un non, c'est plus rapide qu'un
          recadrage, et ça donne le résultat le plus immédiat. */}
      {candidats.length > 0 && <ValiderCandidats candidats={candidats} />}

      {taches.length > 0 ? (
        <PoserVisages taches={taches} />
      ) : candidats.length > 0 ? null : (
        <div className="rounded-xl border border-line bg-card px-4 py-10 text-center">
          <p className="serif text-2xl">Tout le monde est placé.</p>
          <p className="mt-2 text-muted">
            Les visages qui manquent encore ne sont sur aucune photo du bulletin.
          </p>
          <Link
            href="/photos"
            className="mt-6 inline-block rounded-lg bg-accent px-5 py-3 font-medium text-sur-plein"
          >
            Ajouter mes photos
          </Link>
        </div>
      )}
    </div>
  );
}
