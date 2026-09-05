import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import PlacesMap, { type MapPlace } from "@/components/PlacesMap";
import { fullName } from "@/lib/types";
import Aide from "@/components/Aide";
import { BULLETIN } from "@/lib/famille";

export default async function Lieux({
  searchParams,
}: {
  searchParams: Promise<{ maison?: string }>;
}) {
  // La maison qu'on vient voir, quand on arrive depuis la recherche. Un
  // paramètre d'adresse plutôt qu'un état : le lien se partage, se met en
  // favori, et survit au rechargement.
  const { maison } = await searchParams;
  const viser = Number(maison);
  const supabase = await supabaseServer();

  const { data: member } = await supabase
    .from("members")
    .select("user_id")
    .maybeSingle();
  if (!member) redirect("/rejoindre");

  const [{ data: places }, { data: residents }, { data: tous }] = await Promise.all([
    supabase
      .from("places")
      .select("id, name, commune, lat, lon, geo_precision, geo_source, occupants, outside, note, resume, histoire, histoire_source")
      .order("name"),
    supabase
      .from("people")
      .select("id, first_name, last_name, married_name, place_id, place_detail")
      .not("place_id", "is", null),
    // Tout le monde, rattaché ou non : c'est la liste dans laquelle on choisit
    // un habitant. La choisir évite les fautes de frappe que le champ texte
    // libre laissait passer — un accent oublié, et le nom ne renvoyait plus à
    // personne.
    supabase
      .from("people")
      .select("id, first_name, last_name, married_name, sex, place_id")
      .order("last_name"),
  ]);

  const byPlace = new Map<number, MapPlace["residents"]>();
  for (const r of residents ?? []) {
    if (!r.place_id) continue;
    const list = byPlace.get(r.place_id) ?? [];
    list.push({ id: r.id, name: fullName(r) });
    byPlace.set(r.place_id, list);
  }

  // Les maisons sans coordonnées partent aussi vers la carte : c'est là qu'on
  // peut les poser d'un doigt, ce qu'aucun annuaire n'a su faire.
  // Toutes les maisons, y compris celles du loin. Trois d'entre elles —
  // La Borde à Prayssas, Les Ormeaux, Saint-Vite — avaient des coordonnées
  // exactes et n'étaient qu'une ligne de texte sous la carte : le drapeau
  // `outside` les excluait au lieu de simplement les éloigner. Une maison de la
  // famille dont on connaît la position a sa place sur la carte, quitte à ce
  // qu'il faille dézoomer pour l'atteindre.
  const mapped: MapPlace[] = (places ?? [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      commune: p.commune,
      lat: p.lat,
      lon: p.lon,
      geo_precision: p.geo_precision,
      geo_source: p.geo_source,
      // Le relevé du bulletin nomme QUI habite chaque maison, y compris des
      // cousins qui ne sont pas dans l'arbre. C'est souvent la seule trace
      // qu'on ait d'eux : la cacher derrière « pas rattachée à des fiches »
      // revenait à jeter la moitié de la carte d'Hélène.
      occupants: p.occupants,
      residents: byPlace.get(p.id) ?? [],
      outside: p.outside,
      resume: p.resume,
      histoire: p.histoire,
      histoire_source: p.histoire_source,
    }));

  const elsewhere = (places ?? []).filter((p) => p.outside);

  return (
    <div>
      <header className="mb-5">
        <h1 className="serif text-2xl font-semibold">Qui habite où</h1>
        <p className="mt-1 text-muted">
          Les maisons de la famille. Touchez un point pour
          savoir qui s&apos;y trouve.
        </p>
        <Aide titre="Un point est au mauvais endroit">
          Touchez <strong>« Corriger les positions »</strong>, puis faites glisser
          le point : c&apos;est enregistré aussitôt. Les points entourés de
          pointillés viennent d&apos;un annuaire national qui place mal les fermes
          isolées — ce sont eux qu&apos;il faut regarder en premier. Les noms n&apos;apparaissent
          qu&apos;une fois la carte agrandie, sinon ils se chevauchent.
        </Aide>
      </header>

      <PlacesMap
        viser={Number.isInteger(viser) && viser > 0 ? viser : null}
        places={mapped}
        gens={(tous ?? []).map((p) => ({
          id: p.id,
          nom: fullName(p),
          placeId: p.place_id,
        }))}
      />

      {elsewhere.length > 0 && (
        <section className="mt-8">
          <h2 className="serif text-lg">Plus loin</h2>
          <p className="mt-1 text-sm text-muted">
            Elles sont sur la carte, hors du cadre de départ : reculez d&apos;un
            écartement de doigts pour les voir apparaître.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {elsewhere.map((p) => (
              <li key={p.id}>
                <span className="font-medium">{p.name}</span>
                {p.occupants && <span className="text-muted"> — {p.occupants}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-center text-sm text-muted">
        {BULLETIN ? <>Relevé sur la carte du bulletin <em>{BULLETIN}</em>.</> : <>Relevé par la famille.</>}{" "}
        <Link href="/" className="underline">
          Chercher quelqu&apos;un
        </Link>
      </p>
    </div>
  );
}
