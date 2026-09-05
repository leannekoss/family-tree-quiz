import Link from "next/link";
import { CONTACT_WHATSAPP, lienWhatsApp } from "@/lib/contact";
import { BULLETIN, NOM_GARDIEN } from "@/lib/famille";

export const metadata = {
  title: "Où sont vos données",
  robots: { index: false, follow: false },
};

/**
 * Ce que devient ce qu'on écrit ici.
 *
 * Écrite pour rassurer, pas pour se couvrir. Un pavé juridique produit
 * l'inverse de l'effet recherché : personne ne le lit, et celui qui s'y essaie
 * en ressort plus inquiet qu'avant. Chaque phrase répond donc à une question
 * qu'un cousin se pose vraiment — « ma photo peut-elle finir sur Google ? »,
 * « qui peut voir la date de naissance de ma fille ? », « comment je fais pour
 * tout retirer ? ».
 *
 * Elle est lisible sans compte, et c'est délibéré : on veut savoir où va sa
 * photo avant de la déposer.
 *
 * Rien ici n'est déclaratif : chaque affirmation a été vérifiée dans la
 * configuration réelle — région des serveurs, stockage privé, durée des liens,
 * refus d'indexation.
 */
export default function Donnees() {
  return (
    <article className="space-y-8 pb-8">
      <header>
        <h1 className="serif text-2xl font-semibold">Où sont vos données</h1>
        <p className="mt-2 text-muted">
          Cet arbre est un site de famille, tenu par une personne, sans
          entreprise derrière. Voici ce qu&apos;il enregistre et où cela se
          trouve.
        </p>
      </header>

      <section>
        <h2 className="serif text-lg font-semibold">En France, chez deux prestataires</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <tbody>
              <Ligne quoi="Les fiches (noms, dates, liens de parenté)" ou="Paris — Supabase, région eu-west-3" />
              <Ligne quoi="Les photos" ou="Paris — même hébergeur, stockage privé" />
              <Ligne quoi="Le site lui-même" ou="Paris — Vercel, région cdg1" />
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">
          Les deux prestataires sont des sociétés américaines, mais les serveurs
          qui portent vos données sont à Paris et n&apos;en sortent pas.
        </p>
      </section>

      <section>
        <h2 className="serif text-lg font-semibold">Qui peut voir tout ça</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <Point>
            <strong>Les membres de la famille qui se sont connectés</strong>, et
            eux seuls. Il faut une adresse email et le code de la famille.
          </Point>
          <Point>
            <strong>Aucun moteur de recherche.</strong> Le site refuse d&apos;être
            exploré, page de connexion comprise. Chercher un nom de la famille sur
            Google ne mènera jamais ici.
          </Point>
          <Point>
            <strong>Les photos ne sont pas des adresses publiques.</strong> Elles
            vivent dans un espace fermé ; le site fabrique à chaque visite un lien
            valable une heure. Passé ce délai, un lien copié ne montre plus rien.
          </Point>
        </ul>
      </section>

      <section>
        <h2 className="serif text-lg font-semibold">Ce qui est enregistré</h2>
        <p className="mt-2 text-sm">
          Le prénom, le nom, le nom d&apos;usage, un surnom, les dates de
          naissance et de décès, les parents, la maison, une photo, quelques
          notes.{BULLETIN ? <> C&apos;est ce que contient déjà le bulletin <em>{BULLETIN}</em>, que la famille se passe depuis des années.</> : null}
        </p>
        <p className="mt-2 text-sm">
          Pour ceux qui se connectent, s&apos;ajoutent leur adresse email et,
          s&apos;ils jouent, leur meilleur score au quiz sous le pseudonyme
          qu&apos;ils choisissent — jamais leur adresse.
        </p>
      </section>

      <section>
        <h2 className="serif text-lg font-semibold">Ce qui n&apos;est pas fait</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <Point>Rien n&apos;est vendu, loué ni transmis à qui que ce soit.</Point>
          <Point>Aucune publicité, aucun pisteur, aucun cookie publicitaire.</Point>
          <Point>
            Une seule mesure d&apos;audience, anonyme : le nombre de pages vues.
            Elle ne dit pas qui les a vues.
          </Point>
          <Point>
            Quand quelqu&apos;un change les parents d&apos;une fiche, un message
            en prévient {NOM_GARDIEN}. Ce message contient un nom et un lien, et transite
            par un service d&apos;envoi d&apos;emails.
          </Point>
        </ul>
      </section>

      <section>
        <h2 className="serif text-lg font-semibold">Ce que vous pouvez demander</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <Point>
            <strong>Corriger</strong> — pas besoin de demander : toute fiche se
            modifie depuis le site, et chaque changement est daté, signé, et se
            défait.
          </Point>
          <Point>
            <strong>Retirer votre photo</strong>, ou celle de vos enfants, à tout
            moment.
          </Point>
          <Point>
            <strong>Faire effacer votre fiche</strong> ou celle d&apos;un mineur
            dont vous avez la charge. C&apos;est fait sans discussion et sans
            délai.
          </Point>
          <Point>
            <strong>Savoir ce qui est enregistré sur vous</strong> — la fiche est
            à l&apos;écran, l&apos;historique en bas de page.
          </Point>
        </ul>
        <p className="mt-3 text-sm">
          Une seule adresse pour tout cela : {NOM_GARDIEN}
          {CONTACT_WHATSAPP ? (
            <>
              , par{" "}
              <a
                href={lienWhatsApp()}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                WhatsApp
              </a>
            </>
          ) : null}
          .
        </p>
      </section>

      <section className="rounded-xl border border-line bg-card p-4">
        <h2 className="serif text-lg font-semibold">Sur les enfants</h2>
        <p className="mt-2 text-sm">
          Les fiches des mineurs portent leur prénom et leur année de naissance,
          comme dans le bulletin. Aucune recherche n&apos;a été faite sur internet
          à leur sujet, et aucune photo d&apos;eux n&apos;a été prise ailleurs que
          dans ce que la famille a déposé elle-même. Un parent qui préfère que son
          enfant n&apos;y figure pas le dit, et c&apos;est retiré.
        </p>
      </section>

      <p className="text-center text-sm text-muted">
        <Link href="/" className="underline underline-offset-4">
          Retour à l&apos;arbre
        </Link>
      </p>
    </article>
  );
}

function Ligne({ quoi, ou }: { quoi: string; ou: string }) {
  return (
    <tr className="border-b border-line last:border-0">
      <th scope="row" className="py-2 pr-4 text-left font-normal align-top">
        {quoi}
      </th>
      <td className="py-2 align-top font-medium">{ou}</td>
    </tr>
  );
}

function Point({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="text-muted">
        ·
      </span>
      <span>{children}</span>
    </li>
  );
}
