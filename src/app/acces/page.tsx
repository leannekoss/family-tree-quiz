import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import InviteForm from "@/components/InviteForm";
import ReglageAcces from "@/components/ReglageAcces";
import { retirer } from "./actions";
import GenererVignettes from "@/components/GenererVignettes";

export const dynamic = "force-dynamic";

export default async function Acces() {
  const supabase = await supabaseServer();

  const { data: me } = await supabase
    .from("members")
    .select("user_id, is_admin")
    .maybeSingle();

  if (!me) redirect("/rejoindre");
  // Page introuvable plutôt qu'accès refusé : un membre ordinaire n'a pas à
  // savoir qu'il existe une page de gestion.
  if (!me.is_admin) notFound();

  const [{ data: emails }, { data: code }, { data: reglages }] = await Promise.all([
    supabase.from("allowed_emails").select("email, note, added_at").order("added_at"),
    supabase.rpc("invite_code"),
    supabase.from("app_config").select("key, value"),
  ]);

  const ouvert =
    (reglages ?? []).find((r) => r.key === "acces_ouvert")?.value === "oui";

  // L'adresse vient de la requête : elle suit le domaine réel, y compris en
  // aperçu de déploiement, plutôt qu'une URL figée dans le code.
  const host = (await headers()).get("host") ?? "votre-arbre.vercel.app";
  const lien = `https://${host}/rejoindre?code=${code ?? ""}`;

  return (
    <div>
      <header className="mb-6">
        <h1 className="serif text-2xl font-semibold">Qui peut entrer</h1>
        <p className="mt-1 text-muted">
          {ouvert
            ? "Le code famille suffit à entrer : la liste ci-dessous se remplit toute seule à mesure que les gens arrivent. Retirer une adresse coupe l'accès immédiatement, même si la personne est connectée."
            : "Seules les adresses inscrites ici, avec le code famille, ouvrent l'arbre. Retirer une adresse coupe l'accès immédiatement, même si la personne est connectée."}
        </p>
      </header>

      <ReglageAcces codeActuel={code ?? ""} ouvert={ouvert} />

      <InviteForm lien={lien} />

      <section className="mt-10">
        <h2 className="serif mb-3 text-lg">
          {emails?.length ?? 0} adresse{(emails?.length ?? 0) > 1 ? "s" : ""} autorisée
          {(emails?.length ?? 0) > 1 ? "s" : ""}
        </h2>
        <ul className="divide-y divide-line">
          {(emails ?? []).map((e) => (
            <li key={e.email} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <span className="min-w-0 flex-1 break-all">{e.email}</span>
              {e.note && <span className="text-sm text-muted">{e.note}</span>}
              <form action={retirer}>
                <input type="hidden" name="email" value={e.email} />
                <button className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted">
                  Retirer
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <GenererVignettes />
    </div>
  );
}
