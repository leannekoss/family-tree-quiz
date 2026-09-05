import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import QuiSuisJe from "@/components/QuiSuisJe";
import SearchBox from "@/components/SearchBox";
import Aide from "@/components/Aide";
import Anniversaires, { type Fete } from "@/components/Anniversaires";
import AnecdoteDuJour, { type Anecdote } from "@/components/AnecdoteDuJour";
import FlammeEnDanger from "@/components/FlammeEnDanger";
import { signedPhotos } from "@/lib/photos";
import DefiSemaine from "@/components/DefiSemaine";
import PremiersPas, { type Pas } from "@/components/PremiersPas";
import { BULLETIN } from "@/lib/famille";

export const dynamic = "force-dynamic";

/**
 * Un raccourci de bas de page. Le signe reste hors du lien souligné : souligner
 * un emoji lui ajoute une barre qui traverse le dessin.
 *
 * Ces raccourcis faisaient vingt pixels de haut, deux fois moins que les
 * onglets de navigation : ils se lisaient comme du texte et se visaient mal au
 * doigt. Le rembourrage vertical est ce qui les rend cliquables.
 */
function Raccourci({
  href,
  signe,
  children,
}: {
  href: string;
  signe: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2">
      <span aria-hidden>{signe}</span>
      <span className="underline underline-offset-4">{children}</span>
    </Link>
  );
}

