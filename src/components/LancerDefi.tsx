"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type Joueur = { user_id: string; pseudo: string };

export default function LancerDefi({ joueurs }: { joueurs: Joueur[] }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [filtre, setFiltre] = useState("");
  const [enCours, setEnCours] = useState(false);

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="rounded-lg border border-accent-line bg-accent-surface px-5 py-3 font-medium"
      >
        Lancer un défi
      </button>
    );
  }

  const filtres = joueurs.filter((j) =>
    j.pseudo.toLowerCase().includes(filtre.toLowerCase()),
  );

  const [erreur, setErreur] = useState<string | null>(null);

  async function lancer() {
    if (choisis.size === 0 || enCours) return;
    setEnCours(true);
    setErreur(null);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErreur("Non connecté"); setEnCours(false); return; }

    const { data: duel, error } = await supabase
      .from("duels")
      .insert({ created_by: user.id })
      .select("id, code")
      .single();

    if (error || !duel) {
      setErreur(`Création : ${error?.message ?? "inconnu"}`);
      setEnCours(false);
      return;
    }

    const membres = [user.id, ...([...choisis].filter((id) => id !== user.id))];
    const { error: errM } = await supabase
      .from("duel_members")
      .insert(membres.map((user_id) => ({ duel_id: duel.id, user_id })));

    if (errM) {
      setErreur(`Participants : ${errM.message}`);
      setEnCours(false);
      return;
    }

    router.push(`/duel/${duel.code}`);
  }

  return (
    <div className="rounded-xl border border-accent-line bg-accent-surface px-4 py-4">
      <p className="serif text-lg font-semibold">Qui défiez-vous ?</p>
      <p className="mt-1 text-sm text-muted">
        Choisissez 1 à 3 adversaires. Vous serez ajouté automatiquement.
      </p>

      <input
        type="text"
        placeholder="Chercher un joueur..."
        value={filtre}
        onChange={(e) => setFiltre(e.target.value)}
        className="mt-3 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm"
      />

      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
        {filtres.map((j) => (
          <li key={j.user_id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-card">
              <input
                type="checkbox"
                checked={choisis.has(j.user_id)}
                disabled={!choisis.has(j.user_id) && choisis.size >= 3}
                onChange={() => {
                  const next = new Set(choisis);
                  if (next.has(j.user_id)) next.delete(j.user_id);
                  else next.add(j.user_id);
                  setChoisis(next);
                }}
                className="accent-accent"
              />
              {j.pseudo}
            </label>
          </li>
        ))}
      </ul>

      {erreur && (
        <p className="mt-2 text-sm text-red-600">{erreur}</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={lancer}
          disabled={choisis.size === 0 || enCours}
          className="rounded-lg bg-accent px-5 py-2.5 font-medium text-sur-plein disabled:opacity-50"
        >
          {enCours ? "Création..." : `Défier ${choisis.size > 0 ? `(${choisis.size})` : ""}`}
        </button>
        <button
          onClick={() => { setOuvert(false); setChoisis(new Set()); setFiltre(""); }}
          className="px-3 text-sm text-muted underline underline-offset-4"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
