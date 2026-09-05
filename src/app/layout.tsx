import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import Entete from "@/components/Entete";
import Pied from "@/components/Pied";
import "./globals.css";
import { SOUS_TITRE, TITRE } from "@/lib/famille";

const RESUME =
  `Qui est qui dans ${SOUS_TITRE} : les fiches, un quiz et la carte des maisons.`;

export const metadata: Metadata = {
  title: TITRE,
  description: RESUME,
  robots: { index: false, follow: false },

  /*
   * Ce que WhatsApp affiche quand le lien arrive dans le groupe.
   *
   * Sans ces trois lignes, l'aperçu se réduit à une ligne grise portant
   * l'adresse — indiscernable d'un lien douteux. Cent seize personnes vont le
   * recevoir, dont beaucoup n'auront aucun contexte : la vignette est la seule
   * chose qui distingue une invitation de famille d'un message à ignorer.
   *
   * `robots: noindex` reste : ces balises ne rendent rien public. Elles sont
   * lues par le robot de prévisualisation de la messagerie, pas par un moteur
   * de recherche — qui, lui, a l'interdiction d'explorer.
   *
   * L'image elle-même est fabriquée par `opengraph-image.tsx`, à côté.
   */
  openGraph: {
    title: TITRE,
    description: RESUME,
    siteName: TITRE,
    locale: "fr_FR",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#faf7f2",
  // Déclarer qu'on gère les deux thèmes désarme le « mode sombre forcé » de
  // Samsung et Xiaomi, qui sinon réinvente nos couleurs lui-même et transforme
  // le terracotta en bleu.
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      {/* Le réglage « écrire plus gros » se lit AVANT le premier rendu : posé
          après, la page s'afficherait petite puis grossirait sous les yeux —
          un saut que les gens prennent pour un bug. Le script tient en une
          ligne et ne touche qu'à une classe. suppressHydrationWarning couvre
          cette classe-là : le serveur ne peut pas connaître l'appareil. */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              `try{if(localStorage.getItem("arbre.confort")==="1")document.documentElement.classList.add("confort")}catch(e){}`,
          }}
        />
      </head>
      {/* Colonne pleine hauteur : sans elle, le pied de page remonte au milieu
          de l'écran sur les pages courtes, et on croit la page tronquée. */}
      <body className="flex min-h-dvh flex-col pb-[env(safe-area-inset-bottom)] antialiased">
        <Entete />
        <main className="mx-auto w-full max-w-3xl grow px-4 py-6">{children}</main>
        <Pied />

        {/* Une seule mesure, et rien de plus. Aucun cookie, aucun identifiant :
            on compte des pages vues, on ne sait pas qui les a vues — le minimum
            pour un annuaire familial privé.
            Ce qu'on cherche tient en une question : combien ouvrent le lien
            sans réussir à entrer. Ceux-là ne diront rien, ils fermeront la page ;
            c'est la seule façon de les compter.
            Speed Insights a été retiré : il est facturé, et mesurer le temps de
            chargement chez deux cents cousins ne vaut pas une ligne sur une
            facture. */}
        <Analytics />
      </body>
    </html>
  );
}
