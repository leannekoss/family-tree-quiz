import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { fullName } from "@/lib/types";
import FilAriane from "@/components/FilAriane";
import FormConjoint from "@/components/FormConjoint";
import { ajouterConjoint } from "./actions";

/**
 * Déclarer un mariage ou une union.
 *
 * Le troisième trou de la même famille que les enfants et les maisons : la base
 * l'autorisait depuis le début, aucun écran ne le permettait. On pouvait donc
 * corriger une date de naissance mais pas dire que quelqu'un s'était marié —
 * alors que c'est le premier changement que la vie apporte à un arbre.
 */
export default async function AjouterConjoint({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const [{ data: personne }, { data: unions }, { data: tous }] = await Promise.all([
    supabase.from("people").select("id, first_name, last_name, married_name, sex").eq("id", id).maybeSingle(),
    supabase
      .from("unions")
      .select("kind, date_display, p1:p1_id(id, first_name, last_name, married_name, sex), p2:p2_id(id, first_name, last_name, married_name, sex)")
      .or(`p1_id.eq.${id},p2_id.eq.${id}`),
    supabase
      .from("people")
      .select("id, first_name, last_name, married_name, birth_year, sex")
      .order("last_name"),
  ]);

  if (!personne) notFound();

  const dejaUnis = (unions ?? [])
    .map((u) => (u.p1?.id === id ? u.p2 : u.p1))
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // Ni la personne elle-même, ni ceux à qui elle est déjà unie : les reproposer
  // n'aboutirait qu'à un doublon silencieux.
  const exclus = new Set([id, ...dejaUnis.map((c) => c.id)]);
  const candidats = (tous ?? []).filter((p) => !exclus.has(p.id));

  const enregistrer = ajouterConjoint.bind(null, id);

  return (
    <div className="pb-12">
      <FilAriane
        etapes={[
          { label: "Chercher", href: "/" },
          { label: fullName(personne), href: `/personne/${id}` },
          { label: "Ajouter un conjoint" },
        ]}
      />

      <h1 className="serif text-2xl font-semibold">
        Le mariage de {fullName(personne)}
      </h1>
      <p className="mt-1 text-sm text-muted">
        Un prénom et un nom suffisent. Le reste se complétera sur sa fiche, et
        rien ne se perd : la création est datée, signée, et figure au journal.
      </p>

      {dejaUnis.length > 0 && (
        <p className="mt-4 text-sm text-muted">
          Déjà uni·e à{" "}
          {dejaUnis.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ", "}
              <Link href={`/personne/${c.id}`} className="underline underline-offset-4">
                {fullName(c)}
              </Link>
            </span>
          ))}
          . Un remariage s&apos;ajoute par-dessus, les deux resteront.
        </p>
      )}

      <FormConjoint
        action={enregistrer}
        candidats={candidats ?? []}
        nom={personne.first_name}
      />

      <p className="mt-6 text-sm">
        <Link href={`/personne/${id}`} className="underline underline-offset-4">
          Revenir à la fiche sans rien changer
        </Link>
      </p>
    </div>
  );
}
