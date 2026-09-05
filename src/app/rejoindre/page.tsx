"use client";

import { useState, use } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import Aide from "@/components/Aide";
import { BULLETIN, CODE_PUBLIC, NOM_GARDIEN, PROMESSES, SOUS_TITRE, TITRE } from "@/lib/famille";

/**
 * L'adresse est assemblée au clic plutôt qu'écrite dans la page : /rejoindre est
 * la seule page publique du site, et une adresse en clair dans le HTML se fait
 * moissonner par les robots à spam.
 */
function ecrireAuGardien() {
  const objet = encodeURIComponent("Accès à l'arbre de la famille");
  const corps = encodeURIComponent(
    "Bonjour,\n\nJe n'arrive pas à me connecter à l'arbre. Peux-tu inscrire cette adresse ?\n\nMerci !",
  );
  window.location.href = `mailto:${["gardien", "example.com"].join("@")}?subject=${objet}&body=${corps}`;
}

/**
 * Connexion sans aucun email envoyé : le code famille tient lieu de mot de passe,
 * l'adresse ne sert qu'à savoir qui corrige quoi. Le lien magique butait sur le
 * quota d'envoi de Supabase — quelques messages par heure pour tout le projet,
 * ce qui rend impossible d'ouvrir l'arbre à deux cents personnes.
 *
 * Le mot de passe est donc commun. C'est assumé : le filtrage réel vient de la
 * liste des adresses autorisées, et l'enjeu est un annuaire familial privé, pas
 * un compte bancaire.
 */

/**
 * Démo publique : personne ne donne son adresse. On en fabrique une par
 * appareil, gardée dans localStorage pour retrouver ses scores la fois
 * suivante. Le domaine `.invalid` est réservé (RFC 2606) : aucun mail ne
 * partira jamais vers ces adresses. Une vraie famille saisit la sienne.
 */
function adresseDeSession(saisie: string): string {
  if (CODE_PUBLIC === null) return saisie.trim().toLowerCase();
  const cle = "demo-visiteur";
  try {
    const connue = window.localStorage.getItem(cle);
    if (connue) return connue;
    const suffixe = crypto.randomUUID().slice(0, 8);
    const adresse = `visiteur-${suffixe}@demo.invalid`;
    window.localStorage.setItem(cle, adresse);
    return adresse;
  } catch {
    return `visiteur-${crypto.randomUUID().slice(0, 8)}@demo.invalid`;
  }
}

