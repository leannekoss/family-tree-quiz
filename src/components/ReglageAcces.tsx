"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Les deux issues de secours de l'entrée libre.
 *
 * Un code partagé par deux cents personnes finit par circuler : capture d'écran
 * dans un groupe, message transféré, téléphone prêté. Ce n'est pas une raison
 * de ne pas ouvrir — c'en est une d'avoir le moyen de refermer en un geste, et
 * de savoir à l'avance ce que ce geste coûte.
 */
export default function ReglageAcces({
  codeActuel,
  ouvert,
}: {
  codeActuel: string;
  ouvert: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [bilan, setBilan] = useState<string | null>(null);

  async function regler(args: { nouveau_code?: string; ouvert?: boolean }) {
    setBusy(true);
    setBilan(null);
    const { data, error } = await supabaseBrowser().rpc("regler_acces", {
      nouveau_code: args.nouveau_code ?? undefined,
      ouvert: args.ouvert ?? undefined,
    });
    setBilan(error ? error.message : String(data));
    setBusy(false);
    setCode("");
    router.refresh();
  }

  return (
    <section className="mt-10 rounded-xl border border-line bg-card p-4">
      <h2 className="serif text-lg">Le code de la famille</h2>

      <p className="mt-1 text-sm text-muted">
        {ouvert ? (
          <>
            N&apos;importe qui connaissant ce code entre, avec l&apos;adresse de
            son choix. C&apos;est ce qui permet d&apos;ouvrir l&apos;arbre à deux
            cents personnes sans saisir deux cents adresses.
          </>
        ) : (
          <>
            Seules les adresses inscrites plus bas peuvent entrer. Une nouvelle
            adresse est refusée même avec le bon code.
          </>
        )}
      </p>

      <p className="mt-3 font-mono text-lg tracking-wide">{codeActuel}</p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="min-w-[12rem] flex-1">
          <span className="mb-1.5 block text-sm font-medium">Changer le code</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="huit caractères au moins"
            className="w-full rounded-lg border border-line bg-background px-3 py-2.5 text-base outline-none focus:border-accent"
          />
        </label>
        <button
          onClick={() => regler({ nouveau_code: code })}
          disabled={busy || code.trim().length < 8}
          className="rounded-lg bg-accent px-4 py-2.5 font-medium text-sur-plein disabled:opacity-40"
        >
          Changer
        </button>
      </div>

      {/* Dire ce que ça coûte AVANT, pas après : le geste est irréversible pour
          ceux qui ne verront pas passer le nouveau code. */}
      <p className="mt-2 text-xs text-muted">
        Changer le code n&apos;éjecte personne : ceux qui sont déjà entrés le
        restent. Mais il faudra transmettre le nouveau à qui n&apos;est pas
        encore venu.
      </p>

      <div className="mt-5 border-t border-line pt-4">
        <button
          onClick={() => regler({ ouvert: !ouvert })}
          disabled={busy}
          className="rounded-lg border border-line px-4 py-2.5 text-sm disabled:opacity-40"
        >
          {ouvert ? "Refermer : seules les adresses inscrites" : "Rouvrir l'entrée libre"}
        </button>
      </div>

      {bilan && <p className="mt-3 text-sm text-accent">{bilan}</p>}
    </section>
  );
}
