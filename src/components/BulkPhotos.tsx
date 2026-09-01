"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { deposerPhoto } from "@/lib/photo-envoi";
import { fullName } from "@/lib/types";

type Match = {
  file: File;
  guess: string; // le nom lu dans le fichier
  personId: string | null;
  personLabel: string | null;
  score: number;
  state: "à envoyer" | "envoyé" | "ignoré" | "erreur";
  message?: string;
};

/** « camille-vernet_2024.jpg » → « camille vernet ». */
function readName(filename: string): string {
  return filename
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\b(img|photo|dsc|pxl|screenshot)\b/gi, "")
    .replace(/\d{4,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function BulkPhotos() {
  const [rows, setRows] = useState<Match[]>([]);
  const [busy, setBusy] = useState(false);

  async function analyse(files: FileList) {
    setBusy(true);
    const supabase = supabaseBrowser();
    const found: Match[] = [];

    for (const file of Array.from(files)) {
      const guess = readName(file.name);
      let personId: string | null = null;
      let personLabel: string | null = null;
      let score = 0;

      if (guess.length >= 3) {
        const { data } = await supabase.rpc("search_people", { q: guess });
        const best = data?.[0];
        if (best) {
          personId = best.id;
          personLabel = fullName(best);
          score = best.score ?? 0;
        }
      }

      found.push({
        file,
        guess,
        personId,
        personLabel,
        score,
        // Au-dessus de 0,75 le nom du fichier correspond franchement ; en
        // dessous on propose sans cocher, c'est à l'œil humain de trancher.
        state: personId && score >= 0.75 ? "à envoyer" : "ignoré",
        message: personId ? undefined : "aucune fiche ne correspond",
      });
    }

    setRows(found);
    setBusy(false);
  }

  async function sendAll() {
    setBusy(true);
    const supabase = supabaseBrowser();
    const next = [...rows];

    for (let i = 0; i < next.length; i++) {
      const row = next[i];
      if (row.state !== "à envoyer" || !row.personId) continue;

      try {
        // Le suffixe évite que deux photos envoyées dans la même milliseconde
        // se retrouvent au même chemin.
        await deposerPhoto(supabase, row.personId, row.file, `-${i}`);
        next[i] = { ...row, state: "envoyé" };
      } catch (e) {
        next[i] = {
          ...row,
          state: "erreur",
          message: e instanceof Error ? e.message : "envoi impossible",
        };
      }
      setRows([...next]);
    }

    setBusy(false);
  }

  const toSend = rows.filter((r) => r.state === "à envoyer").length;

  return (
    <div>
      <label className="inline-block rounded-lg border border-line bg-card px-4 py-2.5">
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && analyse(e.target.files)}
        />
        Choisir des photos
      </label>

      {rows.length > 0 && (
        <>
          <div className="mt-6 flex items-center justify-between gap-4">
            <p className="text-sm text-muted">
              {rows.length} photo{rows.length > 1 ? "s" : ""}, {toSend} reconnue
              {toSend > 1 ? "s" : ""}
            </p>
            <button
              onClick={sendAll}
              disabled={busy || toSend === 0}
              className="rounded-lg bg-accent px-5 py-2.5 font-medium text-sur-plein disabled:opacity-40"
            >
              {busy ? "Envoi…" : `Envoyer les ${toSend} reconnues`}
            </button>
          </div>

          <ul className="mt-4 divide-y divide-line">
            {rows.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <span className="min-w-0 flex-1 break-all text-sm">{r.file.name}</span>
                <span className="text-sm">
                  {r.personLabel ?? <span className="text-muted">{r.message}</span>}
                </span>
                <select
                  value={r.state}
                  disabled={!r.personId || busy}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...r, state: e.target.value as Match["state"] };
                    setRows(next);
                  }}
                  className="rounded-lg border border-line bg-card px-2 py-1 text-sm"
                >
                  <option value="à envoyer">à envoyer</option>
                  <option value="ignoré">ignorer</option>
                  {r.state === "envoyé" && <option value="envoyé">envoyé</option>}
                  {r.state === "erreur" && <option value="erreur">erreur</option>}
                </select>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
