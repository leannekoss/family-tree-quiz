import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { signedPhotos } from "@/lib/photos";
import { noteJouable } from "@/lib/quiz";
import LocalTree from "@/components/LocalTree";
import PhotoUpload from "@/components/PhotoUpload";
import PartagerFiche from "@/components/PartagerFiche";
import SupprimerFiche from "@/components/SupprimerFiche";
import Portrait from "@/components/Portrait";
import ChoisirEmoji from "@/components/ChoisirEmoji";
import History, { type Change } from "@/components/History";
import RetourQuiz from "@/components/RetourQuiz";
import Signaler from "@/components/Signaler";
import Notes from "@/components/Notes";
import Sources, { type Source } from "@/components/Sources";
import Parente from "@/components/Parente";
import SurLesPhotos, { type Apparition } from "@/components/SurLesPhotos";
import type { Parente as LienParente } from "@/lib/parente";
import Aide from "@/components/Aide";
import FilAriane from "@/components/FilAriane";
import { fullName, lifeSpan, ageLisible, type Sibling } from "@/lib/types";

// `branch_id` sert la couleur du liseré dans l'arbre : c'est ce qui répond,
// sans lire un nom, à « il est de quel côté ? ».
const CARD_FIELDS =
  "id, first_name, last_name, married_name, birth_display, death_display, deceased, photo_url, sex, branch_id, emoji";

