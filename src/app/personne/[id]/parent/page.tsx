import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { fullName } from "@/lib/types";
import FilAriane from "@/components/FilAriane";
import { ajouterParent } from "./actions";

/**
 * Ajouter le père ou la mère de quelqu'un — en CRÉANT sa fiche.
 *
 * « Corriger » savait choisir un parent parmi les fiches existantes ; rien ne
 * savait en créer un. On pouvait descendre l'arbre (ajouter un enfant), jamais
 * le remonter — or c'est en remontant que la famille complète les pièces
 * rapportées et les branches que le bulletin n'a pas suivies.
 *
 * Le formulaire ne montre que les rôles VACANTS : proposer d'ajouter un père à
 * qui en a déjà un fabriquerait des doublons. Quand les deux sont là, la page
 * le dit et renvoie vers « Corriger », qui sert à remplacer.
 */
export default async function AjouterUnParent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const [{ data: enfant }, { data: branches }] = await Promise.all([
    supabase.from("people").select("*").eq("id", id).maybeSingle(),
    supabase.from("branches").select("id, name").order("name"),
  ]);
  if (!enfant) notFound();

  const manque: ("pere" | "mere")[] = [];
  if (!enfant.father_id) manque.push("pere");
  if (!enfant.mother_id) manque.push("mere");

  const save = ajouterParent.bind(null, id);

  return (
    <div className="pb-12">
      <FilAriane
        etapes={[
          { label: "Chercher", href: "/" },
          { label: fullName(enfant), href: `/personne/${id}` },
          { label: "Ajouter un parent" },
        ]}
      />
      <h1 className="serif text-2xl font-semibold">
        Les parents de {enfant.first_name}
      </h1>

      {manque.length === 0 ? (
        <div className="mt-4 rounded-xl border border-line bg-card p-4 text-sm">
          <p>
            Les deux parents de {enfant.first_name} sont déjà dans l&apos;arbre.
            Pour en remplacer un,{" "}
            <Link href={`/personne/${id}/edit`} className="underline underline-offset-4">
              corrigez la fiche
            </Link>
            .
          </p>
        </div>
      ) : (
        <form action={save} className="mt-4 space-y-4">
          <p className="text-sm text-muted">
            La fiche sera créée et rattachée d&apos;un coup. Si le parent est
            déjà quelque part dans l&apos;arbre, passez plutôt par{" "}
            <Link href={`/personne/${id}/edit`} className="underline underline-offset-4">
              Corriger
            </Link>{" "}
            pour le choisir sans créer de doublon.
          </p>

          <Champ label="Qui ajoutez-vous ?">
            <select name="role" className={input} defaultValue={manque[0]}>
              {manque.includes("pere") && <option value="pere">Son père</option>}
              {manque.includes("mere") && <option value="mere">Sa mère</option>}
            </select>
          </Champ>

          <div className="grid grid-cols-2 gap-3">
            <Champ label="Prénom">
              <input name="first_name" required className={input} />
            </Champ>
            {/* Le nom de l'enfant en valeur par défaut : c'est le cas le plus
                fréquent pour un père, et une valeur juste à 80 % qu'on peut
                corriger bat un champ vide à 100 %. */}
            <Champ label="Nom de naissance">
              <input name="last_name" required defaultValue={enfant.last_name} className={input} />
            </Champ>
          </div>

          <Champ label="Naissance" hint="tel quel : « 12/03/1932 », « vers 1900 », ou rien">
            <input name="birth_display" className={input} />
          </Champ>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="deceased" value="1" className="size-4" />
            Décédé·e
          </label>

          <Champ label="Décès" hint="laisser vide si la date est inconnue">
            <input name="death_display" className={input} />
          </Champ>

          <Champ label="Branche" hint="celle de l'enfant est proposée">
            <select name="branch_id" defaultValue={enfant.branch_id ?? ""} className={input}>
              <option value="">—</option>
              {(branches ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Champ>

          {/* Hérité de l'enfant, comme pour les enfants : les parents d'un
              collatéral le sont aussi, sinon le quiz demande de deviner des
              gens que personne n'a jamais vus. */}
          <input type="hidden" name="collateral" value={enfant.collateral ? "1" : "0"} />

          <div className="flex gap-3">
            <button className="rounded-lg bg-accent px-5 py-3 font-medium text-sur-plein">
              Créer et rattacher
            </button>
            <Link href={`/personne/${id}`} className="rounded-lg border border-line px-5 py-3">
              Annuler
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

const input =
  "w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-accent";

function Champ({
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
