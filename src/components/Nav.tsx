"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Les libellés sont courts et surtout distincts les uns des autres.
 *
 * Trois d'entre eux se confondaient : « Qui est qui ? » pour le quiz, « Qui est
 * où ? » pour la reconnaissance de visages, « Les visages » pour l'ajout de
 * photos. Sur un téléphone, dans une bande qui défile, on ne les distinguait
 * plus — et « où » renvoyait mentalement aux maisons. La page garde son titre
 * complet ; la barre, elle, sert à naviguer.
 */
/**
 * Chaque destination porte un signe.
 *
 * Six cases de texte gris se ressemblent toutes à bout de bras ; un dessin se
 * reconnaît sans être lu. C'est ce qui permet de viser le bon onglet du pouce
 * sans relire les six, et ce qui aide le plus les lecteurs les plus âgés — pour
 * qui déchiffrer « Reconnaître » en corps 14 demande un effort que 👀 ne
 * demande pas.
 *
 * Aucun n'est décoratif : chacun dit ce qu'on va y faire. Et aucun ne porte de
 * sélecteur de variation, ce caractère invisible qui décale l'alignement d'un
 * demi-cran sur Android sans qu'on comprenne pourquoi.
 */
const NAV = [
  { href: "/", label: "Chercher", signe: "🔍" },
  { href: "/quiz", label: "Le quiz", signe: "🎲" },
  // L'arbre entier juste après le quiz : c'est la réponse à la question que le
  // quiz fait naître — « mais où se place ce cousin-là ? ».
  { href: "/arbre", label: "L'arbre entier", signe: "🌳" },
  { href: "/lieux", label: "Qui habite où", signe: "🏡" },
  { href: "/visages", label: "Reconnaître", signe: "👀" },
  // « Poser un visage » disait le geste dans le vocabulaire du site, pas dans
  // celui du téléphone. Ce qu'on va faire là, tout le monde sait le nommer :
  // ajouter une photo.
  { href: "/photos", label: "Ajouter une photo", signe: "📷" },
  { href: "/classement", label: "Le classement", signe: "🏆" },
  // Juste après le classement, parce que c'en est l'autre face : là on compte
  // les points du meilleur joueur, ici on récompense d'être revenu.
  { href: "/famille", label: "En chiffres", signe: "✨" },
  { href: "/journal", label: "Ce qui bouge", signe: "📝" },
  // En dernier, et c'est sa place : on ne vient pas ici pour une tâche, on
  // vient parce qu'on n'a rien de précis à chercher.
  { href: "/hasard", label: "Au hasard", signe: "🎁" },
];

export default function Nav() {
  const chemin = usePathname();

  // Rien à naviguer avant d'être entré. Six boutons occupaient le haut du
  // premier écran, au-dessus du formulaire ; taper dessus ramenait
  // silencieusement à la même page, sans un mot d'explication. Le premier écran
  // est celui où l'on abandonne.
  if (chemin === "/rejoindre") return null;

  return (
    // Six onglets sur une seule ligne débordaient de l'écran : il fallait faire
    // glisser la bande vers la droite pour atteindre « Les photos » et « Ce qui
    // bouge », et rien ne disait qu'ils existaient. Un geste que personne ne
    // devine cache la moitié de l'application.
    //
    // Deux lignes de trois : tout est visible d'un coup, les cibles sont larges,
    // et il n'y a plus rien à deviner. Sur un écran large, la bande redevient
    // une simple rangée.
    <nav className="mt-2">
      <ul className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap">
        {NAV.map((item, i) => {
          // Sept cases dans une grille de trois laissent la dernière seule dans
          // son coin, comme oubliée. Elle prend toute la largeur : la ligne
          // paraît voulue, et la cible devient la plus large de la barre — ce
          // qui va bien à un bouton qu'on touche sans savoir ce qu'on cherche.
          const pleineLargeur = i === NAV.length - 1 && NAV.length % 3 === 1;
          // La fiche d'une personne appartient à la recherche : c'est de là
          // qu'on y arrive, et c'est là qu'on veut revenir.
          const actif =
            item.href === "/"
              ? chemin === "/" || chemin.startsWith("/personne")
              : chemin.startsWith(item.href);

          return (
            <li key={item.href} className={pleineLargeur ? "col-span-3 sm:col-auto" : undefined}>
              <Link
                href={item.href}
                aria-current={actif ? "page" : undefined}
                className={`flex items-center justify-center gap-0.5 rounded-lg border px-2 py-2 text-center text-sm leading-tight sm:flex-row sm:gap-1.5 sm:px-3 sm:py-1.5 ${
                  // Sur toute la largeur, le signe repasse à côté du mot :
                  // l'empiler ferait une bande deux fois plus haute que les
                  // autres pour la même quantité de texte.
                  pleineLargeur ? "flex-row gap-1.5" : "flex-col"
                } ${
                  actif
                    ? "border-accent-line bg-accent-surface font-medium text-accent"
                    : "border-line"
                }`}
              >
                {/* Le signe est au-dessus du texte sur téléphone — dans une
                    case d'un tiers d'écran, le mettre devant volerait la place
                    à « Ajouter une photo ». Sur écran large, la rangée
                    redevient horizontale.

                    aria-hidden parce que le mot suit : sans lui, un lecteur
                    d'écran annonce « loupe Chercher ». */}
                <span aria-hidden className="text-lg leading-none sm:text-base">
                  {item.signe}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