export default async function Fiche({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: person } = await supabase
    .from("people")
    .select(
      `*, father:father_id(${CARD_FIELDS}), mother:mother_id(${CARD_FIELDS}), branch:branch_id(name), place:place_id(id, name, commune)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!person) notFound();

  const [
    { data: siblings },
    { data: unions },
    { data: children },
    { data: history },
    { data: lien },
  ] = await Promise.all([
      supabase.rpc("siblings", { target: id }),
      supabase
        .from("unions")
        .select(`id, kind, date_display, p1:p1_id(${CARD_FIELDS}), p2:p2_id(${CARD_FIELDS})`)
        .or(`p1_id.eq.${id},p2_id.eq.${id}`),
      supabase
        .from("people")
        .select(CARD_FIELDS)
        .or(`father_id.eq.${id},mother_id.eq.${id}`)
        .order("birth_year", { nullsFirst: false }),
      supabase
        .from("audit_log")
        .select("id, action, changed_at, old_data, new_data")
        .eq("row_id", id)
        .order("changed_at", { ascending: false })
        .limit(20),
      // Le lien de parenté avec qui regarde. Il tient en une ligne de résultat :
      // le calcul reste en base, sans quoi il faudrait télécharger toute la
      // filiation à chaque fiche ouverte.
      supabase.rpc("parente", { cible: id }).maybeSingle(),
    ]);

  // filter(Boolean) ne rétrécit pas le type en TypeScript, d'où le prédicat.
  const notNull = <T,>(v: T | null): v is T => v !== null;

  const parents = [person.father, person.mother].filter(notNull);

  const spouses = (unions ?? [])
    .map((u) => {
      const other = u.p1?.id === id ? u.p2 : u.p1;
      if (!other) return null;
      return {
        ...other,
        // « union » est le mot de la BASE, pas celui de la famille : à
        // l'écran il se lit comme un mariage — c'est même son sens courant.
        // Une cousine non mariée voyait « UNION » sur sa carte, et sa mère a
        // corrigé. On affiche « en couple », qui ne prête rien à personne.
        tag:
          u.kind === "union"
            ? "en couple"
            : u.date_display
              ? `${u.kind} ${u.date_display}`
              : u.kind,
        kind: u.kind,
      };
    })
    .filter(notNull);

  // siblings() rend désormais la photo, le nom d'usage et la branche : la
  // requête qui les cherchait ensuite a disparu, et avec elle un aller-retour
  // complet vers la base au milieu du rendu.
  const siblingNodes = ((siblings ?? []) as Sibling[]).map((s) => ({
    ...s,
    tag: s.kind === "demi" ? "demi" : null,
  }));

  // `parente()` ne renseigne la nature du lien que pour SON PROPRE conjoint :
  // pour une alliance — le conjoint d'un cousin — elle rend `lien_kind` vide,
  // et la phrase retombait sur « l'époux de », marié ou non. La page a déjà la
  // réponse sous la main : `spouses` porte le `kind` de chaque union. On
  // complète ici plutôt que de rouvrir une fonction récursive de cent lignes.
  // Ce qui manque à cette fiche, dit en français plutôt qu'en booléens : c'est
  // ce texte même qui s'affiche et qui part dans le message.
  // L'indice du code famille — « monf*********** » — pour qui l'a tapé une fois
  // il y a dix jours et doit maintenant dépanner quelqu'un. Calculé en base
  // (`indice_code`), jamais écrit ici : un fragment de secret n'a rien à faire
  // dans le dépôt, et surtout il mentirait le jour où le code changerait.
  // Facultatif : s'il manque, la phrase se lit très bien sans lui.
  const { data: indiceCode } = await supabase.rpc("indice_code");

  // L'adresse vient de la requête : elle suit le domaine réel, y compris en
  // aperçu de déploiement et en local, plutôt qu'une URL figée dans le code.
  const host = (await headers()).get("host") ?? "votre-arbre.vercel.app";
  const protocole = host.startsWith("localhost") ? "http" : "https";
  const urlFiche = `${protocole}://${host}/personne/${id}`;

  // Dix-huit ans, le même seuil que le quiz : en deçà, on ne demande pas à
  // quelqu'un de remplir sa propre fiche. Une année de naissance inconnue ne
  // vaut pas « mineur » — dans le doute on demande, c'est le cas courant.
  const majeure =
    !person.birth_year || new Date().getFullYear() - person.birth_year >= 18;

  const sansPhoto = !person.photo_url;
  // 🔑 `noteJouable` et non « le champ est-il vide » : cent soixante-neuf fiches
  // portent une note qui n'en est pas une — « La Gazette n° 12, page 35 »,
  // « nom déduit de la fratrie ». Écrites à l'import, elles faisaient passer
  // ces fiches pour remplies, et le rappel « il manque deux mots » ne s'y
  // affichait jamais. Ce sont pourtant exactement celles qu'il faut compléter.
  const sansNotes = !noteJouable(person.notes);
  const manque =
    sansPhoto && sansNotes
      ? "une photo et deux mots"
      : sansPhoto
        ? "une photo"
        : sansNotes
          ? "deux mots sur elle ou lui"
          : null;

  // Sa propre fiche : on ne se demande pas à soi-même de se compléter. Le
  // rattachement compte soixante-dix membres sur soixante et onze, la
  // comparaison est donc fiable ; `maybeSingle` sur `members` ne rend que la
  // ligne du visiteur, RLS s'en charge.
  const { data: membre } = await supabase
    .from("members")
    .select("person_id, is_admin")
    .maybeSingle();
  const maFiche = membre?.person_id === id;

  const lienBrut = lien as LienParente | null;
  const lienComplet: LienParente | null = lienBrut?.conjoint
    ? {
        ...lienBrut,
        lien_kind:
          lienBrut.lien_kind ??
          spouses.find((s) => s.id === lienBrut.conjoint!.id)?.kind ??
          null,
      }
    : lienBrut;

  // Les photos de groupe où cette personne est pointée. Le portrait carré
  // d'une fiche jette le jour, les gens autour et la maison derrière : sur une
  // vieille photo, c'est justement ce qu'on vient voir.
  // Les relevés extérieurs qui désignent cette personne. Lus, jamais recopiés :
  // la fiche affiche la source sans qu'aucune écriture n'ait eu lieu.
  const { data: sources } = await supabase
    .from("familysearch_import")
    .select("pid, nom_complet, ne, mort")
    .eq("person_id", id);

  const { data: mesReperes } = await supabase
    .from("photo_marks")
    .select("id, photo_id, x, y, photo:photo_id(id, storage_path, caption, taken)")
    .eq("person_id", id);

  const photoIds = (mesReperes ?? []).map((m) => m.photo_id);
  const { data: voisins } = photoIds.length
    ? await supabase
        .from("photo_marks")
        .select("photo_id, person_id, people:person_id(first_name, last_name, married_name)")
        .in("photo_id", photoIds)
        .not("person_id", "is", null)
    : { data: [] };

  const cheminsGroupe = (mesReperes ?? [])
    .map((m) => m.photo?.storage_path)
    .filter((s): s is string => Boolean(s));
  const liensGroupe = await signedPhotos(supabase, cheminsGroupe);

  const apparitions: Apparition[] = (mesReperes ?? [])
    .filter((m) => m.photo && liensGroupe.get(m.photo.storage_path))
    .map((m) => ({
      markId: m.id,
      photoId: m.photo!.id,
      src: liensGroupe.get(m.photo!.storage_path)!,
      caption: m.photo!.caption,
      taken: m.photo!.taken,
      x: m.x,
      y: m.y,
      avec: (voisins ?? [])
        .filter((v) => v.photo_id === m.photo_id && v.person_id !== id && v.people)
        .map((v) => ({ id: v.person_id!, nom: fullName(v.people!) })),
    }));

  // 🔑 Deux tailles, parce que deux usages. Le portrait de la personne
  // s'ouvre en plein écran d'un doigt : il lui faut la pleine définition.
  // L'entourage — parents, conjoints, fratrie, enfants — ne s'affiche qu'en
  // pastilles de quarante à cinquante-six pixels, et partait pourtant en
  // mille : une fiche de famille nombreuse pesait plus d'un mégaoctet
  // d'images pour des ronds gros comme un ongle. Sur mobile, d'où viennent
  // neuf visites sur dix, c'est la page la plus ouverte du site.
  const entourage = [...parents, ...spouses, ...siblingNodes, ...(children ?? [])];
  const [photosPleines, photosPetites] = await Promise.all([
    signedPhotos(supabase, [person.photo_url]),
    signedPhotos(supabase, entourage.map((p) => p.photo_url), { petit: true }),
  ]);
  const photos = new Map([...photosPetites, ...photosPleines]);

  return (
    <article>
      <RetourQuiz />

      {/* On arrive ici par la recherche, le quiz, la carte ou l'arbre de
          quelqu'un d'autre : sans ce fil, le seul retour était le bouton du
          navigateur. */}
      <FilAriane
        etapes={[
          { label: "Chercher", href: "/" },
          { label: fullName(person) },
        ]}
      />

      <header className="mb-6 flex items-start gap-4">
        {/* Touchable pour voir le visage en grand : le geste existait déjà
            chez les lecteurs, il ne rencontrait rien. */}
        <Portrait
          src={person.photo_url ? photos.get(person.photo_url) : null}
          name={fullName(person)}
          size={72}
        />
        <div className="min-w-0">
          <h1 className="serif text-3xl font-semibold leading-tight">
            {/* L'emblème AVANT le nom : c'est ce qu'on repère de loin dans une
                liste, et il doit se lire dans le même ordre partout. */}
            {person.emoji && (
              <span aria-hidden className="mr-1.5">
                {person.emoji}
              </span>
            )}
            {fullName(person)}
          </h1>
          <p className="mt-1 text-muted">
            {lifeSpan(person)}
            {ageLisible(person) && <> · {ageLisible(person)}</>}
            {person.branch?.name && (
              <>
                {lifeSpan(person) && " · "}
                branche {person.branch.name}
              </>
            )}
          </p>
          {person.nickname && (
            <p className="mt-1 text-sm text-muted">dit « {person.nickname} »</p>
          )}
          {/* Les lieux sous les dates, pas sur la carte : celle-ci porte les
              trente maisons de Monflanquin et se lit déjà difficilement — y
              jeter Strasbourg, Mulhouse et Niederbronn achèverait de la rendre
              illisible. Ces lieux-là racontent autre chose : l'Alsace d'avant
              1871, puis l'exil. */}
          {(person.birth_place || person.death_place) && (
            <p className="mt-1 text-sm text-muted">
              {person.birth_place && (
                <>
                  {person.sex === "F" ? "Née" : person.sex === "M" ? "Né" : "Né·e"} à{" "}
                  {person.birth_place}
                </>
              )}
              {person.birth_place && person.death_place && " · "}
              {person.death_place && (
                <>
                  {person.sex === "F" ? "morte" : person.sex === "M" ? "mort" : "mort·e"} à{" "}
                  {person.death_place}
                </>
              )}
            </p>
          )}
          {person.place && (
            <p className="mt-1 text-sm">
              {/* L'identifiant voyage dans le lien : « Le Colombier » nu
                  ouvrait la carte des trente maisons sans en désigner aucune,
                  et le père d'Camille en a conclu que la commune était fausse —
                  quand on n'arrive pas là où on visait, on soupçonne la
                  donnée. Même correctif que la recherche hier : un lien vers
                  une maison mène à CETTE maison, bulle ouverte. */}
              <Link
                href={`/lieux?maison=${person.place.id}`}
                className="underline underline-offset-4"
              >
                {person.place.name}
                {person.place_detail && ` — ${person.place_detail}`}
              </Link>
              {person.place.commune && (
                <span className="text-muted"> · {person.place.commune}</span>
              )}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {/* En haut, et non plus après six boutons d'ajout : la première
                personne à signaler une erreur par WhatsApp avait sous les yeux
                une fiche entièrement modifiable — elle ne l'avait pas vu, le
                bouton était sous le pli. Ce qui touche à CETTE fiche se fait
                ici ; ajouter des proches reste plus bas. */}
            <Link
              href={`/personne/${id}/edit`}
              className="inline-block rounded-lg border border-accent-line bg-accent-surface px-4 py-2 text-sm font-medium"
            >
              Corriger cette fiche
            </Link>
            <PhotoUpload personId={id} hasPhoto={Boolean(person.photo_url)} />
            {/* Envoyer la fiche à quelqu'un. À côté de « Corriger », parce que
                c'est le même geste de départ — on est sur CETTE fiche et on
                veut en faire quelque chose. Sans condition : la demande venait
                d'un cas que « Demander de compléter » ne couvre pas, envoyer à
                sa sœur la fiche de leur grand-père. */}
            <PartagerFiche
              nom={fullName(person)}
              prenom={person.first_name.split(" ")[0]}
              url={urlFiche}
              indiceCode={indiceCode}
              /* Les trois conditions de l'ancien « Demander de compléter »,
                 conservées telles quelles — elles décident maintenant du
                 MESSAGE, plus de l'affichage du bouton. Une personne décédée ne
                 remplit pas sa fiche, une fiche déjà pleine n'a rien à
                 réclamer, et se le demander à soi-même n'a aucun sens. */
              /* ⚠️ Et MAJEURE. Léonie Morel a deux ans : « Personne ne la
                 connaît mieux que Léonie » partait dans WhatsApp à des parents
                 qu'on invitait à demander à leur bébé de se raconter. L'ancien
                 bouton ne testait que le décès — le défaut existait avant, il
                 se voyait moins en bas de page. Sa fiche se partage toujours,
                 on ne lui réclame simplement rien. */
              ilManque={
                !person.deceased && !maFiche && majeure ? manque : null
              }
            />
            {/* À côté du dépôt de photo, jamais à sa place : l'emblème se
                choisit en trois secondes quand une photo demande d'aller la
                chercher. Le premier ne doit pas dispenser du second — il reste
                trois cent soixante-dix visages à trouver. */}
            <ChoisirEmoji personId={id} nom={person.first_name} actuel={person.emoji} />
          </div>
          {/* Une infobulle au survol n'existe pas sur un téléphone, et c'est
              justement là que sont les hésitants. La phrase est donc écrite,
              petite mais toujours lue : ce qui retient n'est pas de ne pas
              savoir corriger, c'est la peur d'abîmer la fiche d'un autre. */}
          <p className="mt-2 text-xs text-muted">
            Vous pouvez corriger sans crainte : rien ne se perd, tout se défait.
          </p>
        </div>
      </header>

      {/* Avant l'arbre : on veut savoir où l'on se situe par rapport à cette
          personne avant de regarder qui l'entoure. */}
      <Parente lien={lienComplet} cibleFeminin={person.sex === "F"} />

      <LocalTree
        person={person}
        parents={parents}
        siblings={siblingNodes}
        spouses={spouses}
        children={children ?? []}
        photos={photos}
      />

      <SurLesPhotos
        apparitions={apparitions}
        personId={id}
        nom={fullName(person)}
        prenom={person.first_name.split(" ")[0]}
        aPhoto={Boolean(person.photo_url)}
      />

      {/* Les armes de la famille, décrites plutôt que dessinées.
          « Croix d'argent sur champ d'azur, cantonnée de quatre étoiles d'or »
          se lit, se vérifie contre le tableau et se corrige ; un écusson dessiné
          demanderait un blasonnement exact dont chaque erreur se verrait.
          Seuls les aïeux du tableau peint en portent — cinquante-quatre fiches
          sur quatre cent soixante-sept. */}
      {person.blason && (
        <p className="mt-6 rounded-xl border border-accent-line bg-accent-surface p-4 text-sm">
          <span className="text-muted">Armes des {person.last_name} : </span>
          {person.blason}
        </p>
      )}

      {person.notes && <Notes texte={person.notes} />}

      <Sources sources={(sources ?? []) as Source[]} />


      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
          {/* « Corriger cette fiche » est remonté dans l'en-tête : ce groupe ne
              garde que l'ajout de proches, un geste différent. */}
          {/* La descendance que le bulletin ne connaît pas est précisément ce
              que la famille peut apporter. Sans ce bouton, il fallait créer la
              fiche ailleurs — or nulle part ne le permettait. */}
          <Link
            href={`/personne/${id}/enfant`}
            className="inline-block rounded-lg border border-line px-4 py-2 text-sm"
          >
            Ajouter un enfant
          </Link>
          {/* On savait descendre l'arbre, jamais le remonter : « Corriger »
              choisit un parent parmi les fiches existantes, rien n'en créait.
              Le bouton n'apparaît que s'il MANQUE un parent — le proposer à
              qui en a deux fabriquerait des doublons. */}
          {(!person.father_id || !person.mother_id) && (
            <Link
              href={`/personne/${id}/parent`}
              className="inline-block rounded-lg border border-line px-4 py-2 text-sm"
            >
              Ajouter {!person.father_id && !person.mother_id ? "ses parents" : !person.father_id ? "son père" : "sa mère"}
            </Link>
          )}
          {/* Un frère se déclare chez le PARENT : c'est un enfant de plus du
              même couple, et c'est la seule façon dont une fratrie existe dans
              un arbre. Le bouton fait le détour à la place du lecteur — sans
              parent connu, il n'y a nulle part où accrocher, et le bouton
              renvoie d'abord vers l'ajout du parent. */}
          <Link
            href={
              person.father_id || person.mother_id
                ? `/personne/${person.father_id ?? person.mother_id}/enfant`
                : `/personne/${id}/parent`
            }
            className="inline-block rounded-lg border border-line px-4 py-2 text-sm"
          >
            Ajouter un frère ou une sœur
          </Link>
          {/* Le mariage est le premier changement que la vie apporte à un
              arbre, et c'était le seul qu'on ne pouvait pas déclarer. */}
          <Link
            href={`/personne/${id}/conjoint`}
            className="inline-block rounded-lg border border-line px-4 py-2 text-sm"
          >
            Ajouter un conjoint
          </Link>
          {/* Pour qui sait qu'une information est fausse sans connaître la
              bonne — ou pour qui n'ose pas modifier la fiche d'un autre. */}
          <Signaler nom={fullName(person)} />
        </div>
        {/* Réservé au gardien, et volontairement en bas : effacer n'est pas un
            geste courant, il ne doit pas voisiner avec « corriger ». Il existe
            pour UN cas — le doublon qu'un membre vient de créer et qu'il ne
            peut pas défaire lui-même, la policy `people_del` lui refusant le
            droit depuis le 10/08. Chaque doublon passait sinon par un message
            au gardien puis par une requête écrite à la main. */}
        {membre?.is_admin && (
          <div className="mt-4">
            <SupprimerFiche
              personId={id}
              nom={fullName(person)}
              rattachee={(children ?? []).length > 0 || spouses.length > 0}
            />
          </div>
        )}
        {/* Les gens n'osent pas toucher aux fiches des autres. Dire que tout se
            défait lève l'hésitation mieux qu'une invitation à corriger. */}
        <Aide titre="Je peux vraiment modifier ?">
          Oui, et sans crainte : <strong>chaque changement est daté, signé et
          se défait en un geste</strong> depuis l&apos;historique en bas de page.
          Rien ne se perd, personne ne valide. Une date approximative vaut mieux
          qu&apos;une case vide — écrivez « vers 1950 » si vous ne savez plus.
          Si vous préférez que quelqu&apos;un s&apos;en charge,{" "}
          <strong>demandez une correction</strong> : le message part avec le nom
          et le lien de la fiche déjà écrits.
        </Aide>
      </div>

      <History changes={(history ?? []) as Change[]} />
    </article>
  );
}
