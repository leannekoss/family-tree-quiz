import "server-only";

/**
 * Prévenir Camille quand une filiation change.
 *
 * Un membre a cassé sa propre fiche en cinq minutes, un soir, en explorant le
 * formulaire — parents remplacés cinq fois de suite, photo perdue au passage.
 * Le journal avait tout gardé et tout était réversible ; ce qui a manqué,
 * c'est que quelqu'un regarde. La fiche est restée fausse deux heures.
 *
 * D'où cette alerte, et sur ce seul changement : un père ou une mère qui
 * change déplace des branches entières, fausse les fratries calculées et le
 * lien de parenté de toute une moitié de la famille. Une date de naissance
 * corrigée, non — ça se voit et ça ne casse rien.
 *
 * Elle ne restreint personne : tout membre continue de tout corriger.
 * Surveiller coûte moins cher que verrouiller, et n'éteint pas les
 * contributions.
 */

// L'expéditeur n'est pas une adresse dédiée : le plan AgentMail plafonne à
// trois boîtes, toutes prises. Le sujet du message porte donc l'origine, et
// changer d'expéditeur ne demandera qu'une variable d'environnement.
const INBOX = process.env.AGENTMAIL_INBOX ?? "votre-inbox@agentmail.to";
const DESTINATAIRE = process.env.ALERTE_EMAIL ?? "gardien@example.com";
const SITE = "https://votre-arbre.vercel.app";

type Changement = {
  personne: string;
  personneId: string;
  auteur: string;
  avant: { pere: string | null; mere: string | null };
  apres: { pere: string | null; mere: string | null };
};

/**
 * Prévenir Camille qu'une fiche vient d'être créée.
 *
 * Une création n'est pas réversible d'un clic comme une correction : la fiche
 * en double, elle, coupe l'arbre en deux à cet endroit et se répare en
 * fusionnant à la main. C'est le seul geste de la famille qui mérite d'être
 * regardé le jour même — d'où cette alerte, sur le même canal que les
 * changements de filiation.
 */
export async function prevenirCreationPersonne(c: {
  personne: string;
  personneId: string;
  auteur: string;
  /** « enfant de Julien Morel » — le lien qui la rattache à l'arbre. */
  lien: string;
}) {
  const cle = process.env.AGENTMAIL_API_KEY;
  if (!cle) return;

  const texte = [
    `${c.auteur} a créé la fiche de ${c.personne}.`,
    "",
    `Rattachement : ${c.lien}`,
    "",
    `La fiche : ${SITE}/personne/${c.personneId}`,
    "",
    "À vérifier surtout : que ce n'est pas un doublon de quelqu'un qui était",
    "déjà là sous un autre prénom d'usage.",
  ].join("\n");

  try {
    const r = await fetch(`https://api.agentmail.to/v0/inboxes/${INBOX}/messages/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: [DESTINATAIRE],
        subject: `Arbre — ${c.auteur} a créé la fiche de ${c.personne}`,
        text: texte,
      }),
    });
    if (!r.ok) console.error("alerte création refusée", r.status, await r.text());
  } catch (e) {
    // Même entorse assumée que ci-dessous : une panne du service de mail ne
    // doit pas faire perdre à un cousin la fiche qu'il vient de créer.
    console.error("alerte création impossible", e);
  }
}

export async function prevenirChangementFiliation(c: Changement) {
  const cle = process.env.AGENTMAIL_API_KEY;
  if (!cle) return;

  const ligne = (label: string, avant: string | null, apres: string | null) =>
    avant === apres ? null : `${label} : ${avant ?? "personne"} → ${apres ?? "personne"}`;

  const lignes = [
    ligne("Père", c.avant.pere, c.apres.pere),
    ligne("Mère", c.avant.mere, c.apres.mere),
  ].filter(Boolean);

  if (lignes.length === 0) return;

  const texte = [
    `${c.auteur} a changé la filiation de ${c.personne}.`,
    "",
    ...lignes,
    "",
    `La fiche : ${SITE}/personne/${c.personneId}`,
    "",
    "Rien n'est perdu : l'ancienne version est dans l'historique en bas de la",
    "fiche, et se restaure en un geste.",
  ].join("\n");

  try {
    const r = await fetch(
      `https://api.agentmail.to/v0/inboxes/${INBOX}/messages/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cle}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: [DESTINATAIRE],
          // Le sujet doit se lire entier dans une notification de téléphone,
          // sans ouvrir : c'est là que la décision de regarder se prend.
          subject: `Arbre — parents de ${c.personne} modifiés par ${c.auteur}`,
          text: texte,
        }),
      },
    );
    if (!r.ok) console.error("alerte filiation refusée", r.status, await r.text());
  } catch (e) {
    // Seule entorse assumée à la règle « échouer fort » du projet : une panne
    // du service de mail ne doit pas faire perdre à un cousin la correction
    // qu'il vient de saisir. L'erreur part dans les journaux Vercel, la
    // modification est enregistrée, et le journal du site reste la source de
    // vérité — l'alerte n'est qu'un raccourci.
    console.error("alerte filiation impossible", e);
  }
}
