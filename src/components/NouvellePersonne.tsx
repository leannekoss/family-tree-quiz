"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fullName } from "@/lib/types";
import ChercherPersonne, { type Choix, type Trouve } from "./ChercherPersonne";

/**
 * Créer quelqu'un que l'arbre ne connaît pas encore.
 *
 * Deux garde-fous, et ils ne se valent pas.
 *
 * 🔑 Le premier — « avez-vous vérifié que cette personne n'existe pas déjà ? »
 * — était demandé sous forme de case à cocher. Une case de ce genre se coche
 * sans être lue : elle déplace la responsabilité sans rien empêcher. Elle est
 * remplacée par la recherche des homonymes PENDANT la frappe. Montrer « Marie
 * Dupont (1954) existe déjà » arrête ; demander de confirmer qu'on a regardé,
 * non.
 *
 * Le second est structurel : le rattachement est OBLIGATOIRE. L'arbre se
 * dessine par les liens — une fiche sans père, sans mère, sans conjoint et
 * sans enfant n'apparaît ni dans l'arbre, ni dans une fratrie, ni dans le
 * calcul de parenté, ni dans le quiz. Elle n'existe que pour qui tape son nom
 * exact. Autoriser sa création, ce serait laisser quelqu'un travailler pour
 * rien en le croyant utile.
 */

type Role = "enfant_de" | "parent_de" | "conjoint_de" | "frere_soeur_de";

const ROLES: { valeur: Role; libelle: (prenom: string) => string }[] = [
  { valeur: "enfant_de", libelle: (p) => `${p} est l'enfant de…` },
  { valeur: "parent_de", libelle: (p) => `${p} est le père ou la mère de…` },
  { valeur: "conjoint_de", libelle: (p) => `${p} est en couple avec…` },
  { valeur: "frere_soeur_de", libelle: (p) => `${p} est le frère ou la sœur de…` },
];

