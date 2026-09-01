import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { fullName } from "@/lib/types";
import FilAriane from "@/components/FilAriane";
import { ajouterEnfant } from "./actions";

/**
 * Ajouter un enfant depuis la fiche de son parent.
 *
 * Le site savait corriger une fiche, pas en créer une : toute la descendance
 * qui n'était pas dans le bulletin restait hors de l'arbre. Or c'est
 * exactement ce que la famille peut apporter et que le bulletin ne saura
 * jamais — les enfants nés depuis décembre 2025, et les branches que le Moulin
 * n'a jamais suivies.
 *
 * Ce formulaire ne demande que ce que personne ne peut deviner. Le nom, le
 * second parent, la branche et le statut de collatéral se déduisent du parent
 * d'où l'on vient ; les redemander ferait abandonner à la deuxième fiche.
 */
export default async function AjouterEnfant({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ajoute?: string }>;
}) {
  const { id } = await params;
  const { ajoute } = await searchParams;
  const supabase = await supabaseServer();

  const [{ data: parent }, { data: unions }, { data: enfants }, { data: tous }] =
    await Promise.all([
      supabase.from("people").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("unions")
        .select("p1:p1_id(id, first_name, last_name, married_name, sex), p2:p2_id(id, first_name, last_name, married_name, sex)")
        .or(`p1_id.eq.${id},p2_id.eq.${id}`),
      supabase
        .from("people")
        .select("id, first_name, last_name, birth_display")
        .or(`father_id.eq.${id},mother_id.eq.${id}`)
        .order("birth_year", { nullsFirst: false }),
      // L'autre parent n'est pas forcément le conjoint enregistré : un enfant
      // d'une union précédente a une mère ou un père qui figure parfois dans
      // l'arbre sans y être rattaché à celui-ci.
      supabase
        .from("people")
        .select("id, first_name, last_name, married_name, sex, birth_year")
        .order("last_name"),
    ]);

  if (!parent) notFound();

  const conjoints = (unions ?? [])
    .map((u) => (u.p1?.id === id ? u.p2 : u.p1))
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // Tout le monde sauf le parent d'où l'on vient et ses conjoints, déjà
  // proposés au-dessus. Un même nom deux fois dans une liste déroulante fait
  // douter d'avoir choisi le bon.
  const dejaProposes = new Set([id, ...conjoints.map((c) => c.id)]);
  const autres = (tous ?? []).filter((p) => !dejaProposes.has(p.id));

  const parentEstPere = parent.sex !== "F";

  // Le nom de l'enfant suit le père dans l'immense majorité des cas. Quand on
  // arrive par la fiche de la mère, c'est donc le nom du conjoint qu'il faut
  // proposer — et son nom de naissance à elle, sinon.
  const pere = parentEstPere ? parent : conjoints.find((c) => c.sex === "M");
  const nomPropose = pere?.last_name ?? parent.last_name;

  const ajouter = ajouterEnfant.bind(null, id);

  return (
    <div className="pb-12">
      <FilAriane
        etapes={[
          { label: "Chercher", href: "/" },
          { label: fullName(parent), href: `/personne/${id}` },
          { label: "Ajouter un enfant" },
        ]}
      />

      <h1 className="serif text-2xl font-semibold">
        Un enfant de {fullName(parent)}
      </h1>
      <p className="mt-1 text-sm text-muted">
        Le prénom suffit. Tout le reste se corrige plus tard, et rien ne se perd :
        la création est datée, signée, et figure au journal.{" "}
        {/* Dit ici plutôt que découvert au moment de valider : c'est en lisant
            « un enfant de Laurent » qu'on se demande si on peut ajouter sa fille
            d'un premier mariage. La réponse doit arriver à ce moment-là. */}
        <strong>
          Un enfant d&apos;une autre union se rattache au seul parent que vous
          connaissez
        </strong>{" "}
        — laissez « personne d&apos;autre » comme second parent.
      </p>

      {/* La confirmation reste à l'écran pendant qu'on saisit le suivant :
          c'est elle qui dit « ça a marché, continuez ». */}
      {ajoute && (
        <p className="mt-4 rounded-xl border border-accent-line bg-accent-surface px-4 py-3 text-sm">
          <strong>{ajoute}</strong> est enregistré·e. Au suivant, ou{" "}
          <Link href={`/personne/${id}`} className="underline underline-offset-4">
            retour à la fiche
          </Link>
          .
        </p>
      )}

      {enfants && enfants.length > 0 && (
        <p className="mt-4 text-sm text-muted">
          Déjà dans l&apos;arbre :{" "}
          {enfants.map((e, i) => (
            <span key={e.id}>
              {i > 0 && ", "}
              <Link href={`/personne/${e.id}`} className="underline underline-offset-4">
                {e.first_name}
              </Link>
            </span>
          ))}
        </p>
      )}

      <form action={ajouter} className="mt-6 space-y-5">
        <input type="hidden" name="parent_est_pere" value={parentEstPere ? "1" : "0"} />
        <input type="hidden" name="branch_id" value={parent.branch_id ?? ""} />
        <input type="hidden" name="collateral" value={parent.collateral ? "1" : "0"} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom">
            <input name="first_name" required autoFocus className={input} />
          </Field>
          <Field label="Nom de naissance">
            <input name="last_name" required defaultValue={nomPropose} className={input} />
          </Field>
        </div>

        {/* Demandé, jamais deviné : sans lui, toute la page parle en « né·e » et
            en « cousin·e », et une famille de deux cents personnes mérite mieux
            que des points médians partout. */}
        <Field label="Fille ou garçon">
          <select name="sex" required defaultValue="" className={input}>
            <option value="" disabled>
              À choisir
            </option>
            <option value="F">Fille</option>
            <option value="M">Garçon</option>
          </select>
        </Field>

        <Field label="Naissance" hint="tel quel : « 12/03/1954 », « vers 1990 », ou rien du tout">
          <input name="birth_display" className={input} />
        </Field>

        <Field
          label="Autre parent"
          hint={
            conjoints.length === 1
              ? // Le pré-remplissage est juste dans le cas courant et faux dans
                // un cas fréquent : l'enfant d'une union précédente. Une erreur
                // silencieuse — la fiche paraît correcte, et l'enfant se
                // retrouve rattaché à quelqu'un qui n'est pas son parent. Le
                // seul remède est de nommer la personne présélectionnée.
                `${fullName(conjoints[0])} est déjà choisi·e. Si l'enfant vient d'une autre union, changez ce champ.`
              : conjoints.length === 0
                ? "aucun conjoint n'est renseigné ici — laissez « personne d'autre » si vous ne savez pas"
                : "rattacher les deux parents évite que l'enfant manque à la fratrie de l'autre côté"
          }
        >
          <select
            name="autre_parent"
            className={input}
            defaultValue={conjoints.length === 1 ? conjoints[0].id : ""}
          >
            {/* « — » ne disait pas que c'était un choix légitime. Un enfant
                d'une précédente union n'a souvent qu'un seul parent dans
                l'arbre, et c'est très bien ainsi. */}
            <option value="">Personne d&apos;autre, ou pas dans l&apos;arbre</option>
            {conjoints.length > 0 && (
              <optgroup label="Conjoint·e">
                {conjoints.map((c) => (
                  <option key={c.id} value={c.id}>
                    {fullName(c)}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Quelqu'un d'autre de l'arbre">
              {autres.map((p) => (
                <option key={p.id} value={p.id}>
                  {fullName(p)}
                  {p.birth_year ? ` (${p.birth_year})` : ""}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>

        <div className="flex flex-wrap gap-3">
          <button className="rounded-lg bg-accent px-5 py-3 font-medium text-sur-plein">
            Enregistrer
          </button>
          <Link href={`/personne/${id}`} className="rounded-lg border border-line px-5 py-3">
            Terminé
          </Link>
        </div>
      </form>
    </div>
  );
}

const input =
  "w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-accent";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
