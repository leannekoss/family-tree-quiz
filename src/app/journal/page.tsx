import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import FilAriane from "@/components/FilAriane";
import Aide from "@/components/Aide";

export const dynamic = "force-dynamic";

type Ligne = {
  id: number;
  quand: string;
  qui: string;
  quoi: string;
  sujet: string;
  sujet_id: string | null;
  detail: string | null;
};

/** « il y a deux heures », « hier », « le 3 juin » — jamais une date ISO. */
function quandLisible(iso: string, maintenant: Date): string {
  const d = new Date(iso);
  const minutes = Math.round((maintenant.getTime() - d.getTime()) / 60000);
  if (minutes < 2) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} minutes`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} heure${heures > 1 ? "s" : ""}`;
  const jours = Math.round(heures / 24);
  if (jours === 1) return "hier";
  if (jours < 8) return `il y a ${jours} jours`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

// Les noms de colonnes ne veulent rien dire pour la famille.
const CHAMPS: Record<string, string> = {
  photo_url: "le visage",
  birth_display: "la naissance",
  death_display: "le décès",
  deceased: "le décès",
  first_name: "le prénom",
  last_name: "le nom",
  married_name: "le nom d'épouse",
  nickname: "le surnom",
  notes: "une note",
  place_id: "la maison",
  place_detail: "le lieu-dit",
  father_id: "le père",
  mother_id: "la mère",
  branch_id: "la branche",
  sex: "le genre",
  lat: "la position",
  lon: "la position",
  name: "le nom",
  commune: "la commune",
  occupants: "les habitants",
  geo_source: "la position",
  geo_precision: "la position",
  note: "une note",
};

function detailLisible(detail: string | null): string | null {
  if (!detail) return null;
  const vus = new Set<string>();
  for (const brut of detail.split(", ")) {
    const lisible = CHAMPS[brut];
    if (lisible) vus.add(lisible);
  }
  return vus.size ? [...vus].join(", ") : null;
}

export default async function Journal() {
  const supabase = await supabaseServer();

  const { data: me } = await supabase
    .from("members")
    .select("user_id, is_admin")
    .maybeSingle();
  if (!me) redirect("/rejoindre");

  const { data } = await supabase.rpc("journal_famille", { depuis_jours: 60 });
  const lignes = (data ?? []) as Ligne[];
  const maintenant = new Date();

  return (
    <div>
      <FilAriane etapes={[{ label: "Chercher", href: "/" }, { label: "Ce qui bouge" }]} />

      <header className="mb-5">
        <h1 className="serif text-2xl font-semibold">Ce qui bouge</h1>
        <p className="mt-1 text-muted">
          Tout ce que la famille a corrigé, ajouté ou déplacé, du plus récent au
          plus ancien.
        </p>
        <Aide titre="Et si quelqu'un se trompe ?">
          Rien n&apos;est jamais perdu.{" "}
          <strong>Chaque ligne renvoie à sa fiche, et chaque fiche garde son
          historique</strong> avec un bouton pour revenir à l&apos;état
          précédent. Personne n&apos;a besoin de valider quoi que ce soit avant :
          on répare après, ce qui va beaucoup plus vite que de tout relire avant.
        </Aide>
      </header>

      {lignes.length === 0 ? (
        <p className="rounded-xl border border-line bg-card px-4 py-10 text-center text-muted">
          Rien n&apos;a bougé ces deux derniers mois.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {lignes.map((l) => {
            const quoi = detailLisible(l.detail);
            return (
              <li key={l.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-3">
                <span className="font-medium">{l.qui}</span>
                <span className="text-muted">{l.quoi}</span>
                {l.sujet_id ? (
                  <Link
                    href={`/personne/${l.sujet_id}`}
                    className="serif underline underline-offset-4"
                  >
                    {l.sujet}
                  </Link>
                ) : (
                  <span className="serif">{l.sujet}</span>
                )}
                {quoi && <span className="text-sm text-muted">— {quoi}</span>}
                <span className="ml-auto shrink-0 text-xs text-muted">
                  {quandLisible(l.quand, maintenant)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
