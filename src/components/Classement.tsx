"use client";

import { useState } from "react";
import Link from "next/link";
import { deposerScore } from "@/app/quiz/actions";
import { couleurDe } from "@/lib/branches";
import Avatar from "@/components/Avatar";

export type Ligne = {
  pseudo: string;
  score: number;
  justes: number;
  total: number;
  played_at: string;
  a_moi: boolean;
  /** La fiche du joueur, quand il s'est rattaché. Null sinon : on ne devine pas. */
  person_id: string | null;
  /** Son emblème, s'il en a choisi un. Il se lit avant le nom. */
  emoji: string | null;
  /** Le chemin de son portrait dans le stockage — pas l'URL, voir `photos`. */
  photo_url: string | null;
  /** Jours de jeu d'affilée. La flamme ne s'affiche qu'à partir de deux. */
  serie: number;
};

export type LigneBranche = {
  branche: string;
  meilleur: number;
  joueurs: number;
  champion: string;
  /** La fiche du champion, quand il s'est rattaché. */
  champion_id: string | null;
};

export type LigneCamp = {
  camp: string;
  meilleur: number;
  joueurs: number;
  branches: number;
  champion: string;
  champion_id: string | null;
};

/**
 * Un blason par camp : il se lit avant le nom, comme un maillot.
 *
 * Deux maisons, deux toits. Le duel oppose le Moulin à la Bastide — les deux
 * maisons fondatrices de la famille — et non une maison à une région :
 * c'est sous ces noms-là que la famille se désigne.
 */
const BLASON: Record<string, string> = {
  Moulin: "🏰",
  "Bastide": "🏡",
};

const NOM = "arbre.pseudo";
const BRANCHE = "arbre.branche";


/**
 * Le classement, et le formulaire pour y entrer.
 *
 * Le nom est demandé une seule fois puis retenu sur l'appareil : personne ne
 * doit retaper « Camille » à chaque partie. Il n'est pas pré-rempli avec
 * l'adresse email — c'est le seul nom que la base connaisse, et l'écrire ici
 * reviendrait à la publier devant toute la famille.
 */
