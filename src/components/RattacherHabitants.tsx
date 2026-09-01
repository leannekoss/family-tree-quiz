"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export type Gens = { id: string; nom: string; placeId: number | null };

/**
 * Rattacher quelqu'un à une maison depuis la carte.
 *
 * Le champ « qui y habite » est du texte libre : il porte le relevé du
 * bulletin, y compris des gens qui n'ont pas de fiche, et doit le rester. Mais
 * pour ceux qui ont une fiche, l'écrire à la main est une faute qui attend son
 * heure — « Bardin » pour « Bardin », un accent oublié, et le nom ne renvoie
 * plus à personne.
 *
 * Choisir dans une liste ne se trompe jamais de graphie, et le lien fonctionne
 * dans les deux sens : la maison apparaît alors sur la fiche de la personne,
 * sans que quiconque ait eu à y retourner.
 */
export default function RattacherHabitants({
  maisonId,
  maisonNom,
  gens,
}: {
  maisonId: number;
  maisonNom: string;
  gens: Gens[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const nu = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const ici = useMemo(() => gens.filter((g) => g.placeId === maisonId), [gens, maisonId]);

  const trouves = useMemo(() => {
    const t = nu(q.trim());
    if (t.length < 2) return [];
    return gens
      .filter((g) => g.placeId !== maisonId && nu(g.nom).includes(t))
      .slice(0, 8);
  }, [gens, q, maisonId]);

  async function bouger(id: string, vers: number | null) {
    setBusy(id);
    setErreur(null);
    const { error } = await supabaseBrowser()
      .from("people")
      .update({ place_id: vers })
      .eq("id", id);
    setBusy(null);
    if (error) {
      setErreur(error.message);
      return;
    }
    setQ("");
    router.refresh();
  }

  return (
    <div className="mt-4 border-t border-accent-line pt-3">
      <p className="text-sm font-medium">Qui habite ici</p>

      {ici.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {ici.map((g) => (
            <li key={g.id}>
              <button
                onClick={() => bouger(g.id, null)}
                disabled={busy === g.id}
                // Retirer se fait d'un geste, au même endroit qu'ajouter : une
                // erreur de rattachement doit se défaire là où elle a été
                // commise, pas depuis la fiche de la personne.
                title={`Retirer ${g.nom} de ${maisonNom}`}
                className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm disabled:opacity-50"
              >
                {g.nom} <span aria-hidden className="text-muted">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Chercher un nom à rattacher"
        className="mt-2 w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-accent"
      />

      {/* La liste n'apparaît qu'à partir de deux lettres : afficher quatre
          cents noms d'emblée ferait défiler plus longtemps qu'il n'en faut
          pour taper. */}
      {trouves.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {trouves.map((g) => (
            <li key={g.id}>
              <button
                onClick={() => bouger(g.id, maisonId)}
                disabled={busy === g.id}
                className="rounded-lg border border-accent bg-accent px-2.5 py-1.5 text-sm text-sur-plein disabled:opacity-50"
              >
                + {g.nom}
                {/* Une personne déjà rattachée ailleurs : le dire évite de
                    déplacer quelqu'un sans s'en apercevoir. */}
                {g.placeId !== null && (
                  <span className="ml-1 text-xs opacity-80">(déménage)</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {erreur && <p className="mt-2 text-sm text-alerte">{erreur}</p>}

      <p className="mt-2 text-xs text-muted">
        Choisir dans la liste plutôt que d&apos;écrire le nom : le lien
        fonctionne alors dans les deux sens, et la maison apparaît sur la fiche
        de la personne.
      </p>
    </div>
  );
}
