import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { NOM_FAMILLE, TITRE } from "@/lib/famille";

export const metadata = {
  title: "Crédits",
  robots: { index: false, follow: false },
};

type Credit = {
  person_id: string;
  personne: string;
  fichier: string;
  auteur: string;
  licence: string;
  url: string;
};

/**
 * D'où viennent les données et les portraits.
 *
 * Les fiches viennent de Wikidata, et les photos de Wikimedia Commons : chacune
 * a un auteur et une licence qui demandent d'être cités. Le fichier
 * `public/credits-photos.json` est écrit par l'import, cette page le lit.
 *
 * Lisible sans compte, comme « Où sont vos données » : un crédit qu'il faut
 * un mot de passe pour voir n'en est pas un.
 */
export default async function Credits() {
  let credits: Credit[] = [];
  try {
    const brut = await readFile(path.join(process.cwd(), "public", "credits-photos.json"), "utf8");
    credits = JSON.parse(brut);
  } catch {
    credits = [];
  }

  return (
    <article className="space-y-8 pb-8">
      <header>
        <h1 className="serif text-2xl font-semibold">Crédits</h1>
        <p className="mt-2 text-muted">
          Ce que {TITRE} doit à d&apos;autres.
        </p>
      </header>

      <section>
        <h2 className="serif text-lg font-semibold">Les données</h2>
        <p className="mt-2 text-sm">
          Les noms, les dates et les liens de parenté de la famille {NOM_FAMILLE}{" "}
          viennent de{" "}
          <a href="https://www.wikidata.org" className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">
            Wikidata
          </a>
          , sous licence CC0 (domaine public), complétés par ce que la famille ajoute ici.
        </p>
      </section>

      <section>
        <h2 className="serif text-lg font-semibold">Les photos</h2>
        {credits.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Aucun crédit photo pour l&apos;instant.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {credits.map((c) => (
              <li key={c.person_id} className="flex gap-2">
                <span aria-hidden className="text-muted">·</span>
                <span>
                  <Link href={`/personne/${c.person_id}`} className="underline underline-offset-4">
                    {c.personne}
                  </Link>
                  {" — "}
                  <a href={c.url} className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">
                    {c.fichier}
                  </a>
                  , {c.auteur}, {c.licence}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm">
        <Link href="/" className="underline underline-offset-4">
          Retour à l&apos;arbre
        </Link>
      </p>
    </article>
  );
}
