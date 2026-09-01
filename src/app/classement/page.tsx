import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Classement from "@/components/Classement";
import Contributeurs, { type Contributeur } from "@/components/Contributeurs";
import PartagerScore from "@/components/PartagerScore";
import Podium from "@/components/Podium";
import { signedPhotos } from "@/lib/photos";
import Avatar from "@/components/Avatar";
import LancerDefi from "@/components/LancerDefi";

export const dynamic = "force-dynamic";

/**
 * Le classement, en dehors du quiz.
 *
 * Il n'existait qu'à la fin d'une partie : pour savoir si quelqu'un vous avait
 * dépassé, il fallait rejouer dix questions. C'est l'inverse de ce qu'un
 * classement doit produire — on vient voir son rang, et c'est *ensuite* que
 * l'envie de rejouer arrive. Enfermé derrière une partie, il ne pouvait
 * ramener personne.
 *
 * Le même composant qu'après une partie, sans le formulaire d'inscription :
 * `partie` n'est renseigné que lorsqu'il y a un score frais à déposer.
 */
export default async function ClassementPage() {
  const supabase = await supabaseServer();

  const { data: member } = await supabase.from("members").select("user_id").maybeSingle();
  if (!member) redirect("/rejoindre");

  const [{ data: lignes }, { data: branches }, { data: camps }, { data: noms }, { data: mains }, { data: dujour }, { data: joueursData }] =
    await Promise.all([
      supabase.rpc("classement", { combien: 20 }),
      supabase.rpc("classement_branches"),
      supabase.rpc("classement_camps"),
      supabase.from("branches").select("name").order("name"),
      supabase.rpc("contributeurs"),
      supabase.rpc("classement_du_jour", { combien: 5 }),
      supabase.rpc("joueurs_actifs"),
    ]);

  const joueurs = (joueursData ?? []).map((j) => ({
    user_id: j.user_id as string,
    pseudo: j.pseudo as string,
  }));

  const personne = (lignes ?? []).length === 0;

  // Sa propre ligne, et son rang : c'est ce qu'on vient chercher ici, et c'est
  // ce qui se partage. Le classement rend « a_moi » précisément pour cela.
  const moi = (lignes ?? []).findIndex((l) => l.a_moi);

  // Les portraits du classement absolu ET du jour, en un seul lot : le bucket
  // est privé, chaque affichage réclame un lien signé, et vingt-cinq allers-
  // retours pour vingt-cinq visages rendrait la page perceptiblement lente.
  const photos = await signedPhotos(supabase, [
    ...(lignes ?? []).map((l) => l.photo_url),
    ...(dujour ?? []).map((l) => l.photo_url),
  ], { petit: true });

  return (
    <div className="pb-8">
      <header className="mb-5">
        <h1 className="serif text-2xl font-semibold">Le classement</h1>
        <p className="mt-1 text-muted">
          {personne
            ? "Personne n'a encore joué. La première partie fixe la barre."
            : "Les meilleurs scores, et le duel entre branches."}
        </p>
      </header>

      {/* Le podium et ses titres du pays n'existaient qu'au sortir d'une partie,
          alors que cette page a précisément été faite pour qu'on n'ait plus à
          jouer dix questions pour voir le classement. Celui qui venait ici
          n'avait que des listes : le pruneau, le foie gras et la truffe — ce
          qu'on répète à table — restaient invisibles à qui ne jouait pas.

          Il se place au-dessus de tout : c'est la seule partie de cette page
          qu'on regarde pour le plaisir. Le champion du jour y reparaît en tête
          d'« Aujourd'hui » juste en dessous, et c'est voulu — une médaille et un
          rang ne disent pas la même chose. */}
      <Podium />

      {/* Aujourd'hui d'abord, et c'est tout l'intérêt : le classement absolu
          est figé — Anna mène avec 3361 points depuis le 11 août — et un
          tableau qu'on ne peut plus gagner cesse d'appeler. Celui du jour se
          rejoue chaque matin : il donne une raison de revenir à qui ne battra
          jamais le record. Masqué les jours sans partie, plutôt que d'annoncer
          un vide. */}
      {(dujour ?? []).length > 0 && (
        <section className="mb-8 rounded-xl border border-accent-line bg-accent-surface px-4 py-4">
          <h2 className="serif text-lg font-semibold">Aujourd&apos;hui</h2>
          <ol className="mt-3.5 space-y-2">
            {(dujour ?? []).map((l, i) => (
              <li
                key={l.pseudo + i}
                className="flex items-baseline gap-3 rounded-lg border border-line bg-card px-3 py-2.5"
              >
                <span className="serif w-5 shrink-0 text-right text-lg tabular-nums text-muted">
                  {i + 1}
                </span>
                <Avatar
                  src={l.photo_url ? photos.get(l.photo_url) : null}
                  name={l.pseudo}
                  size={28}
                />
                {l.person_id ? (
                  <Link
                    href={`/personne/${l.person_id}`}
                    className={`min-w-0 flex-1 truncate underline decoration-dotted underline-offset-4 ${l.a_moi ? "font-medium text-accent" : ""}`}
                  >
                    {l.emoji && <span aria-hidden className="mr-1">{l.emoji}</span>}
                    {l.pseudo}
                  </Link>
                ) : (
                  <span className={`min-w-0 flex-1 truncate ${l.a_moi ? "font-medium text-accent" : ""}`}>
                    {l.pseudo}
                  </span>
                )}
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {l.justes}/{l.total}
                </span>
                <span className="serif shrink-0 font-semibold tabular-nums">{l.score}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted">
            Remis à zéro chaque matin — le record de toujours, lui, ne bouge pas.
          </p>
        </section>
      )}

      {/* Le tableau des contributeurs s'affiche même quand personne n'a encore
          joué : la famille corrige et ajoute des photos bien avant de jouer au
          quiz, et ce travail-là mérite d'être vu tout de suite. */}
      {personne ? (
        <div className="rounded-xl border border-accent-line bg-accent-surface px-4 py-8 text-center">
          <p className="serif text-xl">À vous d&apos;ouvrir le bal</p>
          <Link
            href="/quiz"
            className="mt-5 inline-block rounded-lg bg-accent px-5 py-3 font-medium text-sur-plein"
          >
            Jouer une partie
          </Link>
        </div>
      ) : (
        <>
          <Classement
            lignes={lignes ?? []}
            branches={branches ?? []}
            camps={camps ?? []}
            photos={photos}
            nomsBranches={(noms ?? []).map((b) => b.name)}
          />

          {/* Le bouton après le tableau, pas avant : on lit d'abord où l'on
              est, et c'est ce constat qui donne envie de rejouer. */}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/quiz"
              className="inline-block rounded-lg bg-accent px-6 py-3 font-medium text-sur-plein"
            >
              Jouer une partie
            </Link>
            {moi >= 0 && (
              <PartagerScore
                score={lignes![moi].score}
                justes={lignes![moi].justes}
                total={lignes![moi].total}
                rang={moi + 1}
                joueurs={lignes!.length}
              />
            )}
          </div>

          {joueurs.length > 0 && (
            <div className="mt-6">
              <LancerDefi joueurs={joueurs} />
            </div>
          )}
        </>
      )}

      <Contributeurs lignes={mains ?? []} />
    </div>
  );
}
