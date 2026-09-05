"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { signedPhotos } from "@/lib/photos";
import Avatar from "@/components/Avatar";

/**
 * Le podium, et ses titres de la couronne.
 *
 * « 1er, 2e, 3e » n'appelle personne. Un titre, si — surtout quand il vient
 * de la famille : « Couronne d'or » se répète à table, « premier au
 * classement » non.
 *
 * 🔑 Les titres ne s'accordent pas en genre, et c'est délibéré : « maître » ou
 * « maîtresse » de la couronne obligerait à connaître le sexe de chaque
 * joueur, que le classement ne demande pas. Une couronne n'a pas de genre ; la
 * médaille reste lisible.
 */
const TITRES = [
  { emoji: "🥇", titre: "Couronne d'or", quoi: "la seule qui compte" },
  { emoji: "🥈", titre: "Sceptre d'argent", quoi: "il fallait bien un deuxième" },
  { emoji: "🥉", titre: "Orbe de bronze", quoi: "elle se mérite" },
];

/**
 * Le champion du jour, à côté de ceux de toujours et jamais à leur place.
 *
 * Les trois médailles sont hors d'atteinte — Anna mène depuis le 11 août — et
 * un podium qu'on ne peut plus gagner cesse d'appeler. Le chasselas, lui, se
 * remet en jeu chaque matin : c'est la seule ligne que le joueur d'aujourd'hui
 * peut espérer prendre avant ce soir.
 *
 * Un raisin plutôt qu'une quatrième médaille : la distinction doit se voir
 * d'un coup d'œil, sinon on la lit comme un quatrième rang — c'est-à-dire comme
 * une place de perdant.
 */
const DU_JOUR = { emoji: "🍇", titre: "Chasselas du jour", quoi: "remis en jeu demain matin" };

type Rang = {
  pseudo: string;
  score: number;
  person_id: string | null;
  a_moi: boolean;
  emoji: string | null;
};

export default function Podium({ compact = false }: { compact?: boolean }) {
  const [rangs, setRangs] = useState<Rang[]>([]);
  const [dujour, setDuJour] = useState<Rang | null>(null);
  const [photos, setPhotos] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let annule = false;
    (async () => {
      const supabase = supabaseBrowser();
      // Les deux classements partent ensemble : celui de toujours et celui du
      // jour se lisent d'un seul regard, ils doivent arriver de même.
      const [{ data }, { data: jour }] = await Promise.all([
        supabase.rpc("classement", { combien: 3 }),
        supabase.rpc("classement_du_jour", { combien: 1 }),
      ]);
      if (annule || !data) return;
      setRangs(data as Rang[]);
      setDuJour((jour?.[0] as Rang) ?? null);

      // Les trois visages, pas seulement celui du champion. L'argument
      // d'origine — « trois portraits se disputeraient la vedette » — se
      // retourne : un podium où seul le premier a une figure fait des deux
      // autres des figurants, alors que la Truffe de bronze est un titre qu'on
      // veut voir porté par quelqu'un.
      const ids = (data as Rang[]).map((r) => r.person_id).filter((v): v is string => Boolean(v));
      if (ids.length === 0) return;
      const { data: fiches } = await supabase
        .from("people")
        .select("id, photo_url")
        .in("id", ids);
      if (annule || !fiches) return;
      const chemins = fiches.map((p) => p.photo_url).filter((v): v is string => Boolean(v));
      const urls = await signedPhotos(supabase, chemins, { petit: true });
      if (annule) return;
      // La table est indexée par PERSONNE : deux comptes peuvent porter le même
      // pseudo, jamais le même identifiant de fiche.
      const parPersonne = new Map<string, string>();
      for (const p of fiches) {
        const u = p.photo_url ? urls.get(p.photo_url) : undefined;
        if (u) parPersonne.set(p.id, u);
      }
      setPhotos(parPersonne);
    })();
    return () => {
      annule = true;
    };
  }, []);

  if (rangs.length < 3) return null;

  return (
    // La marge basse manquait, et c'est elle qui faisait tout : le podium
    // touchait « Aujourd'hui » sans respiration, et les deux blocs se lisaient
    // comme une seule liste de dix lignes. Un classement se lit par sections —
    // ce qui les sépare est ce qui les rend lisibles.
    <section className={compact ? "mt-8" : "mt-6 mb-8"}>
      <h2 className="serif text-lg font-semibold">Le podium de la famille</h2>
      <ol className="mt-3.5 space-y-2.5">
        {rangs.map((r, i) => {
          const t = TITRES[i];
          return (
            <li
              key={r.pseudo + i}
              className={`flex items-center gap-3 rounded-xl border px-3 py-3.5 ${
                r.a_moi
                  ? "border-accent-line bg-accent-surface"
                  : i === 0
                    ? "border-accent-line bg-card"
                    : "border-line bg-card"
              }`}
            >
              <span aria-hidden className="shrink-0 text-2xl">
                {t.emoji}
              </span>

              {/* Le visage de chacun des trois, et l'emblème à défaut : un
                  podium se regarde, il ne se lit pas. */}
              {r.person_id && photos.get(r.person_id) ? (
                <Avatar src={photos.get(r.person_id)!} name={r.pseudo} size={i === 0 ? 44 : 36} />
              ) : (
                r.emoji && (
                  <span aria-hidden className="shrink-0 text-2xl">
                    {r.emoji}
                  </span>
                )
              )}

              <span className="min-w-0 flex-1">
                <span className="block font-medium">{t.titre}</span>
                <span className="block text-sm text-muted">
                  {r.person_id ? (
                    <Link
                      href={`/personne/${r.person_id}`}
                      className="underline decoration-dotted underline-offset-4"
                    >
                      {r.pseudo}
                    </Link>
                  ) : (
                    r.pseudo
                  )}
                  <span className="text-muted"> · {t.quoi}</span>
                </span>
              </span>

              <span className="serif shrink-0 font-semibold tabular-nums">{r.score}</span>
            </li>
          );
        })}
      </ol>

      {/* Le jour APRÈS les médailles : on regarde d'abord qui domine, ensuite
          ce qui reste à prendre. Masqué les jours sans partie — annoncer un
          chasselas vacant serait annoncer que personne ne joue.

          🔑 Masqué aussi quand le champion du jour tient déjà une médaille.
          Le chasselas existe pour désigner quelqu'un que le podium ignore ;
          répéter le nom qui est déjà en tête, avec le même score, ne distingue
          plus personne — ça ajoute une quatrième ligne qui dit la première. La
          récompense doit changer de main pour valoir quelque chose. */}
      {dujour && !rangs.some((r) => r.pseudo === dujour.pseudo) && (
        <div
          className={`mt-2.5 flex items-center gap-3 rounded-xl border-2 border-dashed px-3 py-3.5 ${
            dujour.a_moi ? "border-accent bg-accent-surface" : "border-accent-line bg-card"
          }`}
        >
          <span aria-hidden className="shrink-0 text-2xl">
            {DU_JOUR.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{DU_JOUR.titre}</span>
            <span className="block text-sm text-muted">
              {dujour.person_id ? (
                <Link
                  href={`/personne/${dujour.person_id}`}
                  className="underline decoration-dotted underline-offset-4"
                >
                  {dujour.pseudo}
                </Link>
              ) : (
                dujour.pseudo
              )}
              <span className="text-muted"> · {DU_JOUR.quoi}</span>
            </span>
          </span>
          <span className="serif shrink-0 font-semibold tabular-nums">{dujour.score}</span>
        </div>
      )}
    </section>
  );
}
