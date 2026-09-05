import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import BulkPhotos from "@/components/BulkPhotos";
import VisagesManquants, { type Manquant } from "@/components/VisagesManquants";
import AjouterGroupe, { type Candidate } from "@/components/AjouterGroupe";
import { fullName } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Photos() {
  const supabase = await supabaseServer();

  const { data: member } = await supabase
    .from("members")
    .select("user_id")
    .maybeSingle();
  if (!member) redirect("/rejoindre");

  const { data: { user } } = await supabase.auth.getUser();

  // Les cousins collatéraux de la page 35 de la Gazette sortent de tous les comptes
  // de cet écran. Personne dans la famille n'a leur photo, et les compter
  // ferait tomber l'avancement de moitié du jour au lendemain sans que rien
  // n'ait été perdu — le meilleur moyen de décourager ceux qui jouent le jeu.
  const [{ count: total }, { count: posees }, { data }, { count: aRetrouver }] = await Promise.all([
    supabase.from("people").select("id", { count: "exact", head: true }).eq("collateral", false),
    supabase
      .from("people")
      .select("id", { count: "exact", head: true })
      .eq("collateral", false)
      .not("photo_url", "is", null),
    // Les personnes vivantes d'abord : ce sont celles dont quelqu'un a une photo
    // sous la main. Les disparus viennent après, ils demandent un album.
    //
    // Passé en fonction SQL pour rapporter la PISTE — « épouse de Timothy
    // Thornton » — qui demande de joindre les unions dans les deux sens
    // puis les parents à défaut : deux choses que PostgREST ne sait pas dire
    // en une requête.
    supabase.rpc("visages_manquants"),
    // Ce que CE lecteur peut encore faire, et rien d'autre. Le décompte brut
    // annonçait vingt-quatre têtes à retrouver alors qu'elles étaient placées ;
    // en ne filtrant que sur la photo il en promettait encore sept, toutes déjà
    // passées par le lecteur — le bandeau envoyait vers un écran vide.
    // `!inner` transforme la jointure en filtre ; sans lui PostgREST rend la
    // ligne même quand la personne a déjà son visage.
    supabase
      .from("photo_tasks")
      .select("id, person:person_id!inner(photo_url)", { count: "exact", head: true })
      .is("person.photo_url", null)
      .not("passed_by", "cs", `{${user?.id ?? "00000000-0000-0000-0000-000000000000"}}`),
  ]);

  // Les photos de groupe déjà déposées, celles qui ont le plus de têtes
  // anonymes en tête : c'est là que le prochain venu sera le plus utile.
  const { data: groupes } = await supabase.rpc("photos_de_groupe");

  // Toute la famille, avec l'état de sa photo : le formulaire de photo de
  // groupe met les visages manquants en tête, mais doit pouvoir retrouver
  // n'importe qui — sur une photo de mariage, la moitié des gens ont déjà leur
  // portrait.
  const { data: tous } = await supabase
    .from("people")
    .select("id, first_name, last_name, married_name, sex, photo_url, branches(name)")
    .eq("collateral", false)
    .order("last_name");

  const tousLesGens: Candidate[] = (tous ?? []).map((p) => ({
    id: p.id,
    nom: fullName(p),
    branche: (p.branches as { name: string } | null)?.name ?? null,
    aPhoto: Boolean(p.photo_url),
  }));

  // La fonction rend `branche` à plat, là où PostgREST imbriquait `branches`.
  const manquants: Manquant[] = (data ?? []).map((p) => ({
    id: p.id,
    nom: fullName(p),
    branche: p.branche,
    annee: p.birth_display,
    piste: p.piste,
  }));

  return (
    <div>
      <header className="mb-5">
        <h1 className="serif text-2xl font-semibold">Ajouter une photo</h1>
        <p className="mt-1 text-muted">
          Il manque encore des visages dans l&apos;arbre.{" "}
          <strong className="text-accent">Chaque photo vaut 10 points</strong> au
          tableau{" "}
          <Link href="/classement" className="underline underline-offset-4">
            des contributeurs
          </Link>
          .
        </p>
      </header>

      {/* Les chemins possibles, montrés en BOUTONS et non racontés en
          paragraphes. Le retour de la famille était sans appel : « on ne
          comprend pas ce qu'on peut y faire ». Personne ne lit un paragraphe
          d'explication — on cherche des choses à toucher, et chaque carte dit
          un geste. La troisième carte n'apparaît que s'il RESTE des têtes à
          replacer : « Rien à replacer — tout est fait » invitait à toucher
          une carte pour découvrir qu'il n'y avait rien derrière. */}
      <div
        className={`mb-8 grid gap-2 ${(aRetrouver ?? 0) > 0 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
      >
        <a
          href="#une-personne"
          className="rounded-xl border border-line bg-card p-3"
        >
          <span aria-hidden className="text-2xl">🖼️</span>
          <span className="mt-1 block font-medium leading-snug">
            J&apos;ai la photo d&apos;une personne
          </span>
          <span className="mt-0.5 block text-sm text-muted">
            Touchez son nom dans la liste, choisissez la photo : c&apos;est fait.
          </span>
        </a>
        <a href="#groupe" className="rounded-xl border border-line bg-card p-3">
          <span aria-hidden className="text-2xl">👥</span>
          <span className="mt-1 block font-medium leading-snug">
            J&apos;ai une photo de groupe
          </span>
          <span className="mt-0.5 block text-sm text-muted">
            Un mariage, un déjeuner : déposez-la, elle donnera dix visages
            d&apos;un coup.
          </span>
        </a>
        {(aRetrouver ?? 0) > 0 && (
          <Link
            href="/visages"
            className="rounded-xl border border-accent-line bg-accent-surface p-3"
          >
            <span aria-hidden className="text-2xl">👀</span>
            <span className="mt-1 block font-medium leading-snug">
              Je sais reconnaître les têtes
            </span>
            <span className="mt-0.5 block text-sm text-muted">
              {aRetrouver} visage{(aRetrouver ?? 0) > 1 ? "s" : ""} à replacer
              sur les photos déposées.
            </span>
          </Link>
        )}
      </div>

      <section id="une-personne" className="scroll-mt-4">
      <VisagesManquants
        manquants={manquants}
        posees={posees ?? 0}
        total={total ?? 0}
      />
      </section>

      {/* La matière première de « Retrouver les visages », qui n'en avait plus :
          les trois photos du bulletin sont traitées. Une photo de mariage à
          onze donne onze visages d'un coup, là où les fiches se remplissent une
          par une. */}
      <section id="groupe" className="mt-12 scroll-mt-4 border-t border-line pt-8">
        <h2 className="serif text-xl">Une photo où il y a du monde</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Un mariage, un déjeuner sous les tilleuls : déposez-la, même sans
          savoir qui est dessus. Les têtes se pointent ensuite, et la famille
          met les noms.
        </p>
        <AjouterGroupe gens={tousLesGens} />

        {(groupes ?? []).length > 0 && (
          <p className="mt-4 text-sm text-muted">
            {(groupes ?? []).length} photo{(groupes ?? []).length > 1 ? "s" : ""} de
            groupe déposée{(groupes ?? []).length > 1 ? "s" : ""} —{" "}
            <Link href="/visages" className="underline underline-offset-4">
              dites qui est qui
            </Link>
            .
          </p>
        )}
      </section>

      <section className="mt-12 border-t border-line pt-8">
        <h2 className="serif text-xl">Vous en avez beaucoup d&apos;un coup ?</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Chaque fichier nommé d&apos;après la personne — <em>alice-de-hesse.jpg</em>,{" "}
          <em>Alice Hesse.jpeg</em> — retrouve sa fiche tout seul. Rien
          n&apos;est envoyé avant que vous appuyiez sur le bouton.
        </p>
        <BulkPhotos />
      </section>

      <p className="mt-10 border-t border-line pt-6 text-sm text-muted">
        Les photos ne sortent pas d&apos;ici : le stockage est privé et chaque
        affichage passe par un lien à durée limitée. Une photo ajoutée sur la
        mauvaise fiche se remplace depuis la fiche elle-même.
      </p>
    </div>
  );
}
