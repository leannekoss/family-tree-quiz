import Link from "next/link";
import PhotoDansLaFiche from "./PhotoDansLaFiche";

export type Apparition = {
  /** Le repère lui-même — nécessaire pour pouvoir le dénommer. */
  markId: number;
  photoId: number;
  src: string;
  caption: string;
  taken: string | null;
  /** Où se trouve la personne sur la photo, en fraction de l'image. */
  x: number;
  y: number;
  /** Les autres personnes nommées sur la même photo. */
  avec: { id: string; nom: string }[];
};

/**
 * « On le voit aussi ici » — les photos de groupe où la personne est pointée.
 *
 * 🔑 Le portrait carré d'une fiche est un extrait : il garde le visage et jette
 * tout le reste — le jour, les gens autour, la maison derrière. Sur une photo
 * d'avant-guerre, c'est précisément ce reste qu'on regarde. La fiche montre
 * donc la photo ENTIÈRE, avec un cercle sur la personne, et non une vignette
 * recadrée de plus.
 *
 * Les autres présents sont nommés et cliquables : c'est ce qui fait passer
 * d'une fiche à l'autre, et c'est le geste qu'on veut provoquer — on arrive
 * pour son grand-père, on repart en ayant reconnu deux cousins.
 */
export default function SurLesPhotos({
  apparitions,
  personId,
  nom,
  prenom,
  aPhoto,
}: {
  apparitions: Apparition[];
  personId: string;
  nom: string;
  /** Le prénom seul fait le titre : « Christiane sur cette photo ». */
  prenom: string;
  aPhoto: boolean;
}) {
  if (apparitions.length === 0) return null;

  return (
    <section className="mt-8">
      {/* Le prénom porte le titre, et règle au passage le genre : « on la ou
          le voit ici » était une contorsion pour n'avoir pas à choisir, et se
          lisait comme du mauvais français. */}
      <h2 className="serif text-xl">
        {prenom} sur {apparitions.length > 1 ? "ces photos" : "cette photo"}
      </h2>
      {!aPhoto && (
        <p className="mt-1 text-sm text-accent">
          Sa fiche n&apos;a pas encore de portrait — il est sur cette photo, il
          suffit de le découper.
        </p>
      )}

      <div className="mt-3 space-y-5">
        {apparitions.map((a) => (
          <figure key={a.photoId}>
            <PhotoDansLaFiche
              markId={a.markId}
              photoId={a.photoId}
              personId={personId}
              nom={nom}
              prenom={prenom}
              aPhoto={aPhoto}
              src={a.src}
              caption={a.caption}
              x={a.x}
              y={a.y}
            />

            <figcaption className="mt-2 text-sm">
              <span className="text-muted">
                {a.caption}
                {a.taken && ` · ${a.taken}`}
              </span>
              {a.avec.length > 0 && (
                <span className="mt-1 block">
                  Avec{" "}
                  {a.avec.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && (i === a.avec.length - 1 ? " et " : ", ")}
                      <Link href={`/personne/${p.id}`} className="underline underline-offset-4">
                        {p.nom}
                      </Link>
                    </span>
                  ))}
                  .
                </span>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
