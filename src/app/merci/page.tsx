import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import FilAriane from "@/components/FilAriane";
import Signaler from "@/components/Signaler";

export const dynamic = "force-dynamic";

/**
 * Ce que le classement ne compte pas.
 *
 * 🔑 Les points récompensent ce qui se mesure : une photo, une correction, une
 * partie. Or les meilleures idées du site sont venues de gens qui n'ont parfois
 * jamais joué — « on pourrait faire deviner qui est qui », « il faudrait des
 * fiches pour les maisons », « le quiz est trop dur pour ma branche ». Un
 * tableau de contributeurs qui les ignore dit implicitement que seul compte ce
 * qu'un compteur sait voir.
 *
 * 🔑 Une carte par personne, pas par idée : Antoinette en avait donné trois et
 * apparaissait trois fois de suite, ce qui se lit comme un bug plutôt que comme
 * un remerciement.
 */
export default async function Merci() {
  const supabase = await supabaseServer();

  const { data: member } = await supabase.from("members").select("user_id").maybeSingle();
  if (!member) redirect("/rejoindre");

  const { data } = await supabase
    .from("remerciements")
    .select("id, quoi, qui, person_ids, quand")
    .order("ordre");

  const lignes = data ?? [];

  // Les fiches citées, en une seule requête : le nom affiché doit être celui de
  // la fiche, pas celui recopié dans la ligne de remerciement.
  const ids = [...new Set(lignes.flatMap((l) => l.person_ids ?? []))];
  const { data: gens } = ids.length
    ? await supabase.from("people").select("id, first_name").in("id", ids)
    : { data: [] };
  const prenom = new Map((gens ?? []).map((g) => [g.id, g.first_name as string]));

  // Regroupement par contributeur, dans l'ordre de première apparition.
  const cartes = new Map<
    string,
    { qui: string; fiches: string[]; apports: { quoi: string; quand: string | null }[] }
  >();
  for (const l of lignes) {
    const carte = cartes.get(l.qui) ?? {
      qui: l.qui,
      fiches: (l.person_ids ?? []).filter((id: string) => prenom.has(id)),
      apports: [],
    };
    carte.apports.push({ quoi: l.quoi, quand: l.quand });
    cartes.set(l.qui, carte);
  }

  return (
    <div className="pb-10">
      <FilAriane etapes={[{ label: "Chercher", href: "/" }, { label: "Merci" }]} />

      <header className="mb-6">
        <h1 className="serif text-2xl font-semibold">Merci</h1>
        <p className="mt-1 text-muted">
          Rien ici n&apos;a été imaginé tout seul. Chaque idée vient de
          quelqu&apos;un, souvent d&apos;une phrase dite en passant, sur le
          groupe ou au téléphone.
        </p>
      </header>

      <ul className="space-y-3">
        {[...cartes.values()].map((c) => (
          <li key={c.qui} className="rounded-xl border border-line bg-card p-4">
            <p className="serif text-lg">{c.qui}</p>

            <ul className="mt-1 space-y-1.5">
              {c.apports.map((a, i) => (
                <li key={i} className="text-sm">
                  {a.quoi}
                  {a.quand && <span className="text-muted"> · {a.quand}</span>}
                </li>
              ))}
            </ul>

            {c.fiches.length > 0 && (
              <p className="mt-2 text-xs">
                {c.fiches.map((id, i) => (
                  <span key={id}>
                    {i > 0 && <span className="text-muted"> · </span>}
                    <Link href={`/personne/${id}`} className="underline underline-offset-4">
                      {c.fiches.length === 1 ? "Sa fiche" : prenom.get(id)}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>

      <section className="mt-8 rounded-xl border border-accent-line bg-accent-surface p-4">
        <h2 className="serif text-lg">Vous avez une idée&nbsp;?</h2>
        <p className="mt-1 text-sm">
          Quelque chose qui manque, une page qu&apos;on ne comprend pas, un jeu
          auquel vous avez pensé : dites-le. Tout ce qui est écrit plus haut est
          parti d&apos;une remarque comme celle-là, et votre nom viendra
          s&apos;y ajouter.
        </p>
        <div className="mt-3">
          <Signaler nom="une idée pour le site" />
        </div>
      </section>

      <p className="mt-8 text-sm text-muted">
        Les noms, les dates et les maisons viennent du bulletin{" "}
        <em>La Gazette</em>, tenu depuis des années par la famille, et de tout ce
        que chacun ajoute ici depuis.{" "}
        <Link href="/classement" className="underline underline-offset-4">
          Le classement
        </Link>{" "}
        compte les photos et les corrections ; cette page compte le reste.
      </p>
    </div>
  );
}
