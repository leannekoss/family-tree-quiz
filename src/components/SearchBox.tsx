"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { signedPhotos } from "@/lib/photos";
import Avatar from "@/components/Avatar";
import { fullName, ageLisible, type SearchHit } from "@/lib/types";

/** Sans accents ni ponctuation, pour une recherche tolérante. */
const nu = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");

export default function SearchBox() {
  // Une recherche peut arriver toute faite dans l'adresse : « voir toutes les
  // Amélie » depuis la page des chiffres, ou un lien envoyé par quelqu'un.
  // La valeur initiale se lit au premier rendu, jamais dans un effet : poser
  // l'état après coup ferait un rendu vide suivi d'un second, et le champ
  // clignoterait sous les yeux.
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [maisons, setMaisons] = useState<Maison[]>([]);
  const [photos, setPhotos] = useState<Map<string, string>>(new Map());
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Chercher au-delà de l'arbre, dans le relevé FamilySearch : trois cents
  // personnes que la famille n'a jamais nommées — banquiers genevois, barons
  // prussiens, cousins américains. Les verser dans l'arbre noierait la
  // recherche et doublerait les visages manquants ; les cacher tout à fait
  // reviendrait à perdre le travail. D'où la case, décochée par défaut.
  const [ailleurs, setAilleurs] = useState(false);
  const [lointains, setLointains] = useState<Lointain[]>([]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLointains([]);
      setError(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      const supabase = supabaseBrowser();
      // Les deux recherches partent ensemble : attendre l'une pour lancer
      // l'autre doublerait le temps avant que la liste s'affiche.
      const [{ data, error }, { data: lieux }, { data: loin }] = await Promise.all([
        supabase.rpc("search_people", { q: term }),
        supabase.rpc("search_places", { q: term }),
        // Le relevé n'est interrogé que si la case est cochée : sinon on paie
        // une requête pour un résultat que personne ne verra.
        ailleurs
          ? supabase.rpc("chercher_ailleurs", { q: term })
          : Promise.resolve({ data: [] as Lointain[] }),
      ]);
      if (cancelled) return;
      setSearching(false);

      if (error) {
        setError(error.message);
        setHits([]);
        setMaisons([]);
        return;
      }

      setError(null);
      setHits(data ?? []);
      setMaisons(lieux ?? []);
      setLointains((loin ?? []) as Lointain[]);
      // Les liens signés arrivent après la liste : les noms s'affichent tout de
      // suite, les visages se posent ensuite.
      const urls = await signedPhotos(supabase, (data ?? []).map((d) => d.photo_url), { petit: true });
      if (!cancelled) setPhotos(urls);
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, ailleurs]);

  return (
    <div>
      <input
        type="search"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        // Les maisons sont cherchables depuis qu'elles ont rejoint la
        // recherche, mais rien ne le disait : une possibilité qu'on ignore
        // n'existe pas. « La Prade », « La Borie », « Le Colombier » sont des
        // mots qu'on entend à table et qui sont parfois tout ce dont on se
        // souvient — c'est même souvent par là qu'on retrouve une personne.
        placeholder="Un prénom, un nom, une maison…"
        className="w-full rounded-xl border border-line bg-card px-4 py-3.5 text-lg outline-none focus:border-accent"
      />

      {error && <p className="mt-4 text-sm text-accent">{error}</p>}

      {/* Le seul habitant de Monflanquin qui ne soit pas dans l'arbre. Posé
          au-dessus des résultats et jamais à leur place : un clin d'œil qui
          gênerait cesserait d'en être un. */}

      {q.trim().length >= 2 && (
        <label className="mt-3 flex min-h-11 items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={ailleurs}
            onChange={(e) => setAilleurs(e.target.checked)}
            className="size-4"
          />
          Chercher aussi hors de l&apos;arbre, chez nos aïeux lointains
        </label>
      )}

      {!error &&
        q.trim().length >= 2 &&
        hits.length === 0 &&
        maisons.length === 0 &&
        !searching &&
        (
          <div className="mt-6">
            <p className="text-sm text-muted">
              Rien de ce nom dans l&apos;arbre pour l&apos;instant — ni personne, ni maison.
            </p>
            {/* Le seul endroit où proposer de créer quelqu'un : celui où l'on
                vient de constater qu'il manque. Le contrôle des doublons y est
                déjà fait — la recherche vient d'avoir lieu — et le nom tapé
                suit dans l'adresse pour ne pas le redemander. */}
            <Link
              href={`/ajouter?nom=${encodeURIComponent(q.trim())}`}
              className="mt-3 inline-block rounded-lg border border-accent bg-accent px-4 py-2.5 text-sm text-sur-plein"
            >
              Ajouter {q.trim()} à l&apos;arbre
            </Link>
          </div>
        )}

      <ul className="mt-4 divide-y divide-line">
        {hits.map((h) => (
          <li key={h.id}>
            <Link
              href={`/personne/${h.id}`}
              className="flex items-center gap-3 py-3"
            >
              <Avatar
                src={h.photo_url ? photos.get(h.photo_url) : null}
                name={h.first_name}
              />
              <span className="serif min-w-0 flex-1 text-lg">
                {fullName(h)}
                {h.deceased && <span className="text-muted"> †</span>}
              </span>
              <span className="shrink-0 text-right text-sm text-muted">
                {h.birth_display}
                {ageLisible(h) && <span className="block">{ageLisible(h)}</span>}
                {h.branch_name && (
                  <span className="block text-xs">{h.branch_name}</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {/* Les maisons après les personnes : on cherche d'abord quelqu'un. Mais
          elles portent des noms qu'on entend à table — La Prade, Le Colombier — et
          qui sont parfois tout ce dont on se souvient. La recherche les
          ignorait, alors qu'elles sont la moitié de ce que le site contient. */}
      {lointains.length > 0 && (
        <>
          <h2 className="mt-6 text-xs uppercase tracking-wide text-muted">
            Relevé sur FamilySearch — pas dans l&apos;arbre
          </h2>
          <p className="mb-2 mt-1 text-xs text-muted">
            Des branches que la famille n&apos;a jamais suivies : banquiers
            genevois, cousins d&apos;Alsace et d&apos;Amérique. Ils ne sont pas
            dans l&apos;arbre, et n&apos;entrent ni dans le quiz ni dans la
            chasse aux visages.
          </p>
          <ul className="divide-y divide-line">
            {lointains.map((l) => (
              <li key={l.pid} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{l.nom_complet}</span>
                  {l.deja_id && (
                    <Link
                      href={`/personne/${l.deja_id}`}
                      className="text-xs text-accent underline underline-offset-4"
                    >
                      déjà dans l&apos;arbre — voir sa fiche
                    </Link>
                  )}
                </span>
                <span className="shrink-0 text-right text-sm text-muted">
                  {l.ne ?? "?"}
                  {l.mort ? `–${l.mort}` : ""}
                  <a
                    href={`https://ancestors.familysearch.org/fr/${l.pid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs underline underline-offset-4"
                  >
                    {l.pid}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {maisons.length > 0 && (
        <>
          <h2 className="mt-6 text-xs uppercase tracking-wide text-muted">
            {maisons.length > 1 ? "Maisons" : "Une maison"}
          </h2>
          <ul className="divide-y divide-line">
            {maisons.map((m) => (
              <li key={m.id}>
                {/* L'identifiant voyage dans l'adresse. Le lien menait à
                    « /lieux » tout court : chercher « La Borie » ouvrait la
                    carte des trente maisons, à charge pour le lecteur de
                    retrouver la sienne au milieu. Un résultat de recherche doit
                    mener à CE qu'on a cherché, pas à la page qui le contient. */}
                <Link
                  href={`/lieux?maison=${m.id}`}
                  className="flex items-center gap-3 py-3"
                >
                  <span aria-hidden className="text-xl">🏡</span>
                  <span className="min-w-0 flex-1">
                    <span className="serif block text-lg">{m.name}</span>
                    {/* Le relevé du bulletin plutôt que le compte de fiches :
                        pour dix-sept maisons sur trente, ces noms-là sont la
                        seule trace qu'on ait de leurs habitants. */}
                    {(m.occupants || m.habitants > 0) && (
                      <span className="block truncate text-sm text-muted">
                        {m.occupants ||
                          `${m.habitants} personne${m.habitants > 1 ? "s" : ""} rattachée${m.habitants > 1 ? "s" : ""}`}
                      </span>
                    )}
                  </span>
                  {m.commune && (
                    <span className="shrink-0 text-sm text-muted">{m.commune}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type Lointain = {
  pid: string;
  nom_complet: string;
  ne: number | null;
  mort: number | null;
  sexe: string | null;
  deja_id: string | null;
};

type Maison = {
  id: number;
  name: string;
  commune: string | null;
  occupants: string | null;
  habitants: number;
  score: number;
};
