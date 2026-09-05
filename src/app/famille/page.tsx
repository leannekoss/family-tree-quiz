// @ts-nocheck
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
type Stats = Record<string, unknown>;
import FilAriane from "@/components/FilAriane";
import { SOUS_TITRE } from "@/lib/famille";

export const dynamic = "force-dynamic";

const MOIS = [
  "janv.", "févr.", "mars", "avril", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

/**
 * La famille en chiffres — et ce que la fidélité ouvre.
 *
 * 🔑 Rien de ce qui existait n'est passé derrière un cadenas. Les fiches, les
 * photos, les histoires des maisons restent à tout le monde, tout le temps :
 * c'est le patrimoine de la famille, pas une récompense, et reprendre ce qui a
 * été donné hier se lit comme une panne, jamais comme un jeu. Ce qui s'ouvre
 * ici est entièrement NEUF — des regards sur les données, du plaisir en plus.
 *
 * Et les cadenas se voient : une carte verrouillée annonce ce qu'elle contient
 * et ce qu'il reste à faire. Un cadenas muet ne donne envie de rien.
 */
export default async function Famille() {
  const supabase = await supabaseServer();

  const { data: member } = await supabase.from("members").select("user_id").maybeSingle();
  if (!member) redirect("/rejoindre");

  const [{ data: niveaux }, { data: brut }] = await Promise.all([
    supabase.rpc("mon_niveau"),
    supabase.rpc("stats_famille"),
  ]);

  const n = niveaux?.[0];
  const s = (brut ?? { niveau: 0 }) as Stats;
  const niveau = n?.niveau ?? 0;
  const part = n?.prochain ? Math.min(100, Math.round((n.points / n.prochain) * 100)) : 100;

  return (
    <div className="pb-10">
      <FilAriane etapes={[{ label: "Chercher", href: "/" }, { label: "La famille en chiffres" }]} />

      <header className="mb-5">
        <h1 className="serif text-2xl font-semibold">La famille en chiffres</h1>
        <p className="mt-1 text-muted">
          Cinq curiosités sur les {s.compte?.personnes ?? "sept cents"} personnes de
          l&apos;arbre. Elles s&apos;ouvrent au fil de vos visites — et rien de ce
          qui était déjà là ne s&apos;est fermé.
        </p>
        {/* Le périmètre, dit à l'écran. Sans cette phrase, un lecteur qui sait
            l'arbre remonté au XVIᵉ siècle croit les chiffres faux ; avec elle,
            il comprend qu'ils portent sur la famille dont on parle à table.
            Une statistique sans son périmètre est une statistique fausse. */}
        {s.compte?.aieux ? (
          <p className="mt-2 text-sm text-muted">
            Ces chiffres portent sur {SOUS_TITRE}. Les{" "}
            <strong>{s.compte.aieux} aïeux plus anciens</strong> n&apos;y sont pas
            comptés&nbsp;: un prénom porté dix-sept fois au XVI<sup>e</sup> siècle
            ne dit rien de la famille d&apos;aujourd&apos;hui. On les retrouve depuis les fiches et
            sur l&apos;arbre.
          </p>
        ) : null}
      </header>

      {/* Le compteur en tête : où j'en suis, et ce qui m'ouvrira la suite. Sans
          cette ligne, on ne saurait pas pourquoi une carte est fermée. */}
      <section className="mb-8 rounded-xl border border-accent-line bg-accent-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="serif text-lg">
            Niveau {niveau} · <strong>{n?.titre ?? "Nouveau venu"}</strong>
          </p>
          <p className="text-sm text-muted">{n?.points ?? 0} points</p>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-card">
          <div className="h-full rounded-full bg-accent" style={{ width: `${part}%` }} />
        </div>
        <p className="mt-2 text-sm">
          {n?.prochain ? (
            <>
              Encore <strong>{n.restant} points</strong> pour devenir{" "}
              <strong>{n.titre_prochain}</strong>.
            </>
          ) : (
            <>Vous avez tout ouvert. Il reste à faire vivre l&apos;arbre.</>
          )}
        </p>
        <p className="mt-2 text-sm text-muted">
          {[
            n?.jours ? `${n.jours} jour${n.jours > 1 ? "s" : ""} de passage` : null,
            n?.parties ? `${n.parties} partie${n.parties > 1 ? "s" : ""}` : null,
            n?.photos ? `${n.photos} photo${n.photos > 1 ? "s" : ""}` : null,
            n?.fiches ? `${n.fiches} fiche${n.fiches > 1 ? "s" : ""} créée${n.fiches > 1 ? "s" : ""}` : null,
            n?.corrections ? `${n.corrections} correction${n.corrections > 1 ? "s" : ""}` : null,
            n?.histoires ? `${n.histoires} histoire${n.histoires > 1 ? "s" : ""}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Jouez une partie, ajoutez une photo : tout compte."}
        </p>
        {/* Les points s'obtiennent en clair : une règle cachée n'entraîne
            personne, et celle-ci récompense d'abord de REVENIR. */}
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-accent">Comment gagne-t-on des points ?</summary>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>10 points par jour où vous passez, quoi que vous fassiez</li>
            <li>5 points par partie de quiz — le score n&apos;entre pas en compte</li>
            <li>10 points par photo ajoutée, 10 par fiche créée</li>
            <li>5 points par correction, 20 pour l&apos;histoire d&apos;une maison</li>
          </ul>
        </details>
      </section>

      <div className="space-y-4">
        <Carte titre="Le compte" niveau={1} atteint={niveau} seuil={10} points={n?.points ?? 0}
          appat="Combien sommes-nous, dans combien de maisons, sur combien de branches ?">
          {s.compte && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Chiffre n={s.compte.personnes} quoi="personnes" />
                <Chiffre n={s.compte.vivants} quoi="vivants aujourd'hui" />
                <Chiffre n={s.compte.photos} quoi="visages retrouvés" />
                <Chiffre n={s.compte.maisons} quoi="maisons" />
                <Chiffre n={s.compte.branches} quoi="branches" />
                <Chiffre n={s.compte.membres} quoi="inscrits au site" />
              </div>
              {/* Deux pages qui comptent des photos doivent dire laquelle
                  compte quoi, sinon l'écart passe pour une erreur : ici
                  l'arbre ENTIER, là-bas seulement ce qu'il reste à trouver. */}
              <p className="mt-3 text-xs text-muted">
                L&apos;arbre entier, collatéraux compris. La page des photos, elle,
                ne compte que les fiches où un visage manque encore.
              </p>
            </>
          )}
        </Carte>

        <Carte titre="Les âges" niveau={2} atteint={niveau} seuil={60} points={n?.points ?? 0}
          appat="Qui est le doyen de la famille ? Quelle a été la plus longue vie de l'arbre ?">
          {s.ages && (
            <dl className="space-y-2 text-sm">
              {s.ages.doyen && (
                <Ligne quoi="Doyen·ne">
                  <Fiche id={s.ages.doyen.id} nom={s.ages.doyen.nom} /> — né·e en {s.ages.doyen.annee}
                </Ligne>
              )}
              {s.ages.benjamin && (
                <Ligne quoi="Le ou la plus jeune">
                  <Fiche id={s.ages.benjamin.id} nom={s.ages.benjamin.nom} /> — {s.ages.benjamin.annee}
                </Ligne>
              )}
              {s.ages.moyenne && <Ligne quoi="Âge moyen des vivants">{s.ages.moyenne} ans</Ligne>}
              <Ligne quoi="Par tranche d'âge">
                <Link href="/ages" className="underline underline-offset-4">
                  qui a quel âge, des enfants aux aînés
                </Link>
              </Ligne>
              {s.ages.plus_longue_vie && (
                <Ligne quoi="La plus longue vie">
                  <Fiche id={s.ages.plus_longue_vie.id} nom={s.ages.plus_longue_vie.nom} /> —{" "}
                  {s.ages.plus_longue_vie.ans} ans
                </Ligne>
              )}
            </dl>
          )}
        </Carte>

        <Carte titre="Les prénoms" niveau={3} atteint={niveau} seuil={150} points={n?.points ?? 0}
          appat="Les prénoms les plus donnés, ceux qu'on ne donne plus, et celui qui traverse le plus de générations.">
          {s.prenoms && (
            <div className="space-y-3 text-sm">
              {s.prenoms.donnes && (
                <div className="flex flex-wrap gap-1.5">
                  {/* Chaque prénom mène à la liste de ceux qui le portent :
                      « Amélie ×6 » appelle la question « lesquelles ? », et
                      sans lien on la laissait sans réponse. */}
                  {s.prenoms.donnes.map((p) => (
                    <Link
                      key={p.prenom}
                      href={`/?q=${encodeURIComponent(p.prenom)}`}
                      className="inline-flex min-h-11 items-center rounded-full border border-line px-3"
                    >
                      {p.prenom} <span className="ml-1 text-muted">×{p.n}</span>
                    </Link>
                  ))}
                </div>
              )}
              {s.prenoms.traversant && (
                <p>
                  <Link
                    href={`/?q=${encodeURIComponent(s.prenoms.traversant.prenom)}`}
                    className="font-semibold underline underline-offset-4"
                  >
                    {s.prenoms.traversant.prenom}
                  </Link>{" "}
                  traverse la famille de{" "}
                  {s.prenoms.traversant.de} à {s.prenoms.traversant.a}, porté{" "}
                  {s.prenoms.traversant.n} fois.
                </p>
              )}
              {s.prenoms.disparus && s.prenoms.disparus.length > 0 && (
                <p className="text-muted">
                  Plus donnés depuis 1950 :{" "}
                  {s.prenoms.disparus.map((p, i) => (
                    <span key={p}>
                      {i > 0 && ", "}
                      <Link href={`/?q=${encodeURIComponent(p)}`} className="underline underline-offset-4">
                        {p}
                      </Link>
                    </span>
                  ))}
                  .
                </p>
              )}
            </div>
          )}
        </Carte>

        <Carte titre="Le calendrier" niveau={4} atteint={niveau} seuil={400} points={n?.points ?? 0}
          appat="Le mois où l'on naît le plus dans la famille, et qui partage son anniversaire avec qui.">
          {s.calendrier && (
            <div className="space-y-4 text-sm">
              {s.calendrier.mois && (
                <div className="flex items-end gap-1">
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = s.calendrier!.mois!.find((x) => x.mois === i + 1);
                    const max = Math.max(...s.calendrier!.mois!.map((x) => x.n));
                    return (
                      <div key={i} className="flex-1 text-center">
                        <div
                          className="mx-auto w-full rounded-t bg-accent"
                          style={{ height: `${Math.max(3, ((m?.n ?? 0) / max) * 64)}px` }}
                          title={`${m?.n ?? 0} naissances`}
                        />
                        <span className="mt-1 block text-[0.65rem] text-muted">{MOIS[i]}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {s.calendrier.memes_jours && (
                <ul className="space-y-1">
                  {s.calendrier.memes_jours.map((j) => (
                    <li key={j.jour}>
                      <strong>{j.jour}</strong> — {j.gens.join(", ")}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Carte>

        <Carte titre="Les records" niveau={5} atteint={niveau} seuil={1000} points={n?.points ?? 0}
          appat="La plus grande fratrie, la lignée la plus profonde, la maison la plus peuplée.">
          {s.records && (
            <dl className="space-y-2 text-sm">
              {s.records.fratrie && (
                <Ligne quoi="La plus grande fratrie">
                  {s.records.fratrie.n} enfants — {s.records.fratrie.pere ?? "?"} et{" "}
                  {s.records.fratrie.mere ?? "?"}
                </Ligne>
              )}
              {s.records.lignee && (
                <Ligne quoi="La lignée la plus profonde">
                  {s.records.lignee.n} générations, jusqu&apos;à {s.records.lignee.nom}
                </Ligne>
              )}
              {s.records.petits_enfants && (
                <Ligne quoi="Le plus de petits-enfants">
                  {s.records.petits_enfants.nom} — {s.records.petits_enfants.n}
                </Ligne>
              )}
              {s.records.maison && (
                <Ligne quoi="La maison la plus peuplée">
                  {s.records.maison.nom} — {s.records.maison.n} personnes
                </Ligne>
              )}
            </dl>
          )}
        </Carte>
      </div>

      <p className="mt-8 text-sm text-muted">
        Ces chiffres se recalculent à chaque visite : une fiche corrigée, une
        date retrouvée, et ils changent.{" "}
        <Link href="/photos" className="underline underline-offset-4">
          Ajouter une photo
        </Link>{" "}
        ou{" "}
        <Link href="/quiz" className="underline underline-offset-4">
          jouer une partie
        </Link>{" "}
        fait monter votre niveau.
      </p>
    </div>
  );
}

function Carte({
  titre,
  niveau,
  atteint,
  seuil,
  points,
  appat,
  children,
}: {
  titre: string;
  niveau: number;
  atteint: number;
  seuil: number;
  points: number;
  appat: string;
  children: React.ReactNode;
}) {
  const ouvert = atteint >= niveau;
  return (
    <section
      className={`rounded-xl border p-4 ${ouvert ? "border-line bg-card" : "border-dashed border-line bg-transparent"}`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="serif text-lg">
          {!ouvert && <span aria-hidden className="mr-1.5">🔒</span>}
          {titre}
        </h2>
        <span className="shrink-0 text-xs text-muted">niveau {niveau}</span>
      </div>
      {ouvert ? (
        children
      ) : (
        <div className="text-sm text-muted">
          <p>{appat}</p>
          <p className="mt-1.5">
            S&apos;ouvre à {seuil} points — il vous en manque{" "}
            <strong className="text-accent">{seuil - points}</strong>.
          </p>
        </div>
      )}
    </section>
  );
}

const Chiffre = ({ n, quoi }: { n: number; quoi: string }) => (
  <div className="rounded-lg border border-line p-3 text-center">
    <span className="serif block text-2xl font-semibold">{n}</span>
    <span className="text-xs text-muted">{quoi}</span>
  </div>
);

const Ligne = ({ quoi, children }: { quoi: string; children: React.ReactNode }) => (
  <div className="flex flex-wrap gap-x-2 border-b border-line pb-2 last:border-0">
    <dt className="text-muted">{quoi}</dt>
    <dd>{children}</dd>
  </div>
);

const Fiche = ({ id, nom }: { id: string; nom: string }) => (
  <Link href={`/personne/${id}`} className="underline underline-offset-4">
    {nom}
  </Link>
);
