"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fullName } from "@/lib/types";

export type Choix = { id: string; label: string; annee: number | null };

export type Trouve = {
  id: string;
  first_name: string;
  last_name: string;
  married_name: string | null;
  birth_display: string | null;
  birth_year: number | null;
  sex: string | null;
};

const MINIMUM_LETTRES = 2;

/**
 * Désigner quelqu'un de l'arbre en tapant son nom.
 *
 * Sept mille fiches : aucune liste ne se parcourt, et aucun menu ne s'envoie
 * d'avance. On cherche, on clique, l'identifiant se dépose dans un input caché
 * — le formulaire reste un formulaire, et l'action serveur ne voit aucune
 * différence.
 *
 * 🔑 La recherche interroge `people` directement, et non `search_people` : la
 * fonction de l'accueil masque volontairement les aïeux collatéraux sans notes,
 * masquage juste pour qui cherche un cousin, mais qui rendrait impossible de
 * raccorder une branche à un aïeu importé — le geste même qui a fait passer
 * l'ascendance de 7,2 à 12,5 générations.
 *
 * `search_text` est une colonne générée, déjà en minuscules et sans accents :
 * c'est elle qui trouve « Rozel » quand on tape « rozel ».
 */
export default function ChercherPersonne({
  name,
  placeholder,
  sauf,
  choisi,
  onChoisir,
  ecarter,
}: {
  /** Le champ caché qui portera l'identifiant, quand le formulaire en veut un. */
  name?: string;
  placeholder: string;
  /** Un identifiant à ne jamais proposer — le sien, le plus souvent. */
  sauf?: string | null;
  choisi: Choix | null;
  onChoisir: (c: Choix | null) => void;
  /**
   * Pourquoi cette personne est peu probable ici — « trop jeune », « autre
   * sexe » — ou `null` si elle l'est. 🔑 On trie, on ne retranche pas : une
   * date fausse ne doit jamais interdire la correction qu'on est venu faire,
   * et les écartés restent cliquables, avec leur raison affichée.
   */
  ecarter?: (p: Trouve) => string | null;
}) {
  const [q, setQ] = useState("");
  const [trouves, setTrouves] = useState<Trouve[]>([]);
  const [cherche, setCherche] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const dernier = useRef(0);

  const terme = useMemo(
    () =>
      q
        .trim()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase(),
    [q],
  );

  useEffect(() => {
    if (terme.length < MINIMUM_LETTRES) {
      setTrouves([]);
      setCherche(false);
      return;
    }
    setCherche(true);
    // On laisse la frappe se poser : sans ce délai, « faure » lance cinq
    // requêtes dont quatre sont déjà périmées quand elles reviennent.
    const t = setTimeout(async () => {
      const appel = ++dernier.current;
      let requete = supabaseBrowser()
        .from("people")
        .select("id, first_name, last_name, married_name, birth_display, birth_year, sex")
        .ilike("search_text", `%${terme}%`);
      // « Julien Morel · trop jeune » figurait dans la liste des pères de Julien
      // Morel. Personne ne s'y serait trompé, mais une proposition absurde fait
      // douter des autres.
      if (sauf) requete = requete.neq("id", sauf);

      const { data, error } = await requete.limit(30);

      // Une réponse arrivée après une frappe plus récente ne doit pas écraser
      // la liste : c'est ainsi qu'un champ de recherche affiche l'avant-dernier
      // mot tapé.
      if (appel !== dernier.current) return;
      setCherche(false);
      if (error) {
        setErreur(error.message);
        return;
      }
      setErreur(null);
      setTrouves(data ?? []);
    }, 200);

    return () => clearTimeout(t);
  }, [terme, sauf]);

  const raison = (p: Trouve) => (ecarter ? ecarter(p) : null);

  const classes = useMemo(
    () => [...trouves].sort((a, b) => Number(raison(a) !== null) - Number(raison(b) !== null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trouves, ecarter],
  );

  if (choisi) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2.5">
        {name && <input type="hidden" name={name} value={choisi.id} />}
        <span className="text-base">
          {choisi.label}
          {choisi.annee ? <span className="text-muted"> ({choisi.annee})</span> : null}
        </span>
        <button
          type="button"
          onClick={() => {
            onChoisir(null);
            setQ("");
          }}
          className="ml-auto rounded-lg border border-line px-2.5 py-1 text-sm"
        >
          Changer
        </button>
      </div>
    );
  }

  return (
    <>
      {name && <input type="hidden" name={name} value="" />}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-accent"
      />

      {terme.length >= MINIMUM_LETTRES && (
        <div className="mt-2">
          {cherche && <p className="text-sm text-muted">Recherche…</p>}
          {!cherche && classes.length === 0 && (
            <p className="text-sm text-muted">Personne de ce nom dans l&apos;arbre.</p>
          )}
          <ul className="flex flex-wrap gap-1.5">
            {classes.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onChoisir({ id: p.id, label: fullName(p), annee: p.birth_year })}
                  className={`rounded-lg border px-2.5 py-1.5 text-sm ${
                    raison(p) === null
                      ? "border-accent bg-accent text-sur-plein"
                      : "border-line bg-card"
                  }`}
                >
                  {fullName(p)}
                  {p.birth_display ? (
                    <span className="ml-1 opacity-80">({p.birth_display})</span>
                  ) : null}
                  {/* Dire pourquoi une proposition est en retrait vaut mieux
                      que de la faire disparaître. */}
                  {raison(p) !== null && (
                    <span className="ml-1 text-xs text-muted">· {raison(p)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {erreur && <p className="mt-2 text-sm text-alerte">{erreur}</p>}
    </>
  );
}