export default function Classement({
  lignes,
  branches,
  camps = [],
  photos = new Map(),
  nomsBranches,
  partie,
}: {
  lignes: Ligne[];
  branches: LigneBranche[];
  /** Les deux camps du duel. Vide tant qu'un seul a joué. */
  camps?: LigneCamp[];
  /** Chemin de stockage → URL signée, préparée par la page. */
  photos?: Map<string, string>;
  /** Les branches existantes, pour le choix au moment de s'inscrire. */
  nomsBranches: string[];
  /** Renseigné seulement au sortir d'une partie : c'est ce qu'on propose d'inscrire. */
  partie?: { score: number; justes: number; total: number };
}) {
  const [pseudo, setPseudo] = useState("");
  const [branche, setBranche] = useState("");
  const [etat, setEtat] = useState<"prêt" | "envoi" | "fait">("prêt");
  const [erreur, setErreur] = useState<string | null>(null);
  const [charge, setCharge] = useState(false);

  // Le stockage n'existe pas au rendu serveur : on le lit au premier rendu
  // client, une seule fois.
  if (!charge && typeof window !== "undefined") {
    setCharge(true);
    try {
      const garde = localStorage.getItem(NOM);
      if (garde) setPseudo(garde);
      const b = localStorage.getItem(BRANCHE);
      if (b) setBranche(b);
    } catch {
      /* navigation privée : on demandera le nom, voilà tout */
    }
  }

  async function envoyer(formData: FormData) {
    setEtat("envoi");
    setErreur(null);
    const r = await deposerScore(formData);
    if (r?.error) {
      setErreur(r.error);
      setEtat("prêt");
      return;
    }
    try {
      localStorage.setItem(NOM, String(formData.get("pseudo") ?? ""));
      localStorage.setItem(BRANCHE, String(formData.get("branche") ?? ""));
    } catch {
      /* rien à faire */
    }
    setEtat("fait");
  }

  return (
    <section>
      <h2 className="serif text-lg font-semibold">Les meilleurs</h2>

      {partie && etat !== "fait" && (
        <form action={envoyer} className="mt-3 rounded-lg border border-accent-line bg-accent-surface px-3 py-3">
          <label className="block text-sm font-medium" htmlFor="pseudo">
            Inscrire ces {partie.score} points au classement
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="pseudo"
              name="pseudo"
              required
              maxLength={24}
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              placeholder="Votre prénom"
              autoComplete="nickname"
              className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-base outline-none focus:border-accent"
            />
            <input type="hidden" name="score" value={partie.score} />
            <input type="hidden" name="justes" value={partie.justes} />
            <input type="hidden" name="total" value={partie.total} />
            <button
              type="submit"
              disabled={etat === "envoi"}
              className="shrink-0 rounded-lg bg-accent px-4 py-2 font-medium text-sur-plein disabled:opacity-50"
            >
              {etat === "envoi" ? "…" : "Entrer"}
            </button>
          </div>

          {/* La branche fait courir la famille bien plus que le score personnel :
              on ne joue plus pour soi, on joue pour les siens. */}
          <label className="mt-2 block text-sm" htmlFor="branche">
            <span className="font-medium">Pour quelle branche jouez-vous ?</span>
            <select
              id="branche"
              name="branche"
              value={branche}
              onChange={(e) => setBranche(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line bg-card px-3 py-2 text-base outline-none focus:border-accent"
            >
              <option value="">— aucune, je joue pour moi —</option>
              {nomsBranches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <p className="mt-1.5 text-xs text-muted">
            Le nom que vous choisissez ici, pas votre adresse.
          </p>
          {erreur && <p className="mt-1.5 text-sm text-accent">{erreur}</p>}
        </form>
      )}

      {etat === "fait" && (
        <p className="mt-3 rounded-lg border border-acquis bg-acquis-surface px-3 py-2 text-sm">
          C&apos;est inscrit. Rechargez pour vous voir apparaître.
        </p>
      )}

      {/* Les branches d'abord : c'est le tableau qu'on vient regarder. Le
          classement individuel vient après, il intéresse surtout celui qui
          s'y trouve. */}
      {branches.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2.5 text-xs uppercase tracking-wide text-muted">
            Par branche
          </h3>
          <ol className="space-y-2">
            {branches.map((b, i) => (
              <li
                key={b.branche}
                className="relative flex items-baseline gap-3 overflow-hidden rounded-lg border border-line bg-card py-2.5 pl-4 pr-3"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1.5"
                  style={{ background: couleurDe(b.branche) ?? "var(--line)" }}
                />
                <span className="serif w-5 shrink-0 text-right text-lg tabular-nums text-muted">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{b.branche}</span>
                  <span className="block text-xs text-muted">
                    meilleur :{" "}
                    {b.champion_id ? (
                      <Link
                        href={`/personne/${b.champion_id}`}
                        className="underline decoration-dotted underline-offset-4"
                      >
                        {b.champion}
                      </Link>
                    ) : (
                      b.champion
                    )}{" "}
                    · {b.joueurs}{" "}
                    {b.joueurs > 1 ? "joueurs" : "joueur"}
                  </span>
                </span>
                <span className="serif shrink-0 font-semibold tabular-nums">
                  {b.meilleur}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Le duel, SOUS le détail par branche.
          Neuf branches dont plusieurs à un ou deux joueurs : chacun mène sa
          propre ligne, et personne ne se sent en compétition. Deux camps, c'est
          la forme d'un duel — et un duel, ça se raconte à table.

          Le partage n'est pas inventé : c'est celui que le quiz énonce déjà
          dans ses indices. Six branches descendent des enfants d'Henry
          Vernet et Blanche Delcourt ; Chastel, Morel et Lanvin sont
          les cousins du Lot-et-Garonne.

          Masqué tant qu'un seul camp a joué : annoncer un duel où personne ne
          s'oppose ne fait pas envie, ça fait vide. */}
      {camps.length > 1 && (
        <div className="mt-8">
          <h3 className="mb-2.5 text-xs uppercase tracking-wide text-muted">Le duel</h3>
          <ol className="space-y-2">
            {camps.map((c, i) => (
              <li
                key={c.camp}
                className={`flex items-center gap-3 rounded-xl border px-3 py-3.5 ${
                  i === 0 ? "border-accent-line bg-accent-surface" : "border-line bg-card"
                }`}
              >
                <span aria-hidden className="shrink-0 text-2xl">
                  {BLASON[c.camp] ?? "🏅"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{c.camp}</span>
                  <span className="block text-sm text-muted">
                    meilleur :{" "}
                    {c.champion_id ? (
                      <Link
                        href={`/personne/${c.champion_id}`}
                        className="underline decoration-dotted underline-offset-4"
                      >
                        {c.champion}
                      </Link>
                    ) : (
                      c.champion
                    )}{" "}
                    · {c.branches} branche{c.branches > 1 ? "s" : ""} · {c.joueurs}{" "}
                    {c.joueurs > 1 ? "joueurs" : "joueur"}
                  </span>
                </span>
                <span className="serif shrink-0 font-semibold tabular-nums">
                  {c.meilleur}
                </span>
              </li>
            ))}
          </ol>
          {/* L'écart, dit en toutes lettres. C'est lui qu'on retient et qu'on
              répète — « il leur manque 743 points » appelle une revanche là où
              deux nombres côte à côte n'appellent rien. */}
          <p className="mt-2 text-sm text-muted">
            {camps[0].meilleur - camps[1].meilleur === 0 ? (
              <>Les deux camps sont à égalité parfaite.</>
            ) : (
              <>
                <strong>{camps[0].camp}</strong> mène de{" "}
                {camps[0].meilleur - camps[1].meilleur} points.
              </>
            )}
            {/* Le duel se joue au MEILLEUR score, pas au nombre de joueurs :
                un camp d'une personne peut gagner. Mais afficher « 1 joueur »
                en face de « 14 » souligne une solitude au lieu d'appeler du
                renfort — et c'est précisément la personne qui vient d'écrire
                « ce n'est pas drôle si ce n'est pas pour tout le monde ».

                La phrase ne s'affiche que sous trois joueurs, et elle dit
                quoi faire. Le déséquilibre devient une place à prendre. */}
            {camps[1].joueurs < 3 && (
              <>
                {" "}
                {/* Le verbe s'accorde avec le NOM DU CAMP, pas avec le nombre
                    de joueurs : « Les cousins du Lot » est pluriel même s'ils
                    ne sont qu'un à jouer. La première version écrivait « Les
                    cousins du Lot n'a que un joueur » — deux fautes dans une
                    phrase de dix mots, sur un site que lisent des gens qui
                    écrivent encore à la main. */}
                {camps[1].camp} n&apos;
                {camps[1].camp.startsWith("Les ") ? "ont" : "a"}{" "}
                {camps[1].joueurs === 1
                  ? "qu'un joueur"
                  : `que ${camps[1].joueurs} joueurs`}{" "}
                — il y a une place à prendre de ce côté-là.
              </>
            )}
          </p>
        </div>
      )}

      <h3 className="mb-2.5 mt-8 text-xs uppercase tracking-wide text-muted">
        Individuel
      </h3>
      {lignes.length === 0 ? (
        <p className="mt-3 text-muted">
          Personne n&apos;a encore inscrit de score. La place est à prendre.
        </p>
      ) : (
        <ol className="mt-3.5 space-y-2">
          {/* 🔑 « C'est quoi les 🔥 ? » — la seule explication était une
              infobulle `title`, qui n'existe pas au doigt : sur un téléphone,
              personne ne l'a jamais lue. Un symbole que rien ne présente n'est
              pas un jeu, c'est une énigme. La légende ne s'affiche que s'il y a
              au moins une flamme à expliquer. */}
          {lignes.some((l) => l.serie >= 2) && (
            <li className="mb-1 text-xs text-muted">
              🔥 = nombre de jours de suite où la personne a joué. Elle
              s&apos;éteint si l&apos;on saute un jour.
            </li>
          )}
          {lignes.map((l, i) => (
            <li
              key={`${l.pseudo}-${l.played_at}`}
              className={`flex items-baseline gap-3 rounded-lg border px-3 py-2.5 ${
                l.a_moi ? "border-accent-line bg-accent-surface" : "border-line bg-card"
              }`}
            >
              <span className="serif w-6 shrink-0 text-right text-lg tabular-nums text-muted">
                {i + 1}
              </span>
              {/* Le visage avant le nom : sur vingt lignes, c'est ce qui fait
                  repérer sa cousine Claire Declety sans lire chaque pseudo.
                  L'initiale prend le relais pour qui n'a pas encore de photo —
                  jamais un trou, jamais une case vide. */}
              <Avatar
                src={l.photo_url ? photos.get(l.photo_url) : null}
                name={l.pseudo}
                size={32}
              />
              {/* « Oscar 2862 » ne disait pas QUEL Oscar. On lit un classement
                  pour savoir qui sont les autres — c'est souvent la première
                  fois qu'on croise un prénom, et c'était le seul écran où un
                  nom de la famille ne menait nulle part.

                  Le pseudo reste ce qui s'affiche : c'est le nom que le joueur
                  a choisi, le remplacer par son état civil trahirait ce choix.
                  Et pas de lien pour qui ne s'est pas rattaché : on ne devine
                  pas une fiche à partir d'un prénom. */}
              {l.person_id ? (
                <Link
                  href={`/personne/${l.person_id}`}
                  className="min-w-0 flex-1 truncate underline decoration-dotted underline-offset-4"
                >
                  {l.emoji && <span aria-hidden className="mr-1">{l.emoji}</span>}
                  {l.pseudo}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate">
                  {l.emoji && <span aria-hidden className="mr-1">{l.emoji}</span>}
                  {l.pseudo}
                </span>
              )}
              {/* La flamme à partir de DEUX jours : « 🔥 1 » décorerait tout
                  le monde et ne distinguerait personne. Elle se place avant le
                  score — c'est elle qu'on vient comparer en revenant. */}
              {l.serie >= 2 && (
                <span className="shrink-0 text-xs tabular-nums" title={`${l.serie} jours d'affilée`}>
                  🔥{l.serie}
                </span>
              )}
              <span className="shrink-0 text-xs text-muted tabular-nums">
                {l.justes}/{l.total}
              </span>
              <span className="serif shrink-0 font-semibold tabular-nums">
                {l.score}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
