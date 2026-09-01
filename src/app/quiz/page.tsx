import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { buildQuiz, type QuizPerson } from "@/lib/quiz";
import { campDe } from "@/lib/branches";
import { signedPhotos } from "@/lib/photos";
import QuizGame from "@/components/QuizGame";
import Aide from "@/components/Aide";

export const dynamic = "force-dynamic";

export default async function Quiz({
  searchParams,
}: {
  searchParams: Promise<{ tous?: string; niveau?: string; branche?: string }>;
}) {
  const { tous, niveau: niveauBrut, branche: brancheBrute } = await searchParams;
  const niveau: 1 | 2 | 3 = niveauBrut === "2" ? 2 : niveauBrut === "3" ? 3 : 1;
  const supabase = await supabaseServer();

  // La fiche du joueur donne sa branche : quarante-deux membres sur quarante-
  // cinq y sont rattachés, il n'y a donc rien à demander à presque personne.
  const { data: member } = await supabase
    .from("members")
    .select("user_id, person:person_id(branches(name))")
    .maybeSingle();
  if (!member) redirect("/rejoindre");

  // `?tous=1` rend la main au tirage d'origine. Un paramètre d'adresse plutôt
  // qu'un réglage à mémoriser : il se lit dans le lien, ne survit pas à la
  // partie, et ne crée pas un état de plus à comprendre.
  const maBranche =
    tous === "1"
      ? null
      : ((member.person as { branches: { name: string } | null } | null)?.branches?.name ?? null);

  // On charge tout et on compose en mémoire, plutôt que d'écrire cinq requêtes
  // de tirage au sort en SQL pour cinq formes de question.
  //
  // Sauf les cousins collatéraux de la page 35 de la Gazette : ils sont dans
  // l'annuaire pour qu'on retrouve le lien quand leur nom tombe, mais les
  // faire deviner ferait perdre la partie à tout le monde — et leurs noms
  // serviraient de mauvaises réponses trop faciles à écarter.
  const { data } = await supabase
    .from("people")
    .select(
      "id, first_name, last_name, married_name, birth_year, death_year, birth_display, deceased, father_id, mother_id, photo_url, sex, notes, nickname, branches(name)",
    )
    .eq("collateral", false)
    // Certaines fiches restent dans l'annuaire sans entrer dans le jeu : une
    // famille se sépare, se brouille, se recompose, et quelqu'un peut avoir
    // toute sa place dans l'arbre sans qu'il soit convenable de le donner à
    // deviner à deux cents personnes un dimanche soir. Le filtre est ici, sur
    // le chargement : la personne ne peut donc être ni une question, ni une
    // mauvaise réponse, ni un nom qui traîne dans une liste de propositions.
    .eq("hors_quiz", false);

  const people: QuizPerson[] = (data ?? []).map((p) => ({
    ...p,
    branch: (p.branches as { name: string } | null)?.name ?? null,
  }));

  const [{ data: classement }, { data: parBranche }, { data: camps }, { data: branches }, { data: serieData }] =
    await Promise.all([
      supabase.rpc("classement", { combien: 10 }),
      supabase.rpc("classement_branches"),
      supabase.rpc("classement_camps"),
      supabase.from("branches").select("name").order("name"),
      supabase.rpc("ma_serie"),
    ]);
  const serie = serieData?.[0] ?? { jours: 0, joue_aujourdhui: false };

  // Les questions de pays déjà vues, laissées par le navigateur dans un cookie
  // après chaque partie. Un cookie plutôt qu'une table : ce sont quelques
  // dizaines d'octets de confort de jeu, ils n'ont rien à faire en base — et le
  // serveur en a besoin AVANT de composer la partie, donc avant tout rendu.
  const vus = (await cookies()).get("pays_vus")?.value ?? "";
  const paysVus = vus
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0);

  const personnesVuesRaw = (await cookies()).get("personnes_vues")?.value ?? "";
  const personnesVues = new Set(
    personnesVuesRaw.split(",").filter((s) => s.length > 8),
  );

  /**
   * La branche demandée à la main — « je veux uniquement des questions sur les
   * Rouvière ».
   *
   * 🔑 Validée contre la table `branches`, jamais reprise telle quelle. C'est
   * une valeur d'URL : la comparer directement à `p.branch` dans le tirage
   * laisserait n'importe qui composer une partie sur une branche qui n'existe
   * pas, et obtenir un écran vide sans comprendre pourquoi. Un nom inconnu est
   * ignoré, on retombe sur le quiz normal.
   */
  const stricte =
    (branches ?? []).find((b) => b.name === brancheBrute)?.name ?? null;

  const questions = buildQuiz(people, 10, maBranche, niveau, paysVus, stricte, personnesVues);

  // Les portraits vivent dans un stockage privé : la question porte un chemin,
  // le navigateur a besoin d'un lien signé. On les demande par lot, une seule
  // fois — les questions ET le classement qui s'affiche en dessous de la
  // partie, sinon les visages du podium local réclameraient un second aller-
  // retour pour les mêmes photos.
  //
  // 🔑 Deux lots, et non un seul, parce que les deux tailles ne se valent pas.
  // « Ça mouline beaucoup, je suis dans le TGV » (Anna, 20/08). Une partie
  // montre en moyenne cinq visages, et ils partaient tous en pleine
  // définition — mille pixels, cent trente-sept kilo-octets pièce — pour être
  // affichés à cent douze. Sur un réseau de train, sept cents kilo-octets
  // d'images avant de pouvoir répondre à la première question.
  //
  // La grille de quatre visages et le classement prennent donc la VIGNETTE :
  // deux cent quarante pixels pour des cases de cent douze, c'est encore le
  // double de ce qu'un écran fin demande. Le portrait unique de « qui est-ce ? »
  // garde la pleine définition : il s'affiche à cent soixante-seize pixels,
  // c'est LE visage qu'on scrute, et il est seul — l'économie n'y vaudrait pas
  // le grain.
  const estStorage = (s: string | null | undefined): s is string =>
    typeof s === "string" && s.length > 0 && !s.startsWith("/");
  const pleins = questions.map((q) => q.photo).filter(estStorage);
  const petits = [
    ...questions.flatMap((q) => (q.photosOptions ?? []) as (string | undefined)[]),
    ...(classement ?? []).map((l) => l.photo_url),
  ].filter(estStorage);
  const [liensPleins, liensPetits] = await Promise.all([
    signedPhotos(supabase, pleins),
    signedPhotos(supabase, petits, { petit: true }),
  ]);
  const liens = new Map([...liensPetits, ...liensPleins]);
  const resoudre = (chemin: string | undefined) =>
    chemin ? (chemin.startsWith("/") ? chemin : liens.get(chemin)) : undefined;
  const aJouer = questions.map((q) => ({
    ...q,
    ...(q.photo ? { photo: resoudre(q.photo) } : {}),
    ...(q.photosOptions
      ? { photosOptions: q.photosOptions.map((c) => resoudre(c)) }
      : {}),
  }));

  if (questions.length === 0) {
    // Le message générique aurait laissé croire que le quiz entier est vide
    // alors que seule la branche demandée l'est — et le joueur serait reparti
    // en pensant le jeu cassé plutôt qu'en essayant une autre branche.
    return (
      <p className="py-8 text-center text-muted">
        {stricte ? (
          <>
            Pas encore assez de liens renseignés chez les {stricte} pour
            composer une partie.{" "}
            <Link href="/quiz" className="underline underline-offset-4">
              Revenir au quiz normal
            </Link>
          </>
        ) : (
          "Pas encore assez de liens renseignés pour composer un quiz."
        )}
      </p>
    );
  }

  /**
   * Tout ce qui se dit AUTOUR de la partie : la flamme, les règles du score, la
   * porte vers les autres niveaux.
   *
   * 🔑 Cela reste utile avant de jouer et après, jamais pendant — et pendant,
   * cela coûtait cher : mesuré en mode confort sur un écran de téléphone, plus
   * de mille cent pixels s'empilaient avant les réponses, soit près de six cents
   * pixels à faire défiler À CHAQUE QUESTION, chronomètre en marche. Le mode
   * confort a été construit pour les trente-neuf personnes de quatre-vingts ans
   * et plus — celles qui détiennent les albums et reconnaissent les visages — et
   * le quiz l'annulait.
   *
   * `QuizGame` reçoit donc ce bloc et décide quand le montrer : il est le seul à
   * savoir si une partie est en cours.
   */
  const entete = (
    <>
      {/* La flamme parle AVANT la partie, parce que c'est avant qu'elle se
          sauve : à ce moment-là, jouer aujourd'hui est exactement ce qu'on
          s'apprête à faire. Muette sous deux jours — une flamme d'un jour
          n'est pas encore une série — et muette une fois la partie du jour
          jouée : elle a eu ce qu'elle voulait. */}
      {serie.jours >= 2 && !serie.joue_aujourdhui && (
        <p className="mt-2 text-sm">
          🔥 <strong>{serie.jours} jours d&apos;affilée</strong> — jouez
          aujourd&apos;hui pour garder votre flamme.
        </p>
      )}
      {serie.jours >= 2 && serie.joue_aujourdhui && (
        <p className="mt-2 text-sm text-muted">
          🔥 {serie.jours} jours d&apos;affilée — la flamme est au chaud pour
          aujourd&apos;hui.
        </p>
      )}
      {/* Les règles avant de jouer, mais repliées : celui qui se lance n'a pas
          à les lire, celui qui se demande pourquoi son score a bondi trouve la
          réponse sans quitter la partie. */}
      <Aide titre="Comment on compte les points">
        Vingt secondes par question. Une bonne réponse vaut cent points, la
        rapidité en rapporte cent de plus au mieux, et chaque bonne réponse
        d&apos;affilée multiplie le tout — jusqu&apos;au double.{" "}
        <strong>Répondre vite compte donc presque autant que savoir.</strong> Vos
        questions ne sont jamais les mêmes, et votre meilleur score reste sur cet
        appareil.
        {/* Le 🔥 du classement n'était expliqué nulle part : Anna a dû
            demander. Les règles du jeu sont le seul endroit où l'on vient
            chercher ce genre de réponse. */}
        <br />
        <br />
        Le <strong>🔥 du classement</strong> compte les jours de suite où
        quelqu&apos;un a joué. Il apparaît à partir de deux jours et
        s&apos;éteint dès qu&apos;on en saute un.
      </Aide>
      {/* Dire d'où viennent les questions, et laisser en sortir d'un geste.
          Une partie orientée sans le dire se lit comme un hasard bizarre :
          « pourquoi je tombe toujours sur les mêmes ? ». Le bandeau répond
          avant qu'on se pose la question.

          Trois portes, parce que les joueurs ne demandent pas la même chose.
          Le niveau 1 reste chez soi — sa branche, puis son camp — pour qui
          trouvait « trop dur ». Le niveau 2 est le tour du propriétaire :
          l'autre maison et les aïeux du tableau peint. Le niveau 3 tire dans
          tout l'arbre, pour qui trouve au contraire revoir toujours les
          siens. Aucun ne remplace les autres. */}
      {/* Choisir sa branche : la quatrième porte, repliée. Les trois niveaux
          répondent à « c'est trop dur » et « je revois toujours les miens » ;
          celle-ci répond à une autre demande — réviser UNE branche, la sienne
          ou celle qu'on s'apprête à rencontrer au déjeuner de dimanche.

          Repliée, parce qu'elle ne concerne pas le joueur ordinaire : neuf
          liens dépliés en haut de page pousseraient la partie hors de l'écran,
          exactement ce que le mode confort a coûté à réparer. */}
      {!stricte && (
        <Aide titre="Jouer sur une seule branche">
          Une partie qui ne pose de questions que sur les gens d&apos;une seule
          branche — personne d&apos;autre, et pas de questions de pays. Une
          petite branche donne une partie plus courte&nbsp;: c&apos;est normal,
          et le nombre est annoncé avant de commencer.
          <br />
          <br />
          {(branches ?? []).map((b, i) => (
            <span key={b.name}>
              {i > 0 && " · "}
              <Link
                href={`/quiz?branche=${encodeURIComponent(b.name)}`}
                className="underline underline-offset-4"
              >
                {b.name}
              </Link>
            </span>
          ))}
        </Aide>
      )}
      {stricte ? (
        <p className="mt-4 rounded-lg border border-accent-line bg-accent-surface px-3 py-2.5 text-sm">
          <strong>Uniquement les {stricte}</strong> —{" "}
          {/* Le compte est dit AVANT de jouer, jamais découvert à la fin. Les
              Lanvin sont onze : une partie sur leur branche ne fera pas dix
              questions, et laisser croire le contraire pour se rattraper avec
              des cousins d'ailleurs serait exactement le « succès avec 14 %
              sauté en silence » qu'on refuse partout ailleurs sur ce site. */}
          {questions.length === 10
            ? "dix questions"
            : `${questions.length} question${questions.length > 1 ? "s" : ""} seulement — c'est tout ce que cette branche peut donner pour l'instant`}
          .{" "}
          <Link href="/quiz" className="underline underline-offset-4">
            Revenir au quiz normal
          </Link>
        </p>
      ) : niveau === 3 ? (
        <p className="mt-4 rounded-lg border border-accent-line bg-accent-surface px-3 py-2.5 text-sm">
          <strong>Toute la famille</strong> — tirage au hasard dans l&apos;arbre
          entier, sans favoriser votre branche.{" "}
          <Link href="/quiz" className="underline underline-offset-4">
            Revenir chez moi
          </Link>
        </p>
      ) : niveau === 2 ? (
        <p className="mt-4 rounded-lg border border-accent-line bg-accent-surface px-3 py-2.5 text-sm">
          <strong>Niveau 2</strong> —{" "}
          {campDe(maBranche)
            ? `${campDe(maBranche) === "Moulin" ? "la Bastide" : "le Moulin"} et les aïeux`
            : "les aïeux et toutes les branches"}
          . Les questions les plus dures du jeu.{" "}
          <Link href="/quiz" className="underline underline-offset-4">
            Revenir au niveau 1
          </Link>
        </p>
      ) : maBranche ? (
        <p className="mt-4 rounded-lg border border-line bg-card px-3 py-2.5 text-sm">
          <strong>Niveau 1</strong> — quatre questions sur les{" "}
          <strong>{maBranche}</strong>, deux sur les cousins{" "}
          {campDe(maBranche) === "Bastide" ? "de la Bastide" : "du Moulin"}, deux de
          pays.{" "}
          <Link href="/quiz?niveau=2" className="underline underline-offset-4">
            Tenter le niveau 2
          </Link>{" "}
          ·{" "}
          <Link href="/quiz?niveau=3" className="underline underline-offset-4">
            Toute la famille au hasard
          </Link>
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted">
          Les questions portent sur toute la famille.{" "}
          <Link href="/quiz?niveau=2" className="underline underline-offset-4">
            Tenter le niveau 2 (les aïeux)
          </Link>
        </p>
      )}
    </>
  );

  return (
    <div className="py-2">
      <h1 className="serif text-2xl font-semibold">Qui est qui ?</h1>

      <QuizGame
        questions={aJouer}
        classement={classement ?? []}
        branches={parBranche ?? []}
        camps={camps ?? []}
        photos={liens}
        nomsBranches={(branches ?? []).map((b) => b.name)}
        entete={entete}
      />
    </div>
  );
}
