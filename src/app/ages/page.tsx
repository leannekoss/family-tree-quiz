import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { signedPhotos } from "@/lib/photos";
import Avatar from "@/components/Avatar";
import FilAriane from "@/components/FilAriane";
import { fullName } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Qui a quel âge — par tranches.
 *
 * 🔑 La question derrière celle-ci n'est pas statistique, elle est pratique :
 * « à qui demander les vieilles photos ? ». Ce sont les aînés qui ont les
 * albums, et eux seuls savent reconnaître les visages d'avant-guerre. Une
 * tranche « 80 ans et plus » donne cette liste en un geste, là où l'arbre
 * demande de la reconstituer branche par branche.
 *
 * Les disparus sont exclus : leur âge est figé et n'apprend rien sur la
 * famille d'aujourd'hui.
 */
const TRANCHES = [
  { cle: "enfants", label: "Moins de 18 ans", min: 0, max: 17 },
  { cle: "jeunes", label: "18 à 29 ans", min: 18, max: 29 },
  { cle: "adultes", label: "30 à 49 ans", min: 30, max: 49 },
  { cle: "cinquantaine", label: "50 à 64 ans", min: 50, max: 64 },
  { cle: "seniors", label: "65 à 79 ans", min: 65, max: 79 },
  { cle: "aines", label: "80 ans et plus", min: 80, max: 130 },
];

export default async function Ages({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const supabase = await supabaseServer();

  const { data: member } = await supabase.from("members").select("user_id").maybeSingle();
  if (!member) redirect("/rejoindre");

  const { data } = await supabase
    .from("people")
    .select("id, first_name, last_name, married_name, photo_url, birth_year, birth_month, birth_day, branches(name)")
    .eq("deceased", false)
    .not("birth_year", "is", null)
    .order("birth_year");

  // L'âge se calcule au jour près quand la date complète est connue, à l'année
  // sinon : une fiche qui ne porte que « 1946 » ne doit pas disparaître des
  // listes pour autant.
  const aujourdhui = new Date();
  const gens = (data ?? []).map((p) => {
    let age = aujourdhui.getFullYear() - p.birth_year!;
    if (p.birth_month) {
      const passe =
        aujourdhui.getMonth() + 1 > p.birth_month ||
        (aujourdhui.getMonth() + 1 === p.birth_month &&
          (!p.birth_day || aujourdhui.getDate() >= p.birth_day));
      if (!passe) age -= 1;
    }
    return {
      id: p.id,
      nom: fullName(p),
      age,
      photo_url: p.photo_url,
      branche: (p.branches as { name: string } | null)?.name ?? null,
    };
  });

  const choisie = TRANCHES.find((x) => x.cle === t) ?? null;
  const liste = choisie
    ? gens.filter((g) => g.age >= choisie.min && g.age <= choisie.max)
    : [];

  const photos = await signedPhotos(supabase, liste.map((g) => g.photo_url), { petit: true });

  return (
    <div className="pb-10">
      <FilAriane
        etapes={[
          { label: "Chercher", href: "/" },
          { label: "En chiffres", href: "/famille" },
          { label: "Par âge" },
        ]}
      />

      <header className="mb-5">
        <h1 className="serif text-2xl font-semibold">Qui a quel âge</h1>
        <p className="mt-1 text-muted">
          Les {gens.length} personnes vivantes dont on connaît l&apos;année de
          naissance. C&apos;est chez les aînés que dorment les albums — et eux
          seuls savent nommer les visages d&apos;avant-guerre.
        </p>
      </header>

      <div className="mb-6 grid gap-2 sm:grid-cols-2">
        {TRANCHES.map((tr) => {
          const n = gens.filter((g) => g.age >= tr.min && g.age <= tr.max).length;
          const actif = choisie?.cle === tr.cle;
          return (
            <Link
              key={tr.cle}
              href={actif ? "/ages" : `/ages?t=${tr.cle}`}
              className={`flex min-h-11 items-center justify-between rounded-xl border px-4 py-3 ${
                actif ? "border-accent-line bg-accent-surface" : "border-line bg-card"
              }`}
            >
              <span className="font-medium">{tr.label}</span>
              <span className={actif ? "text-accent" : "text-muted"}>{n}</span>
            </Link>
          );
        })}
      </div>

      {choisie ? (
        <section>
          <h2 className="serif mb-3 text-xl">
            {liste.length} personne{liste.length > 1 ? "s" : ""} · {choisie.label}
          </h2>
          <ul className="space-y-1.5">
            {liste.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/personne/${g.id}`}
                  className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-card px-3 py-2"
                >
                  <Avatar
                    src={g.photo_url ? photos.get(g.photo_url) : null}
                    name={g.nom}
                    size={36}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{g.nom}</span>
                    {g.branche && (
                      <span className="block text-xs text-muted">branche {g.branche}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm text-muted">{g.age} ans</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-muted">
          Touchez une tranche pour voir qui s&apos;y trouve.
        </p>
      )}
    </div>
  );
}
