import { Fragment } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import BoutonRetour from "@/components/BoutonRetour";
import { couleurDeId } from "@/lib/branches";
import { shortName, lifeSpan, ageLisible, parAinesse } from "@/lib/types";

type Node = {
  id: string;
  first_name: string;
  last_name: string;
  married_name?: string | null;
  birth_display?: string | null;
  death_display?: string | null;
  deceased?: boolean;
  photo_url?: string | null;
  branch_id?: number | null;
  tag?: string | null;
  /** 'mariage' ou 'union' — porté par les conjoints seulement. */
  kind?: string | null;
};

/**
 * Sablier trois générations centré sur une personne. Chaque carte recentre
 * l'arbre — c'est la navigation, il n'y a pas de vue globale.
 *
 * L'ordre vertical dit le temps : parents en haut, la personne et son conjoint
 * au milieu, la fratrie juste à côté d'eux puisqu'elle est de la même
 * génération, les enfants en bas. Une lecture de haut en bas descend les
 * générations sans qu'on ait à l'expliquer.
 */
export default function LocalTree({
  person,
  parents,
  siblings,
  spouses,
  children,
  photos,
}: {
  person: Node;
  parents: Node[];
  siblings: Node[];
  spouses: Node[];
  children: Node[];
  photos: Map<string, string>;
}) {
  const shared = { photos };

  return (
    <div className="rounded-xl border border-line bg-card px-3 py-5">
      <Row label="Parents" nodes={parents} direction="up" {...shared} />
      {parents.length > 0 && <Descente />}

      {/* La personne et son conjoint côte à côte, reliés par l'anneau. Sans ce
          signe, un conjoint posé à côté se lit comme un frère : même taille,
          même cadre, même rangée.

          L'anneau est posé DANS la rangée, pas dans un conteneur qui
          envelopperait la carte : la largeur des cartes vaut « la moitié de la
          rangée », et une carte enfermée dans une boîte intermédiaire calculait
          sa moitié sur cette boîte-là. Le conjoint tombait à 65 px sur un
          téléphone — assez pour rogner « Eric Degrémont » — alors que tout
          paraissait juste sur un écran large, où la contrainte ne mord pas. */}
      {/* Frères, sœurs et conjoint dans UNE seule rangée, avec la personne.
          Ils étaient dans une rangée à part, posée sous elle et juste au-dessus
          du trait qui descend vers les enfants : on lisait donc la sœur de Yann
          comme sa fille. Trois signes disaient « descendance » à la fois — la
          position en dessous, le trait qui suivait, et la taille identique aux
          cartes d'enfants.

          Une génération se lit sur une ligne. C'est ainsi qu'on la dessine sur
          un arbre papier, et c'est la seule disposition qui ne demande aucune
          explication. */}
      {siblings.length > 0 && (
        <p className="mb-2 text-center text-xs uppercase tracking-wide text-muted">
          Sa génération
        </p>
      )}
      {/* La rangée se lit de l'aîné au benjamin, la personne courante prenant
          sa place dans l'ordre plutôt que la première : c'est ainsi qu'on
          dessine une fratrie à la main, et c'est la seule disposition qui
          répond sans un mot à « lequel est le grand ? ». Ses conjoints la
          suivent immédiatement, où qu'elle tombe — l'anneau ⚭ ne vaut que
          collé à elle. */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {[person, ...siblings].sort(parAinesse).map((n) =>
          n.id === person.id ? (
            // Le couple prend SA PROPRE LIGNE dans la rangée dès qu'il y a un
            // conjoint. L'ancien réglage faisait partager au trio « l'espace
            // restant » à côté des frères et sœurs : pensé pour un conjoint,
            // il écrasait les cartes dès le deuxième — Jacqueline et ses deux
            // compagnons tenaient dans une colonne, noms tronqués à
            // « cqueli ». `basis-full` garde l'ordre d'aînesse : la ligne se
            // brise autour du couple, elle ne le déplace pas.
            <div
              key={n.id}
              className={
                spouses.length > 0
                  ? "flex basis-full flex-wrap items-center justify-center gap-2"
                  : "contents"
              }
            >
              <Card node={person} current partage={spouses.length > 0} {...shared} />
              {spouses.map((s) => (
                <Fragment key={s.id}>
                  {/* ⚭ est le symbole du mariage : le poser entre deux
                      personnes qui vivent ensemble sans être mariées leur
                      prête une situation qu'elles n'ont pas choisie.
                      L'esperluette dit le couple sans rien affirmer de plus. */}
                  <span
                    aria-hidden
                    className="serif shrink-0 text-lg text-muted"
                    title={s.kind === "union" ? "en couple avec" : "marié à"}
                  >
                    {s.kind === "union" ? "&" : "⚭"}
                  </span>
                  <Card node={s} partage {...shared} />
                </Fragment>
              ))}
            </div>
          ) : (
            <Card key={n.id} node={n} {...shared} />
          ),
        )}
      </div>

      {children.length > 0 && <Descente />}
      {/* « Enfants » tout court laissait le doute sur le parent : nommer la
          personne le lève définitivement, et le prénom suffit — c'est celui de
          la fiche qu'on lit. */}
      {/* Les enfants aussi, par ordre de naissance : une fratrie se récite dans
          cet ordre-là dans toutes les familles. */}
      <Row
        label={`Enfants de ${person.first_name}`}
        nodes={[...children].sort(parAinesse)}
        direction="down"
        {...shared}
      />

      <div className="mt-4 flex justify-center">
        <BoutonRetour />
      </div>
    </div>
  );
}

function Row({
  label,
  nodes,
  photos,
  direction,
}: {
  label: string;
  nodes: Node[];
  photos: Map<string, string>;
  direction?: "up" | "down";
}) {
  if (nodes.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-center text-xs uppercase tracking-wide text-muted">
        {label}
        {nodes.length > 1 && <span className="normal-case"> · {nodes.length}</span>}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {nodes.map((n) => (
          <Card key={n.id} node={n} photos={photos} direction={direction} />
        ))}
      </div>
    </div>
  );
}

/** Le trait qui descend d'une génération à la suivante. */
function Descente() {
  return (
    <div className="mx-auto my-3 h-5 w-px bg-gradient-to-b from-line to-accent-line" />
  );
}

function Card({
  node,
  current = false,
  partage = false,
  photos,
  direction,
}: {
  node: Node;
  current?: boolean;
  partage?: boolean;
  photos: Map<string, string>;
  direction?: "up" | "down";
}) {
  const dates = lifeSpan(node);
  const name = shortName(node);
  const couleur = couleurDeId(node.branch_id);

  const body = (
    <>
      <Avatar
        src={node.photo_url ? photos.get(node.photo_url) : null}
        name={node.first_name}
        size={current ? 56 : 40}
      />
      <span className="serif mt-1.5 block text-sm leading-tight">{name}</span>
      {dates && <span className="block text-xs text-muted">{dates}</span>}
      {ageLisible(node) && (
        <span className="block text-xs text-muted">{ageLisible(node)}</span>
      )}
      {node.tag && (
        <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-muted">
          {node.tag}
        </span>
      )}
    </>
  );

  // Deux cartes par ligne sur un écran de 320 px, sans jamais déborder ;
  // `overflow-hidden` retient le liseré dans l'arrondi du coin. Sur la rangée
  // du couple,
  // l'anneau prend sa part : demander la moitié à chacune les ferait déborder,
  // donc elles se partagent ce qui reste.
  const largeur = partage
    ? "min-w-[6.5rem] flex-1 sm:flex-none"
    : "w-[calc(50%-0.25rem)] sm:w-auto";
  const shape =
    `relative flex ${largeur} max-w-[11rem] flex-col items-center overflow-hidden rounded-lg border px-2 pb-2 pt-2.5 text-center sm:min-w-[8.5rem]`;

  // Le liseré est posé en fond plutôt qu'en bordure : une bordure colorée
  // remplacerait le trait gris qui tient la carte, et la carte flotterait.
  const liseré = couleur ? (
    <span
      aria-hidden
      className="absolute inset-x-0 top-0 h-1"
      style={{ background: couleur }}
    />
  ) : null;

  if (current) {
    return (
      <div className={`${shape} border-accent bg-accent-surface`}>
        {liseré}
        {body}
      </div>
    );
  }

  return (
    <Link href={`/personne/${node.id}`} className={`${shape} border-line transition-colors hover:border-accent hover:bg-accent-surface/50`}>
      {liseré}
      {body}
      {direction && (
        <span aria-hidden className="mt-1 text-xs text-accent">
          {direction === "up" ? "▲" : "▼"}
        </span>
      )}
    </Link>
  );
}