export default function NouvellePersonne({
  nomCherche,
  branches,
}: {
  /** Ce que la personne venait de chercher sans le trouver. */
  nomCherche: string;
  branches: { id: number; name: string }[];
}) {
  // Le nom cherché est découpé au premier espace : « marie dupont » remplit les
  // deux champs, « dupont » ne remplit que le nom. On ne demande pas de
  // retaper ce qui vient d'être tapé.
  const [prenomInitial, nomInitial] = useMemo(() => decouper(nomCherche), [nomCherche]);
  const [prenom, setPrenom] = useState(prenomInitial);
  const [nom, setNom] = useState(nomInitial);
  const [sexe, setSexe] = useState("");
  const [role, setRole] = useState<Role>("enfant_de");
  const [cible, setCible] = useState<Choix | null>(null);

  const homonymes = useHomonymes(prenom, nom);
  const appelation = prenom.trim() || "Cette personne";

  // Le bouton reste inerte tant que le lien manque : c'est le seul moyen sûr
  // qu'aucune fiche invisible n'entre dans l'arbre. Le dire vaut mieux que de
  // le laisser deviner — un bouton grisé sans explication se lit comme une
  // panne du site.
  const complet = prenom.trim() !== "" && nom.trim() !== "" && cible !== null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Champ label="Prénom">
          <input
            name="first_name"
            required
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            className={input}
          />
        </Champ>
        <Champ label="Nom de naissance">
          <input
            name="last_name"
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className={input}
          />
        </Champ>
      </div>

      {homonymes.length > 0 && (
        <div className="rounded-xl border border-alerte bg-card p-3">
          <p className="text-sm font-medium">
            {homonymes.length === 1
              ? "Quelqu'un porte déjà ce nom dans l'arbre :"
              : `${homonymes.length} personnes portent déjà ce nom dans l'arbre :`}
          </p>
          <ul className="mt-2 space-y-1">
            {homonymes.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/personne/${h.id}`}
                  className="text-sm underline underline-offset-4"
                >
                  {fullName(h)}
                  {h.birth_display ? ` (${h.birth_display})` : ""}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Si c&apos;est la même personne, ouvrez sa fiche et complétez-la
            plutôt que d&apos;en créer une seconde : deux fiches pour quelqu&apos;un
            coupent l&apos;arbre en deux à cet endroit.
          </p>
        </div>
      )}

      <Champ label="Sexe" indice="il décide du rôle de parent, et de l'accord des phrases">
        <select
          name="sex"
          value={sexe}
          onChange={(e) => setSexe(e.target.value)}
          className={input}
        >
          <option value="">—</option>
          <option value="F">Femme</option>
          <option value="M">Homme</option>
        </select>
      </Champ>

      <Champ label="Naissance" indice="tel quel : « 12/03/1954 », « vers 1890 », ou rien">
        <input name="birth_display" className={input} />
      </Champ>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="deceased" value="1" className="size-4" />
        Décédé·e
      </label>

      <Champ label="Décès" indice="laisser vide si la date est inconnue">
        <input name="death_display" className={input} />
      </Champ>

      <Champ label="Branche">
        <select name="branch_id" className={input}>
          <option value="">—</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Champ>

      <div className="rounded-xl border border-accent-line bg-card p-3">
        <p className="text-sm font-medium">Qui est-{elle(sexe)} dans la famille ?</p>
        <p className="mt-1 text-xs text-muted">
          L&apos;arbre se dessine par les liens. Sans rattachement, la fiche
          n&apos;apparaîtrait ni dans l&apos;arbre, ni dans une fratrie, ni dans le
          quiz — seulement pour qui taperait son nom exact.
        </p>

        <input type="hidden" name="role" value={role} />
        <div className="mt-3 space-y-1.5">
          {ROLES.map((r) => (
            <label key={r.valeur} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={role === r.valeur}
                onChange={() => {
                  setRole(r.valeur);
                  setCible(null);
                }}
                className="size-4"
              />
              {r.libelle(appelation)}
            </label>
          ))}
        </div>

        <div className="mt-3">
          <ChercherPersonne
            name="cible_id"
            placeholder="Chercher cette personne dans l'arbre"
            choisi={cible}
            onChoisir={setCible}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <BoutonCreer complet={complet} />
        <Link href="/" className="rounded-lg border border-line px-5 py-3">
          Annuler
        </Link>
      </div>

      {!complet && (
        <p className="text-sm text-muted">
          {cible === null
            ? "Choisissez d'abord à qui rattacher cette personne."
            : "Le prénom et le nom sont nécessaires."}
        </p>
      )}
    </div>
  );
}

/** « Qui est-elle » / « Qui est-il », et la forme neutre quand on ne sait pas. */
const elle = (sexe: string) => (sexe === "M" ? "il" : sexe === "F" ? "elle" : "il·elle");

/** « marie dupont » → [« Marie », « Dupont »] · « dupont » → [« », « Dupont »]. */
function decouper(cherche: string): [string, string] {
  const mots = cherche.trim().split(/\s+/).filter(Boolean);
  const majuscule = (m: string) => m.charAt(0).toUpperCase() + m.slice(1);
  if (mots.length === 0) return ["", ""];
  if (mots.length === 1) return ["", majuscule(mots[0])];
  return [mots.slice(0, -1).map(majuscule).join(" "), majuscule(mots[mots.length - 1])];
}

/**
 * Les personnes déjà là qui portent ce nom.
 *
 * On cherche sur le NOM DE FAMILLE seul, pas sur « prénom + nom » : le doublon
 * qu'on veut attraper s'appelle souvent autrement à l'état civil — dans cette
 * famille le prénom d'usage n'est presque jamais le premier prénom (Hélène =
 * Jacqueline Isabelle Hélène). Chercher les deux ensemble laisserait passer
 * exactement les doublons qu'on redoute.
 */
function useHomonymes(prenom: string, nom: string) {
  const [trouves, setTrouves] = useState<Trouve[]>([]);
  const dernier = useRef(0);

  const terme = useMemo(
    () =>
      nom
        .trim()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase(),
    [nom],
  );

  useEffect(() => {
    if (terme.length < 2) {
      setTrouves([]);
      return;
    }
    const t = setTimeout(async () => {
      const appel = ++dernier.current;
      const { data } = await supabaseBrowser()
        .from("people")
        .select("id, first_name, last_name, married_name, birth_display, birth_year, sex")
        .ilike("search_text", `%${terme}%`)
        .limit(12);
      if (appel !== dernier.current) return;
      setTrouves(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [terme]);

  // Le prénom ne filtre pas, il ORDONNE : les homonymes exacts d'abord, le
  // reste du patronyme ensuite. C'est ce qui montre « Marie Dupont » en tête
  // sans cacher « Marie-Claire Dupont », qui est peut-être la même personne.
  const debut = prenom.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return useMemo(() => {
    if (!debut) return trouves;
    const proche = (p: Trouve) =>
      p.first_name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(debut);
    return [...trouves].sort((a, b) => Number(proche(b)) - Number(proche(a)));
  }, [trouves, debut]);
}

const input =
  "w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-accent";

function Champ({
  label,
  indice,
  children,
}: {
  label: string;
  indice?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {indice && <span className="mt-1 block text-xs text-muted">{indice}</span>}
    </label>
  );
}

/**
 * Le bouton « Créer la fiche », muet pendant l'envoi — et c'est ce qui a créé
 * un doublon.
 *
 * 🔑 Le 22/08/2026, deux fiches « Léonie Morel » identiques, à CINQ SECONDES
 * d'écart. Ce n'est pas un double-clic nerveux : la personne a cliqué, l'écran
 * n'a rien montré le temps de l'aller-retour vers le serveur, elle a attendu,
 * puis elle a recliqué. Un formulaire qui ne dit pas qu'il travaille demande à
 * être cliqué deux fois.
 *
 * `useFormStatus` doit vivre dans un composant ENFANT du `<form>` : appelé dans
 * le composant qui rend le formulaire, il ne voit rien et renvoie toujours
 * `pending: false`. C'est la raison d'être de ce petit composant séparé.
 *
 * Le libellé change en même temps que l'état : griser sans rien dire laisse
 * croire à une panne, alors que « Création… » se lit comme une attente normale.
 */
function BoutonCreer({ complet }: { complet: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={!complet || pending}
      className="rounded-lg bg-accent px-5 py-3 font-medium text-sur-plein disabled:opacity-50"
    >
      {pending ? "Création…" : "Créer la fiche"}
    </button>
  );
}
