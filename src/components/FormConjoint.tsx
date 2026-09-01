"use client";

import { useState } from "react";

type Personne = {
  id: string;
  first_name: string;
  last_name: string;
  married_name: string | null;
  birth_year: number | null;
  sex: string | null;
};

const champ =
  "w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-accent";

/**
 * « Il est déjà dans l'arbre » ou « pas encore » : le choix est posé en premier,
 * avant tout le reste.
 *
 * L'ordre compte. Un formulaire qui ouvre sur une liste déroulante de quatre
 * cents noms fait chercher dans la liste — et trouver, presque toujours, un
 * homonyme plausible. Or le conjoint qu'on vient déclarer est le plus souvent
 * une personne que l'arbre ne connaît pas encore : c'est même la raison pour
 * laquelle on est là.
 */
export default function FormConjoint({
  action,
  candidats,
  nom,
}: {
  action: (formData: FormData) => void;
  candidats: Personne[];
  nom: string;
}) {
  const [mode, setMode] = useState<"nouveau" | "existant">("nouveau");

  return (
    <form action={action} className="mt-6 space-y-5">
      <input type="hidden" name="mode" value={mode} />

      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Le conjoint ou la conjointe de {nom}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choix
            actif={mode === "nouveau"}
            onClick={() => setMode("nouveau")}
            titre="Pas encore dans l'arbre"
            detail="sa fiche sera créée"
          />
          <Choix
            actif={mode === "existant"}
            onClick={() => setMode("existant")}
            titre="Déjà dans l'arbre"
            detail="à choisir dans la liste"
          />
        </div>
      </fieldset>

      {mode === "nouveau" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Prénom</span>
              <input name="first_name" required autoFocus className={champ} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Nom de naissance</span>
              <input name="last_name" required className={champ} />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Femme ou homme</span>
            <select name="sex" required defaultValue="" className={champ}>
              <option value="" disabled>
                À choisir
              </option>
              <option value="F">Femme</option>
              <option value="M">Homme</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Naissance</span>
            <input name="birth_display" className={champ} />
            <span className="mt-1 block text-xs text-muted">
              « 1974 », « vers 1970 », ou rien du tout
            </span>
          </label>
        </>
      ) : (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Qui</span>
          <select name="conjoint_id" required defaultValue="" className={champ}>
            <option value="" disabled>
              Choisir une personne
            </option>
            {candidats.map((p) => (
              <option key={p.id} value={p.id}>
                {p.married_name && p.married_name !== p.last_name
                  ? `${p.first_name} ${p.married_name} (née ${p.last_name})`
                  : `${p.first_name} ${p.last_name}`}
                {p.birth_year ? ` — ${p.birth_year}` : ""}
              </option>
            ))}
          </select>
          {/* L'année de naissance est affichée pour cette raison précise : deux
              cousines peuvent porter le même prénom et le même nom, et seule la
              date les sépare. */}
          <span className="mt-1 block text-xs text-muted">
            L&apos;année de naissance distingue les homonymes
          </span>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Lien</span>
          <select name="kind" defaultValue="mariage" className={champ}>
            <option value="mariage">Mariage</option>
            {/* « En couple » et non « Union » : au moment de déclarer, le mot
                doit être celui qu'on emploie à table — « union » se lit comme
                un mariage, c'est même son sens courant. La valeur en base ne
                change pas. */}
            <option value="union">En couple (non mariés)</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Date</span>
          <input name="date_display" className={champ} placeholder="1998" />
        </label>
      </div>

      <button className="rounded-lg bg-accent px-5 py-3 font-medium text-sur-plein">
        Enregistrer
      </button>
    </form>
  );
}

function Choix({
  actif,
  onClick,
  titre,
  detail,
}: {
  actif: boolean;
  onClick: () => void;
  titre: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`rounded-lg border px-3 py-2.5 text-left ${
        actif ? "border-accent bg-accent-surface" : "border-line"
      }`}
    >
      <span className="block text-sm font-medium">{titre}</span>
      <span className="block text-xs text-muted">{detail}</span>
    </button>
  );
}
