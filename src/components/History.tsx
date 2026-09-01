"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type Change = {
  id: number;
  action: string;
  changed_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};

// Les champs qu'un lecteur reconnaît. Les colonnes générées et les identifiants
// n'ont rien à faire dans un journal destiné à la famille.
const LISIBLES: Record<string, string> = {
  first_name: "prénom",
  last_name: "nom de naissance",
  married_name: "nom d'usage",
  nickname: "surnom",
  sex: "sexe",
  birth_display: "naissance",
  death_display: "décès",
  deceased: "décédé",
  notes: "notes",
  place_detail: "précision du lieu",
  photo_url: "photo",
  father_id: "père",
  mother_id: "mère",
  branch_id: "branche",
  place_id: "maison",
};

function resume(c: Change): string[] {
  if (c.action === "INSERT") return ["fiche créée"];
  if (!c.old_data || !c.new_data) return [c.action.toLowerCase()];

  const changes: string[] = [];
  for (const [champ, libelle] of Object.entries(LISIBLES)) {
    const avant = c.old_data[champ];
    const apres = c.new_data[champ];
    if (String(avant ?? "") === String(apres ?? "")) continue;
    if (champ.endsWith("_id") || champ === "photo_url") {
      changes.push(libelle);
    } else {
      changes.push(`${libelle} : ${avant ?? "vide"} → ${apres ?? "vide"}`);
    }
  }
  return changes.length ? changes : ["aucun champ visible modifié"];
}

export default function History({ changes }: { changes: Change[] }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function restaurer(id: number) {
    setBusy(id);
    setMessage(null);
    const { error } = await supabaseBrowser().rpc("restaurer_fiche", { audit_id: id });
    if (error) {
      setMessage(error.message);
      setBusy(null);
      return;
    }
    // Rechargement complet : la fiche est rendue côté serveur.
    window.location.reload();
  }

  if (changes.length === 0) return null;

  return (
    <details className="mt-6 rounded-xl border border-line bg-card p-4">
      <summary className="cursor-pointer text-sm">
        {changes.length} modification{changes.length > 1 ? "s" : ""} — voir et revenir
        en arrière
      </summary>

      {message && <p className="mt-3 text-sm text-accent">{message}</p>}

      <ul className="mt-3 divide-y divide-line text-sm">
        {changes.map((c) => (
          <li key={c.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-muted">
                {/* Le fuseau est écrit noir sur blanc. Sans lui, le serveur
                    formate en UTC et le navigateur en heure de Paris : deux
                    textes différents pour la même donnée, et React refait tout
                    le rendu en signalant une erreur d'hydratation (#418) à
                    chaque ouverture de fiche. La famille est en France, la
                    date se lit à l'heure française des deux côtés. */}
                {new Date(c.changed_at).toLocaleString("fr-FR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "Europe/Paris",
                })}
              </p>
              <ul className="mt-0.5">
                {resume(c).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
            {c.old_data && (
              <button
                onClick={() => restaurer(c.id)}
                disabled={busy !== null}
                className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40"
              >
                {busy === c.id ? "…" : "Revenir à cet état"}
              </button>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-muted">
        Revenir en arrière est lui-même enregistré : on peut toujours refaire le
        chemin inverse.
      </p>
    </details>
  );
}