export default function Rejoindre({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; puis?: string }>;
}) {
  const { code: presetCode, puis } = use(searchParams);

  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(CODE_PUBLIC ?? presetCode ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enter(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = supabaseBrowser();
    // Le clavier Android met une majuscule au premier caractère : « Famille »
    // ne vaut pas « famille », ni comme mot de passe ni à la comparaison. Le
    // code est rangé en minuscules côté base, on saisit dans la même règle.
    const motDePasse = code.trim().toLowerCase();
    const identity = { email: adresseDeSession(email), password: motDePasse };

    let { error: signInError } = await supabase.auth.signInWithPassword(identity);

    // Adresse inconnue : plutôt que de renvoyer la personne demander son
    // inscription, on crée le compte si le code est le bon. Inscrire deux cents
    // adresses à la main était l'obstacle qui empêchait d'ouvrir l'arbre ; le
    // code fait désormais le filtrage, l'adresse ne sert plus qu'à signer les
    // corrections.
    //
    // L'ordre compte : on tente d'abord la connexion. Ainsi le gardien, dont le
    // secret est différent du code famille, entre par le chemin normal et son
    // mot de passe n'est jamais touché.
    if (signInError) {
      const { error: creation } = await supabase.rpc("rejoindre_avec_code", {
        mon_email: identity.email,
        code: motDePasse,
      });

      if (creation) {
        setError(explain(creation.message));
        setBusy(false);
        return;
      }

      ({ error: signInError } = await supabase.auth.signInWithPassword(identity));
    }

    if (signInError) {
      setError(explain(signInError.message));
      setBusy(false);
      return;
    }

    // L'adresse doit figurer sur la liste : c'est cette étape qui ouvre l'arbre.
    const { error: joinError } = await supabase.rpc("join_family", {
      code: motDePasse,
    });
    if (joinError) {
      setError(explain(joinError.message));
      setBusy(false);
      return;
    }

    // Le nom dit qui corrige quoi, et rattache la fiche quand une seule
    // ressemble. Il vient APRÈS l'entrée et n'a pas le droit de la bloquer :
    // quelqu'un qui est dans la famille doit entrer même si son nom ne
    // ressemble à rien de connu. On ne lit donc pas l'erreur.
    await supabase.rpc("me_declarer", { nom: nom.trim() || "Visiteur" });

    // Rechargement complet plutôt que router.push : la navigation cliente part
    // avant que le cookie de session posé par le SDK soit visible du serveur,
    // qui renvoie alors vers cette même page — bouton figé, utilisateur coincé.
    //
    // `replace` et non `href` : sinon le bouton retour d'Android ramène sur
    // cette page de connexion, qui renvoie à l'accueil, qui ramène ici. On
    // n'empile pas une étape dont on ne veut jamais revenir.
    // Là où l'on allait avant d'être arrêté par la porte : la fiche qu'un
    // cousin vient d'envoyer, la maison d'un lien profond. Sans cela, celui qui
    // reçoit « voici la fiche de ton père » arrive sur l'accueil et ne saura
    // jamais pourquoi on lui a écrit.
    //
    // 🔑 Chemin interne UNIQUEMENT. La valeur vient de l'adresse, donc de
    // n'importe qui : `//ailleurs.example` est une URL absolue déguisée que le
    // navigateur suivrait hors du site. On exige un `/` non suivi d'un second.
    const interne = puis && /^\/(?!\/)/.test(puis) ? puis : "/";
    window.location.replace(interne);
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      {/* « Rejoindre » ne disait pas quoi. On arrive ici par un lien reçu sur
          WhatsApp, souvent sans contexte : la première ligne doit nommer la
          chose, la deuxième dire qui la tient. C'est ce qui distingue une page
          de famille d'un site qui réclame une adresse email. */}
      <h1 className="serif text-2xl font-semibold leading-tight">
        {TITRE}
      </h1>
      <p className="mt-2 text-sm">
        Qui est qui dans {SOUS_TITRE}. Tenu par <strong>{NOM_GARDIEN}</strong>
        {BULLETIN ? (
          <>, à partir du bulletin <em>{BULLETIN}</em> et de ce que la famille y ajoute.</>
        ) : (
          <>, à partir de ce que la famille y ajoute.</>
        )}
      </p>

      <div className="mb-6" />

      <form onSubmit={enter} className="space-y-4">
        {/* Le nom d'abord, et c'est voulu : c'est la seule chose qu'on demande
            qui serve vraiment à quelque chose ici. L'adresse, elle, ne sert
            qu'à revenir.

            Il est demandé à l'entrée parce que posé après, il se saute : la
            question « Qui êtes-vous dans l'arbre ? » a été passée par 6
            personnes sur 21, dont les deux plus gros contributeurs, et leurs
            corrections s'affichaient au journal sous le début de leur adresse.
            Ce formulaire est le seul écran que tout le monde traverse. */}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            {CODE_PUBLIC === null ? "Votre nom" : "Votre prénom, pour le classement (facultatif)"}
          </span>
          <input
            type="text"
            required={CODE_PUBLIC === null}
            autoComplete="name"
            placeholder={CODE_PUBLIC === null ? "Prénom Nom" : "Visiteur"}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-accent"
          />
          {CODE_PUBLIC === null && (
          <Aide titre="Et si je ne suis pas dans l&apos;arbre ?">
            <strong>Écrivez quand même votre nom.</strong> Il signera vos
            corrections, que vous ayez une fiche ou non — beaucoup de pièces
            rapportées n&apos;en ont pas encore. Si une fiche porte ce nom, elle
            vous est rattachée toute seule ; si plusieurs se ressemblent, on
            vous demandera laquelle. Les femmes peuvent donner l&apos;un ou
            l&apos;autre de leurs deux noms.
          </Aide>
          )}
        </label>

        {CODE_PUBLIC === null && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Votre email</span>
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-accent"
          />
          {/* La question qui bloquait vraiment les gens : « avec quel mail ? ».
              La page disait « réservé aux adresses inscrites » sans jamais dire
              laquelle — personne ne pouvait deviner. */}
          <Aide titre="Laquelle ?">
            <strong>Celle que vous voulez, du moment que vous vous en
            souviendrez.</strong> C&apos;est le code de la famille qui ouvre la
            porte ; votre adresse sert seulement à signer ce que vous corrigez,
            pour qu&apos;on sache à qui demander en cas de doute. Reprenez la
            même la prochaine fois et vous retrouverez votre place.
          </Aide>
        </label>
        )}

        {CODE_PUBLIC === null && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Code famille</span>
          <input
            type="text"
            required
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="celui qui circule dans la famille"
            className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-accent"
          />
          <Aide titre="Je ne l&apos;ai pas">
            C&apos;est le même mot pour toute la famille, transmis de vive voix ou
            par message. Il ne s&apos;agit pas d&apos;un mot de passe que vous
            auriez choisi : vous n&apos;avez rien créé ici.
          </Aide>
        </label>
        )}

        {error && (
          // `role="alert"` : sans lui, quelqu'un qui n'y voit pas se trompe de
          // code et n'en est jamais averti — le texte apparaît à l'écran sans
          // être annoncé.
          <div
            role="alert"
            className="rounded-lg border border-accent-line bg-accent-surface px-3 py-2.5"
          >
            <p className="text-sm text-accent">{error}</p>
            <button
              type="button"
              onClick={ecrireAuGardien}
              className="mt-1.5 text-sm underline underline-offset-4"
            >
              Écrire au gardien pour demander l&apos;accès
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-accent px-4 py-3 font-medium text-sur-plein disabled:opacity-50"
        >
          {busy ? "…" : "Entrer"}
        </button>
      </form>

      {/* Les promesses SOUS le formulaire, et non au-dessus.
          Mesuré en 360 × 800 : le bouton « Entrer » finissait à 885 px pour un
          écran de 800 — sous le pli. Deux cents personnes arrivent par cet
          écran, dont des gens de 85 ans qui ne feront pas défiler : ils
          concluront que ça ne marche pas. On vient ici pour entrer, pas pour
          lire ce que le site promet ; le texte reste, il passe après le geste. */}
      <ul className="mt-6 space-y-1.5 rounded-xl border border-line bg-card px-4 py-3 text-sm">
        {PROMESSES.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-muted">
        {CODE_PUBLIC === null
          ? "Votre adresse sert uniquement à savoir qui corrige quoi. Aucun email n'est envoyé."
          : "Aucun compte à créer : votre appareil garde votre place et vos scores."}
      </p>
    </div>
  );
}

/**
 * Aucun message technique ne doit atteindre la famille : quelqu'un qui lit le
 * nom d'un fournisseur en conclut que le site est cassé, pas qu'il lui manque
 * un accès. Chaque cas dit ce qui s'est passé et quoi faire ensuite.
 */
function explain(message: string) {
  if (message.includes("code invalide"))
    // Le message disait « sans majuscule » alors que la majuscule est acceptée
    // depuis le correctif Android : il envoyait chercher une faute qui n'en est
    // pas une, et détournait de la vraie (une lettre de travers).
    return "Ce code ne correspond pas à celui de la famille. Il s'écrit d'un seul mot ; les majuscules n'ont pas d'importance.";
  if (message.includes("entree libre fermee"))
    return "L'arbre n'accepte plus les nouvelles adresses pour le moment. Demandez au gardien de vous ouvrir l'accès.";
  if (message.includes("adresse invalide"))
    return "Cette adresse ne ressemble pas à un email. Vérifiez l'arobase et le point.";
  if (message.includes("adresse non autorisee"))
    return "Cette adresse n'est pas encore dans la liste. Demandez au gardien de vous ajouter.";
  if (
    message.includes("Invalid login credentials") ||
    message.includes("Email not confirmed") ||
    message.includes("confirm")
  )
    // Le cas courant désormais : l'adresse existe déjà et le code saisi n'est
    // pas celui qui va avec. On ne dit pas « adresse inconnue », ce serait faux.
    return "Le code ne va pas avec cette adresse. Si vous êtes déjà venu, reprenez le code que vous aviez utilisé.";
  if (message.includes("permission denied") || message.includes("non connecte"))
    return "La session a expiré. Recommencez.";
  if (message.includes("rate limit") || message.includes("429"))
    return "Trop de tentatives d'affilée. Patientez quelques minutes.";
  return "Connexion impossible. Vérifiez l'adresse et le code, puis réessayez.";
}
