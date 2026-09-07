import Link from "next/link";
import Avatar from "@/components/Avatar";
import BoutonRetour from "@/components/BoutonRetour";
import { couleurDeId } from "@/lib/branches";
import { shortName, lifeSpan, ageLisible, parAinesse, de } from "@/lib/types";

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
  /** Fratrie : « de Charles, avec Diana » pour un demi-frère, vide pour un
      frère entier. Enfants : « avec Diana », le co-parent. */
  groupe?: string | null;
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

  // La fratrie se range en trois blocs, de haut en bas : les frères et sœurs
  // entiers, puis chaque groupe de demi-frères sous un sous-titre qui nomme
  // ses deux parents, puis la personne avec ses conjoints, TOUJOURS en
  // dernière ligne, juste au-dessus de ses enfants.
  //
  // Deux lectures fautives ont conduit là. Une tante a lu une demi-sœur
  // comme la fille de la seconde épouse : posée sous les deux parents de
  // la fiche, rien ne disait lequel était le sien. Un sous-titre « Aussi
  // enfant de Charles, avec Diana » le dit en français, sans code ni
  // légende. Et sur la fiche d'un père remarié, son cadet tombait sous le
  // couple, juste au-dessus du trait vers « Enfants de … » : l'auteur l'a
  // lu comme un fils. Une carte de frère ne doit jamais être la dernière
  // chose au-dessus des enfants ; c'est la personne qui l'est.
  //
  // Le prix : avec un conjoint, la personne quitte l'ordre d'aînesse — ses
  // frères entiers sont sur la ligne du dessus. Sans conjoint, elle garde sa
  // place parmi eux, du plus grand au plus petit.
  const entiers = siblings.filter((n) => !n.groupe).sort(parAinesse);
  const groupes = new Map<string, Node[]>();
  for (const n of [...siblings].sort(parAinesse)) {
    if (n.groupe) groupes.set(n.groupe, [...(groupes.get(n.groupe) ?? []), n]);
  }
  const couple = spouses.length > 0;

  return (
    <div className="rounded-xl border border-line bg-card px-3 py-5">
      <Row label="Parents" nodes={parents} direction="up" {...shared} />
      {parents.length > 0 && <Descente />}

      {siblings.length > 0 && (
        <p className="mb-2 text-center text-xs uppercase tracking-wide text-muted">
          Sa génération
        </p>
      )}

      {couple && entiers.length > 0 && (
        <div className="mb-2 flex flex-wrap justify-center gap-2">
          {entiers.map((n) => (
            <Card key={n.id} node={n} {...shared} />
          ))}
        </div>
      )}

      {[...groupes].map(([groupe, nodes]) => (
        <div key={groupe} className="mb-2">
          <p className="mb-1 text-center text-sm text-muted">
            Aussi {nodes.length > 1 ? "enfants" : "enfant"} {groupe}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {nodes.map((n) => (
              <Card key={n.id} node={n} {...shared} />
            ))}
          </div>
        </div>
      ))}

      {/* La ligne de la personne. Avec des conjoints, elle et eux seuls,
          reliés par le signe de l'union puis par « puis » : « Charles &
          Diana puis Camilla » dit deux compagnes l'une après l'autre, pas
          un trio. ⚭ est le symbole du mariage : le poser entre deux personnes
          qui vivent ensemble sans être mariées leur prête une situation
          qu'elles n'ont pas choisie. L'esperluette dit le couple sans rien
          affirmer de plus. */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {couple ? (
          <>
            <Card node={person} current partage {...shared} />
            {/* Le signe et la carte du conjoint forment un bloc insécable :
                à 375 px la ligne se replie, et « puis » rejeté en bout de
                ligne laissait Camilla seule, centrée, juste au-dessus des
                enfants — la configuration même qui faisait lire un frère
                comme un fils. Le conjoint qui passe à la ligne emporte son
                « puis » avec lui. */}
            {spouses.map((sp, i) => (
              <span key={sp.id} className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="serif shrink-0 text-lg text-muted"
                  title={i > 0 ? "puis" : sp.kind === "union" ? "en couple avec" : "marié à"}
                >
                  {i > 0 ? "puis" : sp.kind === "union" ? "&" : "⚭"}
                </span>
                <Card node={sp} partage {...shared} />
              </span>
            ))}
          </>
        ) : (
          [person, ...entiers]
            .sort(parAinesse)
            .map((n) =>
              n.id === person.id ? (
                <Card key={n.id} node={person} current {...shared} />
              ) : (
                <Card key={n.id} node={n} {...shared} />
              ),
            )
        )}
      </div>

      {/* Pas de trait sous un couple : centré sur la rangée, il tomberait
          sous Diana. Le titre « Enfants de Charles » porte le lien. */}
      {/* Le trait ne descend que d'une personne seule sur sa ligne : centré
          sur la rangée, il tomberait sous un conjoint ou sous un frère.
          Sinon un filet tient sa place — sans rien, le titre « Enfants
          de … » touchait la dernière carte. */}
      {children.length > 0 &&
        (!couple && entiers.length === 0 ? (
          <Descente />
        ) : (
          <div className="mx-auto my-4 h-px w-1/2 bg-line" />
        ))}
      {/* « Enfants » tout court laissait le doute sur le parent : nommer la
          personne le lève définitivement, et le prénom suffit — c'est celui de
          la fiche qu'on lit. */}
      {/* Les enfants aussi, par ordre de naissance : une fratrie se récite dans
          cet ordre-là dans toutes les familles. Avec plusieurs co-parents,
          une ligne par co-parent, sous-titrée « avec Diana ». */}
      {children.length > 0 && (
        <Groupes
          label={`Enfants ${de(person.first_name)}`}
          nodes={[...children].sort(parAinesse)}
          direction="down"
          conjoints={spouses.length}
          {...shared}
        />
      )}

      <div className="mt-4 flex justify-center">
        <BoutonRetour />
      </div>
    </div>
  );
}

/** La rangée Enfants : une seule ligne, ou une ligne par co-parent. Le
    sous-titre apparaît aussi quand la page montre plusieurs conjoints et
    un seul co-parent : « Charles & Diana puis Camilla » suivi de William
    sans un mot laisserait deviner de laquelle elle est. */
function Groupes({
  label,
  nodes,
  photos,
  direction,
  conjoints,
}: {
  label: string;
  nodes: Node[];
  photos: Map<string, string>;
  direction?: "up" | "down";
  conjoints: number;
}) {
  const groupes = new Map<string, Node[]>();
  for (const n of nodes) {
    const k = n.groupe ?? "";
    groupes.set(k, [...(groupes.get(k) ?? []), n]);
  }
  if (groupes.size < 2 && conjoints < 2) {
    return <Row label={label} nodes={nodes} photos={photos} direction={direction} />;
  }
  return (
    <div>
      <p className="mb-2 text-center text-xs uppercase tracking-wide text-muted">
        {label}
        <span className="normal-case"> · {nodes.length}</span>
      </p>
      {[...groupes].map(([groupe, enfants]) => (
        <div key={groupe} className="mb-2">
          <p className="mb-1 text-center text-sm text-muted">{groupe}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {enfants.map((n) => (
              <Card key={n.id} node={n} photos={photos} direction={direction} />
            ))}
          </div>
        </div>
      ))}
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
        <span className="mt-0.5 block text-[11px] text-muted">{node.tag}</span>
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
