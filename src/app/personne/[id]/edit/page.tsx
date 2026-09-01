import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { fullName } from "@/lib/types";
import FilAriane from "@/components/FilAriane";
import Filiation from "@/components/Filiation";
import { savePerson } from "./actions";

export default async function Editer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();

  // La liste de TOUT LE MONDE ne part plus au navigateur. Elle pesait près d'un
  // mégaoctet depuis l'import des huit branches — pour deux champs qu'on
  // remplit en tapant trois lettres.
  const [{ data: person }, { data: branches }, { data: maisons }] = await Promise.all([
    supabase.from("people").select("*").eq("id", id).maybeSingle(),
    supabase.from("branches").select("id, name").order("name"),
    supabase.from("places").select("id, name, commune").order("name"),
  ]);

  if (!person) notFound();

  const [pere, mere] = await Promise.all([
    lireParent(supabase, person.father_id),
    lireParent(supabase, person.mother_id),
  ]);

  const save = savePerson.bind(null, id);

  return (
    <form action={save} className="space-y-5 pb-12">
      <FilAriane
        etapes={[
          { label: "Chercher", href: "/" },
          { label: fullName(person), href: `/personne/${id}` },
          { label: "Corriger" },
        ]}
      />
      <div>
        <h1 className="serif text-2xl font-semibold">{fullName(person)}</h1>
        <p className="mt-1 text-sm text-muted">
          Chaque modification est enregistrée avec votre nom et datée.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom">
          <input name="first_name" required defaultValue={person.first_name} className={input} />
        </Field>
        <Field label="Nom de naissance">
          <input name="last_name" required defaultValue={person.last_name} className={input} />
        </Field>
        <Field label="Nom d'usage">
          <input name="married_name" defaultValue={person.married_name ?? ""} className={input} />
        </Field>
        <Field label="Surnom">
          <input name="nickname" defaultValue={person.nickname ?? ""} className={input} />
        </Field>
      </div>

      <Field label="Sexe">
        <select name="sex" defaultValue={person.sex ?? ""} className={input}>
          <option value="">—</option>
          <option value="F">Femme</option>
          <option value="M">Homme</option>
        </select>
      </Field>

      <Field label="Naissance" hint="tel quel : « 12/03/1954 », « vers 1890 », « ? »">
        <input name="birth_display" defaultValue={person.birth_display ?? ""} className={input} />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="deceased" defaultChecked={person.deceased} className="size-4" />
        Décédé·e
      </label>

      <Field label="Décès" hint="laisser vide si la date est inconnue">
        <input name="death_display" defaultValue={person.death_display ?? ""} className={input} />
      </Field>

      <Filiation
        personneId={id}
        pereInitial={pere}
        mereInitial={mere}
        neEn={person.birth_year}
      />

      <p className="-mt-2 text-xs text-muted">
        Le père ou la mère n&apos;est pas encore dans l&apos;arbre ?{" "}
        <Link href={`/personne/${id}/parent`} className="underline underline-offset-4">
          Créez sa fiche
        </Link>
        .
      </p>

      <Field label="Branche">
        <select name="branch_id" defaultValue={person.branch_id ?? ""} className={input}>
          <option value="">—</option>
          {(branches ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>

      {/* Le rattachement à une maison n'existait que dans le relevé du bulletin :
          personne ne pouvait s'y ajouter, ni s'en retirer. C'est pourtant ce qui
          fait vivre la carte — et ce qui manque en premier quand une maison
          change de mains. */}
      <Field label="Maison" hint="celle de la carte des maisons">
        <select name="place_id" defaultValue={person.place_id ?? ""} className={input}>
          <option value="">—</option>
          {(maisons ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.commune ? ` · ${m.commune}` : ""}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Précision sur la maison"
        hint="« la grange », « l'été seulement » — laissé libre"
      >
        <input
          name="place_detail"
          defaultValue={person.place_detail ?? ""}
          className={input}
        />
      </Field>

      {/* « Notes » ne demandait rien, donc personne n'écrivait rien : sur
          quatre cent soixante-sept fiches, ce champ ne servait qu'aux quelques
          précisions documentaires des aïeux.

          Ce qu'on veut savoir d'un cousin qu'on va croiser en juin, ce n'est
          pas une note : c'est son métier, ce qu'il aime, ce qui fait qu'on le
          reconnaîtra. Le champ ne change pas — l'invitation, si. Un exemple
          vaut mieux qu'une consigne : il montre la longueur attendue autant
          que le contenu. */}
      <Field
        label="En deux mots"
        hint="Son métier, ses passions, ce qui la ou le fait reconnaître — « kiné à Bordeaux, court des trails, fait le meilleur gâteau aux noix »"
      >
        <textarea
          name="notes"
          rows={4}
          defaultValue={person.notes ?? ""}
          placeholder="Ce qu'on aimerait savoir avant de la ou le croiser en juin."
          className={input}
        />
      </Field>

      <div className="flex gap-3">
        <button className="rounded-lg bg-accent px-5 py-3 font-medium text-sur-plein">
          Enregistrer
        </button>
        <Link
          href={`/personne/${id}`}
          className="rounded-lg border border-line px-5 py-3"
        >
          Annuler
        </Link>
      </div>
    </form>
  );
}

const input =
  "w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-accent";

/** Le parent déjà enregistré, pour l'afficher sans faire chercher qui que ce soit. */
async function lireParent(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  parentId: string | null,
) {
  if (!parentId) return null;
  const { data } = await supabase
    .from("people")
    .select("id, first_name, last_name, married_name, sex, birth_year")
    .eq("id", parentId)
    .maybeSingle();
  return data ? { id: data.id, label: fullName(data), annee: data.birth_year } : null;
}

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
