import { Fragment } from "react";

/**
 * Le texte libre d'une fiche, avec ses liens cliquables.
 *
 * 🔑 Les notes portent désormais des sources : une fiche Mémoire des hommes, un
 * registre matricule numérisé, un acte. Affichées en texte brut, ces adresses
 * étaient illisibles et surtout inutilisables — on ne recopie pas à la main
 * `ark:/34204/K7PPTLE1MTcwNDawsDQAAA__` depuis un téléphone. Or c'est
 * précisément le document original qui donne sa valeur à la note.
 *
 * 🔑 Découpage par expression régulière et rendu en éléments React, jamais
 * d'insertion de HTML : le texte vient de la famille, il ne doit à aucun moment
 * pouvoir devenir du balisage.
 */
export default function Notes({ texte }: { texte: string }) {
  // Les segments impairs sont les adresses — c'est la parenthèse capturante
  // qui les conserve dans le découpage.
  const bouts = texte.split(/(https?:\/\/\S+)/g);

  return (
    <p className="mt-6 whitespace-pre-line rounded-xl border border-line bg-card p-4 text-sm">
      {bouts.map((bout, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{bout}</Fragment>;

        // Une phrase se termine par un point, pas l'adresse qui la précède.
        const fin = bout.match(/[.,;)]+$/)?.[0] ?? "";
        const url = fin ? bout.slice(0, -fin.length) : bout;

        return (
          <Fragment key={i}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-accent underline underline-offset-4"
            >
              {/* L'adresse entière déborderait de l'écran : on montre le site,
                  qui est la seule partie qu'un lecteur reconnaît. Extrait par
                  découpage et non par `new URL`, qui lèverait sur une adresse
                  mal formée — et ferait tomber toute la fiche. */}
              {url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
            </a>
            {fin}
          </Fragment>
        );
      })}
    </p>
  );
}
