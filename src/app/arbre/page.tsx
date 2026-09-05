import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import ArbreZoom from "@/components/ArbreZoom";
import { dessinerArbre, type Personne, type Union } from "@/lib/dessinArbre";
import { dessinerAscendance } from "@/lib/dessinAscendance";
import { toutCharger } from "@/lib/tout";
import { RACINE } from "@/lib/famille";

export const dynamic = "force-dynamic";

/**
 * L'arbre entier, d'un seul regard.
 *
 * Toutes les autres vues sont locales — une personne, ses parents, sa fratrie.
 * Ici on voit la FORME de la famille : les branches larges, les rameaux courts,
 * et où l'on se situe dans sept cents descendants. On arrive sur soi, on remonte.
 *
 * 🔑 La racine par défaut (`RACINE`, dans `famille.ts`) est l'ancêtre commun
 * des deux camps du duel. Partir de là, c'est montrer que les deux camps sont
 * un seul arbre.
 *
 * Le PREMIER dessin se fait ici, au serveur : la page arrive pleine, sans
 * attendre que le navigateur ait fini d'hydrater quoi que ce soit. Les
 * suivants — un pli, un dépli, l'arbre couché — se font chez le lecteur, avec
 * la même fonction (`lib/dessinArbre`), parce qu'un aller-retour au serveur à
 * chaque geste remettrait le zoom à zéro et rendrait l'exploration impossible.
 */

export default async function Arbre({
  searchParams,
}: {
  searchParams: Promise<{ racine?: string; vue?: string }>;
}) {
  const { racine, vue } = await searchParams;
  // Deux graphes différents, pas deux réglages du même : la descendance part
  // d'un aïeul et s'élargit vers le bas ; l'ascendance part d'une personne et
  // double à chaque génération vers le haut.
  const ancetres = vue === "ancetres";
  const supabase = await supabaseServer();

  const { data: member } = await supabase
    .from("members")
    .select("user_id, person_id")
    .maybeSingle();
  if (!member) redirect("/rejoindre");
  const moiId = member.person_id;

  // 🔑 Par tranches, et non d'un seul `select` : sans `range()`, PostgREST
  // s'arrête à mille lignes sans le dire, et l'arbre se dessinait sur un tiers
  // de la famille — branches entières manquantes, aucun message. Les unions
  // sont paginées aussi : les couples au-delà du millier disparaissaient, ce
  // qui coupe le graphe là où il devrait se rejoindre.
  const [gens, liens] = await Promise.all([
    toutCharger<Personne>((de, a) =>
      supabase
        .from("people")
        .select(
          "id, first_name, last_name, nickname, birth_year, death_year, deceased, father_id, mother_id, branch_id",
        )
        .order("id")
        .range(de, a),
    ),
    toutCharger<Union>((de, a) =>
      supabase.from("unions").select("p1_id, p2_id").order("id").range(de, a),
    ),
  ]);
  // En ascendance, on part de SOI par défaut : c'est la question qu'on se pose
  // — « d'où je viens ? ». En descendance, de l'aïeul commun.
  const parDefaut = ancetres ? (moiId ?? RACINE) : RACINE;
  const racineId =
    racine && gens.some((p) => p.id === racine) ? racine : parDefaut;

  const dessin = ancetres
    ? dessinerAscendance(gens, { racineId, moiId })
    : dessinerArbre(gens, liens, { racineId, moiId });
  const r = gens.find((p) => p.id === racineId);

  return (
    <div>
      <header className="mb-4">
        <h1 className="serif text-2xl font-semibold">
          {ancetres ? "D'où l'on vient" : "L'arbre entier"}
        </h1>
        <p className="mt-1 text-muted">
          {ancetres ? (
            <>
              Les {dessin.compte} aïeux de{" "}
              <strong>
                {r?.first_name} {r?.last_name}
              </strong>
              {r?.birth_year ? ` (${r.birth_year})` : ""}, sur douze
              générations. Chaque personne est posée entre son père et sa mère.{" "}
              <strong>Touchez un nom</strong> pour ouvrir sa fiche.
            </>
          ) : (
            <>
              Les {dessin.compte} descendants et conjoints de{" "}
              <strong>
                {r?.first_name} {r?.last_name}
              </strong>
              {r?.birth_year ? ` (${r.birth_year})` : ""}. Pincez ou molette
              pour zoomer, <strong>touchez un nom</strong> pour ouvrir sa fiche,
              la pastille sous une carte pour replier sa descendance.
            </>
          )}
        </p>

        {/* Les deux vues répondent à deux questions différentes : « qui
            descend de cet aïeul » et « d'où je viens ». Aucune ne remplace
            l'autre — les Montclar, Rozel et Steinberg, ancêtres par les
            femmes, n'existent QUE dans la seconde. */}
        <div className="mt-3 inline-flex rounded-lg border border-line p-0.5 text-sm">
          <Link
            href="/arbre"
            className={`rounded-md px-3 py-1.5 ${!ancetres ? "bg-accent-surface font-medium text-accent" : "text-muted"}`}
          >
            Descendance
          </Link>
          <Link
            href={`/arbre?vue=ancetres${racine ? `&racine=${racine}` : ""}`}
            className={`rounded-md px-3 py-1.5 ${ancetres ? "bg-accent-surface font-medium text-accent" : "text-muted"}`}
          >
            Mes ancêtres
          </Link>
        </div>

        {/* 🔑 Cet arbre dessine une DESCENDANCE : partir de la racine, c'est ne
            jamais voir ses ancêtres. Les cent quatre-vingt-cinq aïeux arrivés
            du GEDCOM — Montclar, Rozel, Valadier, la souche allemande — sont
            tous EN AMONT de lui, donc invisibles ici. Le seul moyen de les
            atteindre était de connaître le paramètre d'adresse : ces deux
            boutons le rendent visible. */}
        {/* Remonter la racine n'a de sens qu'en descendance : en ascendance,
            les aïeux sont déjà tous à l'écran. */}
        <div className={`mt-2 flex-wrap gap-2 text-sm ${ancetres ? "hidden" : "flex"}`}>
          {(() => {
            const parent = r?.father_id ?? r?.mother_id;
            const p = parent ? gens.find((x) => x.id === parent) : null;
            return p ? (
              <Link
                href={`/arbre?racine=${p.id}`}
                className="rounded-lg border border-accent-line bg-accent-surface px-3 py-1.5"
              >
                ↑ Remonter à {p.first_name} {p.last_name}
                {p.birth_year ? ` (${p.birth_year})` : ""}
              </Link>
            ) : null;
          })()}
          {racineId !== RACINE && (
            <Link href="/arbre" className="rounded-lg border border-line bg-card px-3 py-1.5">
              Revenir à la racine
            </Link>
          )}
        </div>
      </header>

      <ArbreZoom
        gens={gens}
        unions={liens}
        racineId={racineId}
        moiId={moiId}
        svg={dessin.svg}
        largeur={dessin.largeur}
        hauteur={dessin.hauteur}
        ascendance={ancetres}
        racineXY={dessin.racine}
        moiXY={(moiId && dessin.positions.get(moiId)) || null}
      />

      <p className="mt-3 text-sm text-muted">
        Chaque carte porte le liseré de sa branche. La descendance de la racine
        réunit les deux camps du duel.
      </p>
    </div>
  );
}
