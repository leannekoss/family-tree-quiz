"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Ouvrir l'arbre à deux cents personnes une adresse à la fois n'était pas
 * tenable : le champ accepte une liste collée, séparée par des virgules, des
 * points-virgules ou des retours à la ligne — c'est-à-dire ce qu'on obtient en
 * copiant depuis un carnet d'adresses ou un tableur.
 */
export default function InviteForm({ lien }: { lien: string }) {
  const [texte, setTexte] = useState("");
  const [busy, setBusy] = useState(false);
  const [bilan, setBilan] = useState<string[] | null>(null);
  const [copie, setCopie] = useState(false);

  async function inviter(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setBilan(null);

    const adresses = [...new Set(
      texte.split(/[\s,;]+/).map((a) => a.trim().toLowerCase()).filter((a) => a.includes("@")),
    )];

    const supabase = supabaseBrowser();
    const resultats: string[] = [];

    for (const email of adresses) {
      const { data, error } = await supabase.rpc("inviter_membre", {
        nouvel_email: email,
        qui: undefined,
      });
      resultats.push(error ? `${email} — ${error.message}` : `${email} — ${data}`);
    }

    setBilan(resultats.length ? resultats : ["Aucune adresse valide reconnue."]);
    setTexte("");
    setBusy(false);
  }

  async function copier() {
    await navigator.clipboard.writeText(lien);
    setCopie(true);
    setTimeout(() => setCopie(false), 2500);
  }

  async function partager() {
    if (navigator.share) {
      await navigator.share({ title: "L'arbre de la famille", url: lien });
    } else {
      await copier();
    }
  }

  return (
    <div>
      <div className="rounded-xl border border-line bg-card p-4">
        <h2 className="serif text-lg">Le lien à envoyer</h2>
        <p className="mt-1 text-sm text-muted">
          Le code y est déjà rempli. La personne saisit son adresse et entre
          aussitôt — aucun email ne lui est envoyé.
        </p>
        <p className="mt-3 break-all rounded-lg border border-line bg-background px-3 py-2 font-mono text-xs">
          {lien}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={copier}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-sur-plein"
          >
            {copie ? "Copié" : "Copier le lien"}
          </button>
          <button onClick={partager} className="rounded-lg border border-line px-4 py-2 text-sm">
            Partager
          </button>
        </div>
      </div>

      <form onSubmit={inviter} className="mt-8">
        <h2 className="serif text-lg">Inviter</h2>
        <p className="mt-1 text-sm text-muted">
          Une adresse par ligne, ou collez-en toute une liste d&apos;un coup.
        </p>
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          rows={4}
          placeholder={"marie@exemple.fr\npierre@exemple.fr"}
          className="mt-2 w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-accent"
        />
        <button
          disabled={busy || !texte.trim()}
          className="mt-2 rounded-lg bg-accent px-5 py-2.5 font-medium text-sur-plein disabled:opacity-40"
        >
          {busy ? "Inscription…" : "Les inscrire"}
        </button>
      </form>

      {bilan && (
        <ul className="mt-4 space-y-1 text-sm">
          {bilan.map((l, i) => (
            <li key={i} className="text-muted">
              {l}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
