"use client";

import { useMemo, useRef, useState } from "react";
import { couleurDe } from "@/lib/branches";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { deposerPhoto } from "@/lib/photo-envoi";
import Recadrer from "@/components/Recadrer";

export type Manquant = {
  id: string;
  nom: string;
  branche: string | null;
  annee: string | null;
  /**
   * De qui il s'agit, en trois mots : « épouse de Edward Thornton », « fils
   * de Marcel Bardin ». Six personnes de l'arbre ne sont connues que par leur
   * prénom et cinquante-quatre n'ont pas de date — devant « Alice », personne
   * ne sait s'il a une photo à donner. Le conjoint ou les parents suffisent à
   * la situer, et c'est le manque le plus fréquent qu'ils comblent.
   */
  piste: string | null;
};

const TOUTES = "Toutes les branches";

/**
 * Deux cent soixante-quinze fiches sans visage, c'est une liste que personne
 * n'a envie d'ouvrir. Filtrée sur sa propre branche, c'est une vingtaine de
 * têtes qu'on connaît — et là, chacun peut faire sa part en cinq minutes.
 */
export default function VisagesManquants({
  manquants,
  posees,
  total,
}: {
  manquants: Manquant[];
  posees: number;
  total: number;
}) {
  const [branche, setBranche] = useState(TOUTES);
  const [faites, setFaites] = useState<Map<string, string>>(new Map());
  const [encours, setEncours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [aCadrer, setACadrer] = useState<File | null>(null);
  const cible = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const branches = useMemo(() => {
    const noms = [...new Set(manquants.map((m) => m.branche).filter(Boolean))] as string[];
    return [TOUTES, ...noms.sort()];
  }, [manquants]);

  const visibles = manquants.filter(
    (m) => branche === TOUTES || m.branche === branche,
  );

  async function envoyer(source: Blob) {
    const id = cible.current;
    if (!id) return;

    setEncours(id);
    setErreur(null);
    try {
      const file =
        source instanceof File ? source : new File([source], "visage.jpg", { type: "image/jpeg" });
      await deposerPhoto(supabaseBrowser(), id, file);
      // L'aperçu vient du fichier local : le bucket est privé, demander une URL
      // signée juste pour confirmer ce que la personne vient de choisir
      // ajouterait un aller-retour pour rien.
      setFaites((m) => new Map(m).set(id, URL.createObjectURL(file)));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "envoi impossible");
    } finally {
      setEncours(null);
    }
  }

  const acquis = posees + faites.size;
  const part = Math.round((acquis / Math.max(1, total)) * 100);

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          // La photo ne part PAS tout de suite : elle s'ouvre dans le cadreur,
          // comme sur la fiche. C'était le seul écran qui envoyait brut — une
          // photo de vacances y devenait une pastille où l'on voit un torse,
          // et ce qui n'est pas cadré n'aurait jamais dû quitter l'appareil.
          if (f) setACadrer(f);
          e.target.value = "";
        }}
      />

      {aCadrer && (
        <div className="mb-4">
          <Recadrer
            fichier={aCadrer}
            onValider={(blob) => {
              setACadrer(null);
              void envoyer(blob);
            }}
            onAnnuler={() => setACadrer(null)}
          />
        </div>
      )}

      <div className="rounded-xl border border-line bg-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="serif text-lg">
            {acquis} visage{acquis > 1 ? "s" : ""} sur {total}
          </p>
          <p className="text-sm tabular-nums text-muted">{part}%</p>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-acquis transition-[width] duration-500"
            style={{ width: `${Math.max(part, acquis > 0 ? 2 : 0)}%` }}
          />
        </div>
        {faites.size > 0 && (
          <p className="animate-monte mt-2 text-sm text-acquis">
            {faites.size} ajouté{faites.size > 1 ? "s" : ""} par vous aujourd&apos;hui. Merci.
          </p>
        )}
      </div>

      {erreur && <p className="mt-3 text-sm text-accent">{erreur}</p>}

      {/* Les branches passaient à la ligne nulle part : quatre d'entre elles
          sortaient de l'écran d'un téléphone, sans rien qui laisse deviner
          qu'on pouvait faire glisser la bande. Un filtre qu'on ne voit pas
          n'existe pas. La pastille reprend la couleur que la branche porte
          déjà sur les cartes de l'arbre. */}
      <ul className="mt-6 flex flex-wrap gap-1.5">
        {branches.map((b) => {
          const couleur = couleurDe(b);
          return (
            <li key={b}>
              <button
                onClick={() => setBranche(b)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${
                  branche === b ? "border-accent bg-accent-soft font-medium" : "border-line"
                }`}
              >
                {couleur && (
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: couleur }}
                  />
                )}
                {b}
              </button>
            </li>
          );
        })}
      </ul>

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visibles.map((m) => {
          const apercu = faites.get(m.id);
          const busy = encours === m.id;

          return (
            <li key={m.id}>
              <button
                onClick={() => {
                  cible.current = m.id;
                  input.current?.click();
                }}
                disabled={busy}
                // `h-full` : la grille étire déjà les cases de la ligne, mais
                // le bouton gardait sa hauteur naturelle. Les trois personnes
                // sans date de naissance perdaient donc une ligne de texte, et
                // leur cadre s'arrêtait plus haut que celui des voisines — un
                // décalage qu'on remarque sans savoir l'expliquer.
                className={`flex h-full w-full flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center ${
                  apercu ? "border-acquis bg-acquis-surface" : "border-line bg-card"
                }`}
              >
                <span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-line bg-background">
                  {apercu ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={apercu} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="serif text-xl text-muted">
                      {busy ? "…" : "+"}
                    </span>
                  )}
                </span>
                <span className="serif text-sm leading-tight">{m.nom}</span>
                {m.annee && <span className="text-xs text-muted">{m.annee}</span>}
                {/* Sous le nom, plus petit : de qui il s'agit. Deux lignes au
                    plus, sinon la vignette s'étire et la grille se disloque —
                    « épouse de Marie-Christine Boccon-Gibod » tient en deux. */}
                {m.piste && (
                  <span className="line-clamp-2 text-[11px] leading-snug text-muted">
                    {m.piste}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {visibles.length === 0 && (
        <p className="mt-8 text-center text-muted">
          Tous les visages de cette branche sont là.{" "}
          <Link href="/quiz" className="underline underline-offset-4">
            Au quiz.
          </Link>
        </p>
      )}
    </div>
  );
}
