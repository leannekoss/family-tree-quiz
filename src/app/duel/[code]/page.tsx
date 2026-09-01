import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { signedPhotos } from "@/lib/photos";
import Avatar from "@/components/Avatar";
import RejoindreEtPartager from "./RejoindreEtPartager";

export const dynamic = "force-dynamic";

export default async function DuelPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await supabaseServer();

  const { data: member } = await supabase
    .from("members")
    .select("user_id")
    .maybeSingle();
  if (!member) redirect(`/rejoindre?puis=/duel/${code}`);

  const { data: infoDuel } = await supabase.rpc("duel_par_code", {
    code_duel: code,
  });
  if (!infoDuel || infoDuel.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="serif text-2xl">Duel introuvable</p>
        <p className="mt-2 text-muted">
          Ce lien n&apos;est plus valide ou le duel n&apos;existe pas.
        </p>
        <Link
          href="/classement"
          className="mt-6 inline-block rounded-lg bg-accent px-5 py-3 font-medium text-sur-plein"
        >
          Voir le classement
        </Link>
      </div>
    );
  }

  const duel = infoDuel[0];

  const { data: lignes } = await supabase.rpc("classement_duel", {
    code_duel: code,
  });

  const dejaMembre = (lignes ?? []).some((l) => l.a_moi);

  const photos = await signedPhotos(
    supabase,
    (lignes ?? []).map((l) => l.photo_url).filter(Boolean) as string[],
    { petit: true },
  );

  return (
    <div className="pb-8">
      <header className="mb-5">
        <p className="text-sm text-muted">
          Défi lancé par {duel.pseudo_createur}
        </p>
        <h1 className="serif text-2xl font-semibold">Duel</h1>
      </header>

      <RejoindreEtPartager
        duelId={duel.id}
        code={code}
        dejaMembre={dejaMembre}
      />

      {(lignes ?? []).length > 0 ? (
        <ol className="mt-6 space-y-2">
          {(lignes ?? []).map((l, i) => (
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
                  {l.pseudo}
                </Link>
              ) : (
                <span
                  className={`min-w-0 flex-1 truncate ${l.a_moi ? "font-medium text-accent" : ""}`}
                >
                  {l.pseudo}
                </span>
              )}
              <span className="serif shrink-0 font-semibold tabular-nums">
                {l.score}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 rounded-lg border border-line bg-card px-4 py-6 text-center text-muted">
          Personne n&apos;a encore joué. Le premier qui fait une partie ouvre le
          score.
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/quiz"
          className="inline-block rounded-lg bg-accent px-6 py-3 font-medium text-sur-plein"
        >
          Jouer une partie
        </Link>
        <Link
          href="/classement"
          className="inline-block rounded-lg border border-line px-5 py-3 font-medium"
        >
          Classement général
        </Link>
      </div>
    </div>
  );
}