export default async function Accueil() {
  const supabase = await supabaseServer();

  const { data: member } = await supabase
    .from("members")
    .select("user_id, is_admin, person_id")
    .maybeSingle();

  if (!member) redirect("/rejoindre");

  // Deux populations, deux comptes. L'arbre entier compte les 127 cousins
  // collatéraux ; le dispositif photos ne les inclut pas. Rapporter les visages
  // posés au total de l'arbre revenait à les compter sur des gens qui ne
  // peuvent pas en recevoir — 16 % affichés ici contre 23 % sur la page photos,
  // pour le même travail.
  const [
    { count },
    { count: photographiables },
    { count: withPhoto },
    { data: doyen },
    { data: fetes },
    { data: defi },
    { data: histoire },
    { data: maSerie },
  ] = await Promise.all([
    supabase.from("people").select("id", { count: "exact", head: true }),
    supabase
      .from("people")
      .select("id", { count: "exact", head: true })
      .eq("collateral", false),
    supabase
      .from("people")
      .select("id", { count: "exact", head: true })
      .eq("collateral", false)
      .not("photo_url", "is", null),
    // La borne haute de l'arbre était écrite en dur — et fausse : elle nommait
    // Zélida, née en 1821, alors qu'Édouard la précède de cinq ans. Une phrase
    // qui annonce un âge doit le lire dans la base, sans quoi elle se périme au
    // premier ancêtre ajouté.
    supabase
      .from("people")
      .select("id, first_name, last_name, birth_year, sex")
      .not("birth_year", "is", null)
      .order("birth_year")
      .limit(1)
      .maybeSingle(),
    // Le jour est tranché dans la base, en heure de Paris : Vercel exécute en
    // UTC et serait encore la veille entre minuit et 2 h du matin l'été.
    supabase.rpc("anniversaires", { fenetre: 7 }),
    supabase.rpc("defi_semaine"),
    supabase.rpc("anecdote_du_jour"),
    supabase.rpc("ma_serie"),
  ]);

  // Ce qu'il reste à faire pour celui qui arrive. La requête part avec les
  // autres et ne coûte rien de plus ; le composant s'efface de lui-même dès
  // que les quatre gestes sont faits.
  const { data: premiersPas } = await supabase.rpc("mes_premiers_pas");

  // La flamme ne parle que si elle risque de s'éteindre : au moins deux jours
  // de suite, et la partie du jour pas encore jouée.
  const s = maSerie?.[0] as { jours: number; joue_aujourdhui: boolean } | undefined;
  const flamme = s && s.jours >= 2 && !s.joue_aujourdhui ? s.jours : null;

  const aFeter = (fetes ?? []) as Fete[];
  const photosFetes = await signedPhotos(
    supabase,
    aFeter.filter((f) => f.dans_x_jours === 0).map((f) => f.photo_url),
    { petit: true },
  );


  const total = count ?? 0;
  const faces = withPhoto ?? 0;

  // « de Zélida » mais « d'Édouard » : l'élision se voit tout de suite quand
  // elle manque, et le prénom vient de la base — on ne peut pas l'écrire à la
  // main.
  const racine = doyen
    ? `${/^[aeiouyéèêëàâîïôûü]/i.test(doyen.first_name) ? "d'" : "de "}` +
      `${doyen.first_name} ${doyen.last_name} ` +
      `${doyen.sex === "F" ? "née" : doyen.sex === "M" ? "né" : "né·e"} en ${doyen.birth_year}`
    : null;

  return (
    <div>
      {/* La page n'avait aucun titre : un lecteur d'écran arrivait sur un
          champ de saisie sans savoir où il était, et les raccourcis clavier de
          navigation par titres ne trouvaient rien. Cette phrase disait déjà le
          rôle de la page — elle en devient le titre. */}
      {/* Posée une seule fois, et seulement à qui n'y a pas répondu : sans
          elle, le journal ne peut désigner un contributeur que par le début de
          son adresse email, devant deux cents personnes. */}
      {!member.person_id && <QuiSuisJe />}

      {/* Avant tout le reste, et seulement tant qu'il reste un geste à faire :
          c'est la première chose que voit quelqu'un qui n'est jamais revenu. */}
      {premiersPas?.[0] && <PremiersPas pas={premiersPas[0] as Pas} />}

      {/* Avant tout le reste : c'est le seul message de cette page qui se périme
          ce soir. La flamme vivait sur la page du quiz, c'est-à-dire seulement
          sous les yeux de qui était déjà revenu. */}
      {flamme && <FlammeEnDanger jours={flamme} />}

      {/* 🔑 LA RECHERCHE EN PREMIER, et c'est un renversement assumé.
          Elle était sous les anniversaires, l'anecdote et le défi, au nom d'un
          raisonnement qui se tenait : ce sont les trois choses qui changent
          chaque jour, donc les trois raisons de revenir. Mais on ne vient pas
          ici pour être diverti — on vient CHERCHER QUELQU'UN, et il fallait
          passer trois écrans de jeu avant d'atteindre le champ. Un dispositif
          d'engagement placé devant l'usage principal se retourne contre lui.
          Le reste ne disparaît pas : il descend d'un cran, à portée de pouce.

          Le titre annonçait « un prénom » quand la recherche trouve aussi les
          maisons. Ce n'est pas un détail de formulation : c'est lui qui décide
          de ce qu'on essaie de taper, et personne ne tente « La Prade » sous une
          question qui parle de prénoms. */}
      <h1 className="serif mb-4 text-xl leading-snug sm:text-2xl">
        Un prénom, un nom, une maison&nbsp;?
      </h1>

      {/* `useSearchParams` impose une frontière de suspension : sans elle,
          Next refuse de rendre la page. Le repli est vide parce que le champ
          apparaît instantanément — il n'y a rien à faire patienter. */}
      <Suspense fallback={null}>
        <SearchBox />
      </Suspense>

      {/* La recherche pardonne l'orthographe, mais personne ne le sait avant
          d'avoir essayé — et devant un nom étranger, on n'essaie pas. */}
      <Aide titre="Je ne sais pas l&apos;écrire">
        Tapez comme ça se prononce.{" "}
        <strong>« elisabeth » trouve Elizabeth, « batemberg » trouve Battenberg.</strong>{" "}
        Les accents et les traits d&apos;union n&apos;ont pas d&apos;importance, et
        deux lettres suffisent pour commencer. Cherchez aussi par nom d&apos;épouse :
        les deux mènent à la même fiche.
      </Aide>

      {/* Sous la recherche, ce qui change chaque jour — dans l'ordre où l'on
          s'y attache. Les anniversaires d'abord : c'est la seule chose de cette
          page qui appelle un geste vers quelqu'un de vivant, aujourd'hui.

          🔑 Le conteneur porte le trait de séparation, il ne doit donc exister
          que s'il a du contenu : chacun des trois s'efface de lui-même, et
          trois absences simultanées auraient collé deux traits l'un sur
          l'autre au-dessus du vide. */}
      {(aFeter.length > 0 || histoire?.[0] || (defi?.length ?? 0) >= 2) && (
        <div className="mt-10 space-y-2 border-t border-line pt-6">
          <Anniversaires fetes={aFeter} photos={photosFetes} />

          {/* Un arbre dit qui a existé — celle-ci dit ce qui s'est passé, et
              c'est ce qu'on raconte à table. */}
          {histoire?.[0] && <AnecdoteDuJour a={histoire[0] as Anecdote} />}

          {/* Le défi en dernier des trois : c'est le seul qui demande de jouer
              plutôt que de regarder, et celui dont l'absence ne manque à
              personne. */}
          <DefiSemaine
            camps={defi ?? []}
            joursRestants={defi?.[0]?.jours_restants ?? 0}
          />
        </div>
      )}

      <div className="mt-10 border-t border-line pt-6 text-sm">
        <p className="text-muted">
          {total} personnes{racine && <>, {racine} aux derniers arrivés</>}.{" "}
          {faces === 0 ? (
            <>
              Aucun visage pour l&apos;instant — la première photo s&apos;ajoute
              depuis n&apos;importe quelle fiche.
            </>
          ) : (
            <>
              {faces} {faces > 1 ? "visages ajoutés" : "visage ajouté"} sur{" "}
              {photographiables ?? total}.
            </>
          )}
        </p>

        {/* D'où viennent ces noms. Une généalogie sans sa source est une
            rumeur : sachant d'où sort une date, on sait quoi rouvrir quand
            elle est contestée — et le bulletin est chez tout le monde. */}
        <p className="mt-2 text-xs text-muted">
          {BULLETIN ? (
            <>Relevé du bulletin <em>{BULLETIN}</em>, complété par la famille.</>
          ) : (
            <>Relevé depuis Wikidata, complété par la famille.</>
          )}
        </p>

        {/* Mêmes signes que la barre de navigation, pour les mêmes
            destinations : un dessin qui change de sens d'un écran à l'autre
            coûte plus cher que pas de dessin du tout. */}
        <p className="mt-4 flex flex-wrap gap-x-2 gap-y-2">
          {/* Vers /hasard plutôt qu'une fiche tirée ici : le tirage local
              rapatriait quatre cents identifiants pour n'en garder qu'un, et
              plafonnait à 400 sur 402 — deux fiches ne pouvaient jamais sortir.
              Une seule façon de tirer au sort, au même endroit que l'onglet. */}
          <Raccourci href="/hasard" signe="🎁">
            Ouvrir une fiche au hasard
          </Raccourci>
          <Raccourci href="/quiz" signe="🎲">
            Jouer à qui est qui
          </Raccourci>
          <Raccourci href="/classement" signe="🏆">
            Voir le classement
          </Raccourci>
          <Raccourci href="/lieux" signe="🏡">
            Voir les maisons
          </Raccourci>
          <Raccourci href="/photos" signe="📷">
            Ajouter une photo
          </Raccourci>
          {member.is_admin && (
            <Raccourci href="/acces" signe="📨">
              Inviter quelqu&apos;un
            </Raccourci>
          )}
        </p>
      </div>
    </div>
  );
}
