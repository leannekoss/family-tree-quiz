"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type Souvenir = {
  id: number;
  texte: string;
  auteur: string;
  a_moi: boolean;
};

/**
 * L'histoire d'une maison, et ce que la famille en garde.
 *
 * Deux choses que rien ne doit confondre :
 *
 *   Le récit établi — daté, sourcé, tiré du bulletin. Il ne se corrige pas ici :
 *   il vient d'un texte publié, avec un auteur.
 *
 *   Les souvenirs — plusieurs par maison, et c'est le but. Chacun a SON La Prade.
 *   Le souvenir d'un cousin de soixante ans n'est pas celui d'un enfant de
 *   douze, et aucun des deux n'annule l'autre.
 *
 * 🔑 Le résumé d'abord, l'histoire derrière un pli. Un pavé de mille cinq cents
 * signes sur un téléphone ne se lit pas — il se saute, et avec lui tout le
 * reste du panneau. Dix lignes décident ; qui veut la suite la demande.
 */
export default function HistoireMaison({
  maisonId,
  resume,
  histoire,
  source,
}: {
  maisonId: number;
  resume: string | null;
  histoire: string | null;
  source: string | null;
}) {
  const [souvenirs, setSouvenirs] = useState<Souvenir[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [etat, setEtat] = useState<"prêt" | "envoi">("prêt");
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      const supabase = supabaseBrowser();
      const [{ data }, { data: moi }] = await Promise.all([
        supabase
          .from("place_stories")
          .select("id, texte, auteur, user_id")
          .eq("place_id", maisonId)
          .order("created_at", { ascending: false }),
        supabase.auth.getUser(),
      ]);
      if (annule) return;
      setSouvenirs(
        (data ?? []).map((s) => ({
          id: s.id,
          texte: s.texte,
          auteur: s.auteur,
          a_moi: s.user_id === moi.user?.id,
        })),
      );
    })();
    return () => {
      annule = true;
    };
  }, [maisonId]);

  async function envoyer() {
    const propre = texte.trim();
    if (propre.length < 10) {
      setErreur("Encore quelques mots : dix caractères au minimum.");
      return;
    }
    setEtat("envoi");
    setErreur(null);

    const supabase = supabaseBrowser();
    // Le nom retenu sur l'appareil, le même que pour le quiz : on ne redemande
    // pas à quelqu'un qui l'a déjà donné trois fois.
    let auteur = "";
    try {
      auteur = localStorage.getItem("arbre.pseudo") ?? "";
    } catch {
      /* navigation privée */
    }
    if (!auteur) {
      const { data } = await supabase.from("members").select("nom_declare").maybeSingle();
      auteur = data?.nom_declare ?? "";
    }
    if (!auteur) {
      const { data } = await supabase.auth.getUser();
      auteur = data.user?.email?.split("@")[0] ?? "quelqu'un de la famille";
    }

    // 🔑 L'erreur est LUE. Une insertion refusée par RLS revient sans bruit :
    // l'écran dirait « c'est enregistré » et le souvenir n'existerait pas.
    const { data, error } = await supabase
      .from("place_stories")
      .insert({ place_id: maisonId, texte: propre, auteur })
      .select("id, texte, auteur")
      .single();

    if (error) {
      setErreur(`Ce souvenir n'a pas pu être enregistré : ${error.message}`);
      setEtat("prêt");
      return;
    }

    setSouvenirs((s) => [{ ...data, a_moi: true }, ...s]);
    setTexte("");
    setOuvert(false);
    setEtat("prêt");
  }

  async function effacer(id: number) {
    const { error } = await supabaseBrowser().from("place_stories").delete().eq("id", id);
    if (error) {
      setErreur(`Impossible d'effacer : ${error.message}`);
      return;
    }
    setSouvenirs((s) => s.filter((x) => x.id !== id));
  }

  return (
    <div className="mt-4 border-t border-accent-line pt-3">
      {resume && (
        <div className="text-sm">
          {resume.split("\n\n").map((p, i) => (
            <p key={i} className={i > 0 ? "mt-2" : ""}>
              {p}
            </p>
          ))}

          {/* `details` natif : il s'ouvre sans JavaScript, se replie au même
              geste, et le navigateur sait déjà le faire mieux qu'un état React.
              Le triangle est masqué au profit d'une flèche qui dit où l'on va. */}
          {histoire && (
            <details className="group mt-2">
              <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center text-sm font-medium text-accent marker:hidden">
                <span className="underline underline-offset-4">
                  → En savoir plus
                </span>
                <span className="ml-1.5 text-xs text-muted group-open:hidden">
                  (toute l&apos;histoire)
                </span>
              </summary>
              <div className="mt-2 border-l-2 border-accent-line pl-3">
                {histoire.split("\n\n").map((p, i) => (
                  <p key={i} className={i > 0 ? "mt-2" : ""}>
                    {p}
                  </p>
                ))}
                {source && (
                  <p className="mt-3 text-xs italic text-muted">{source}</p>
                )}
              </div>
            </details>
          )}
        </div>
      )}

      {souvenirs.length > 0 && (
        <ul className="mt-4 space-y-2">
          {souvenirs.map((s) => (
            <li key={s.id} className="rounded-lg border border-line bg-card px-3 py-2.5 text-sm">
              <p className="whitespace-pre-line">{s.texte}</p>
              <p className="mt-1.5 text-xs text-muted">
                {s.auteur}
                {s.a_moi && (
                  <button
                    onClick={() => effacer(s.id)}
                    className="ml-2 underline underline-offset-4"
                  >
                    effacer
                  </button>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* L'invitation, et elle est numérotée exprès : « Écrivez la vôtre »
          seul se lit comme une consigne. Le chiffre en fait une place à
          prendre — la première quand personne n'a écrit, la suivante sinon. */}
      {!ouvert ? (
        <button
          onClick={() => setOuvert(true)}
          className="mt-3 inline-flex min-h-[44px] items-center rounded-lg border border-accent-line bg-card px-3 py-2 text-sm font-medium text-accent"
        >
          {souvenirs.length + 1}. Écrivez la vôtre
        </button>
      ) : (
        <div className="mt-3">
          <label className="block text-sm font-medium" htmlFor={`souvenir-${maisonId}`}>
            Votre souvenir de cette maison
          </label>
          <textarea
            id={`souvenir-${maisonId}`}
            rows={4}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            maxLength={2000}
            placeholder="Un été, une bêtise, une odeur de cuisine, qui dormait où — ce que personne d'autre ne peut raconter."
            className="mt-1.5 w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-accent"
          />
          {erreur && <p className="mt-1.5 text-sm text-alerte">{erreur}</p>}
          <div className="mt-2 flex gap-2">
            <button
              onClick={envoyer}
              disabled={etat === "envoi"}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-sur-plein disabled:opacity-50"
            >
              {etat === "envoi" ? "…" : "Enregistrer"}
            </button>
            <button
              onClick={() => {
                setOuvert(false);
                setErreur(null);
              }}
              className="rounded-lg border border-line px-4 py-2.5 text-sm"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
