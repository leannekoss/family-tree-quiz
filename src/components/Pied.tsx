/**
 * Le pied de page, et surtout : comment joindre quelqu'un.
 *
 * Jusqu'ici, un membre de la famille bloqué à la porte n'avait qu'un lien
 * « écrire au gardien » sur la page de connexion — et encore fallait-il arriver
 * jusque-là. Les gens qui n'y arrivent pas sont précisément ceux qui ne savent
 * pas où chercher : le contact doit être en bas de chaque page.
 *
 * WhatsApp seulement, et pas le numéro en clair : ce pied de page s'affiche
 * aussi sur /rejoindre, la seule page publique du site. Un numéro écrit là se
 * fait moissonner par les robots à spam, exactement comme l'adresse email —
 * qui est déjà assemblée au clic pour cette raison. Le lien wa.me porte le
 * numéro sans jamais l'écrire, et c'est de toute façon par WhatsApp que le
 * lien circulera dans la famille.
 */
import Link from "next/link";
import QuiEcrire from "@/components/QuiEcrire";
import QuiLaFait from "@/components/QuiLaFait";
import { lienWhatsApp } from "@/lib/contact";

export default function Pied() {
  return (
    <footer className="mt-12 border-t border-line">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <QuiEcrire />

        <ul className="mt-3 flex flex-wrap gap-2">
          <li>
            {/* Le bouton porte ce qu'on vient y chercher — « me contacter » —
                et non le nom de l'application qui s'ouvrira. */}
            <a
              href={lienWhatsApp()}
              target="_blank"
              rel="noopener noreferrer"
              // 44 px : c'est le lien qu'on cherche quand plus rien ne marche.
              className="inline-flex min-h-[44px] items-center rounded-lg border border-accent-line bg-accent-surface px-3 py-2 text-sm font-medium text-accent"
            >
              Contactez-moi sur WhatsApp
            </a>
          </li>
        </ul>

        {/* « LinkedIn » ne demandait rien et n'obtenait rien : c'était une
            cartouche, pas une invitation. Ce site est aussi un travail — quatre
            cent soixante-douze fiches, une carte, un quiz — et le dire une fois,
            à la fin, n'a rien d'indécent.

            La phrase mène à deux endroits parce que ce sont deux personnes
            différentes : le cousin qu'on connaît, et celui qui fabrique des
            choses. Qui veut la fiche la trouve, qui veut la suite aussi. */}
        <p className="mt-5 text-sm">
          <QuiLaFait />
        </p>

        {/* La phrase disait déjà l'essentiel, mais l'affirmait sans rien
            prouver. Le lien porte le détail vérifiable — où sont les serveurs,
            qui voit quoi, comment faire effacer une fiche — et reste lisible
            sans compte : on veut savoir où va sa photo avant de la déposer. */}
        <p className="mt-5 text-xs text-muted">
          Arbre privé de la famille Vernet-Delcourt. Rien de ce qui est ici
          n&apos;est visible depuis un moteur de recherche, et tout est hébergé
          en France.{" "}
          <Link href="/donnees" className="inline-flex min-h-[44px] items-center underline underline-offset-4">
            Où sont vos données
          </Link>{" "}
          ·{" "}
          {/* Les idées ne rapportent aucun point : la page qui les crédite doit
              donc être atteignable, sinon personne ne saura qu'elle existe. */}
          <Link href="/merci" className="inline-flex min-h-[44px] items-center underline underline-offset-4">
            Merci à qui
          </Link>
          .
        </p>
      </div>
    </footer>
  );
}
