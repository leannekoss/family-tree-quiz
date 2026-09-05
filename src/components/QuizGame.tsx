"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import RaccourcisQuiz from "@/components/RaccourcisQuiz";
import PartagerScore from "@/components/PartagerScore";
import Cotillons from "@/components/Cotillons";
import Podium from "@/components/Podium";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Question } from "@/lib/quiz";
import Classement, { type Ligne, type LigneBranche, type LigneCamp } from "@/components/Classement";
import {
  SECONDES,
  points,
  multiplicateur,
  rang,
  maximum,
  lirePartie,
  sauverPartie,
  oublierPartie,
  lireRecord,
  garderRecord,
  type Partie,
} from "@/lib/partie";
import { THEME_PAYS } from "@/lib/famille";

const neuve = (questions: Question[]): Partie => ({
  questions,
  step: 0,
  score: 0,
  justes: 0,
  serie: 0,
  meilleureSerie: 0,
  ratees: [],
});

export default function QuizGame({
  questions,
  classement,
  branches,
  camps,
  photos = new Map(),
  nomsBranches,
  entete,
}: {
  questions: Question[];
  classement: Ligne[];
  branches: LigneBranche[];
  camps: LigneCamp[];
  photos?: Map<string, string>;
  nomsBranches: string[];
  /**
   * La flamme, les règles du score, la porte vers les autres niveaux. Montré
   * avant la partie et après, JAMAIS pendant : en mode confort il fallait
   * défiler près de six cents pixels à chaque question pour atteindre les
   * réponses, chronomètre en marche.
   */
  entete?: React.ReactNode;
}) {
  const router = useRouter();

  // `null` tant que le stockage n'a pas été consulté : afficher la question 1
  // puis sauter à la question 6 une frame plus tard serait plus déroutant
  // qu'un court instant de silence.
  const [partie, setPartie] = useState<Partie | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [resteMs, setResteMs] = useState(SECONDES * 1000);
  const [gain, setGain] = useState<number | null>(null);
  const [record, setRecord] = useState(0);
  const [nouveauRecord, setNouveauRecord] = useState(false);
  const [reprise, setReprise] = useState(false);
  // Le chronomètre ne part qu'au « Commencer ». Il tournait dès l'arrivée sur
  // la page, pendant qu'on cherchait encore à comprendre l'écran : un lecteur
  // lent perdait ses premières secondes à lire, pas à répondre.
  const [lance, setLance] = useState(false);

  // Le stockage du navigateur n'existe pas au rendu serveur : le lire pendant
  // le rendu ferait diverger l'hydratation. C'est le cas que cette règle ne
  // couvre pas — synchroniser React avec un système externe au montage.
  useEffect(() => {
    const encours = lirePartie();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPartie(encours ?? neuve(questions));
    setReprise(Boolean(encours));
    if (encours && encours.step > 0 && encours.step < encours.questions.length) {
      setLance(true);
    } else {
      setLance(false);
    }
    setRecord(lireRecord());

    if (encours && encours.step >= encours.questions.length) oublierPartie();
  }, [questions]);

  /**
   * Retenir les questions de pays servies, pour que la partie suivante en
   * propose d'autres.
   *
   * 🔑 Un cookie et non le `localStorage` : c'est le SERVEUR qui compose la
   * partie, il doit donc connaître les questions déjà vues avant de rendre la
   * page — et seul un cookie remonte tout seul avec la requête.
   *
   * On borne à quarante rangs : au-delà, le stock a forcément été parcouru et
   * garder l'historique complet ne servirait qu'à faire grossir le cookie.
   */
  useEffect(() => {
    const servies = questions.map((q) => q.cle).filter((c): c is number => c !== undefined);
    if (servies.length === 0) return;

    const avant = (document.cookie.match(/(?:^|; )pays_vus=([^;]*)/)?.[1] ?? "")
      .split(",")
      .map(Number)
      .filter(Number.isInteger);

    const tout = [...new Set([...avant, ...servies])].slice(-40);
    document.cookie = `pays_vus=${tout.join(",")}; path=/; max-age=31536000; samesite=lax`;
  }, [questions]);

  useEffect(() => {
    const servies = questions
      .map((q) => q.personId)
      .filter((id): id is string => id !== null);
    if (servies.length === 0) return;

    const avant = (document.cookie.match(/(?:^|; )personnes_vues=([^;]*)/)?.[1] ?? "")
      .split(",")
      .filter((s) => s.length > 8);

    const tout = [...new Set([...avant, ...servies])].slice(-60);
    document.cookie = `personnes_vues=${tout.join(",")}; path=/; max-age=31536000; samesite=lax`;
  }, [questions]);

  // Le compte à rebours lit la partie par référence. En dépendre directement le
  // ferait repartir de zéro au moindre changement de score — c'est-à-dire à
  // chaque réponse, sur la question qu'on est en train de jouer.
  // Le bloc de jeu, pour y revenir à chaque question sans repasser par le menu.
  const cadre = useRef<HTMLDivElement>(null);
  const courante = useRef<Partie | null>(null);
  useEffect(() => {
    courante.current = partie;
  });

  /**
   * Remonter au bloc de jeu au « Commencer », comme après chaque réponse.
   *
   * 🔑 Le défilement existait entre deux questions mais pas au démarrage : la
   * PREMIÈRE question naissait donc sous la barre de navigation, chronomètre
   * déjà lancé. Mesuré en mode confort sur un écran de téléphone, la barre
   * s'empile sur près de cinq cents pixels — les réponses commençaient à 806 px
   * pour un écran de 844, il fallait défiler avant de pouvoir répondre.
   *
   * L'effet est ici, et non dans le gestionnaire du bouton : au moment du clic,
   * le bloc de jeu n'est pas encore monté et `cadre` vaut null.
   */
  useEffect(() => {
    if (lance) cadre.current?.scrollIntoView({ block: "start" });
  }, [lance]);

  const repondre = useCallback((choix: number, reste: number) => {
    const p = courante.current;
    if (!p) return;

    const juste = choix === p.questions[p.step].answer;
    const serie = juste ? p.serie + 1 : 0;
    const g = juste ? points(reste, serie) : 0;

    const score = p.score + g;
    setGain(g);
    setChosen(choix);
    setPartie({
      ...p,
      score,
      justes: p.justes + (juste ? 1 : 0),
      serie,
      meilleureSerie: Math.max(p.meilleureSerie, serie),
      ratees: juste ? p.ratees : [...p.ratees, { step: p.step, donne: choix }],
    });

    // Le record se joue à la dernière réponse, pas au clic sur « Voir mon
    // score » : sinon partir lire une fiche depuis la dernière question ferait
    // perdre la partie entière.
    if (p.step === p.questions.length - 1) setNouveauRecord(garderRecord(score));
  }, []);

  const step = partie?.step ?? 0;
  const fini = Boolean(partie) && step >= partie!.questions.length;

  // Le compte à rebours redémarre à chaque question et s'arrête dès qu'on a
  // répondu. Une réponse non donnée compte comme fausse : le temps fait partie
  // du jeu, sinon la question reste ouverte indéfiniment.
  useEffect(() => {
    if (!partie || fini || chosen !== null || !lance) return;

    // Le temps se compte par tranches entre deux battements, jamais depuis un
    // instant de départ fixe. Un téléphone qui se verrouille, un appel qui
    // arrive, un passage par WhatsApp : Android gèle l'onglet, et une soustraction
    // à l'instant de départ ferait revenir sur « Temps écoulé » sans avoir pu
    // répondre. Ici, le temps passé ailleurs n'est simplement pas compté — la
    // question attend.
    let dernier = Date.now();
    let ecoule = 0;

    const reprendre = () => {
      // Au retour, on repart de maintenant : la tranche passée en arrière-plan
      // est perdue pour le compteur, ce qui est exactement voulu.
      dernier = Date.now();
    };
    document.addEventListener("visibilitychange", reprendre);

    const id = setInterval(() => {
      if (document.hidden) return;
      const maintenant = Date.now();
      ecoule += maintenant - dernier;
      dernier = maintenant;

      const reste = SECONDES * 1000 - ecoule;
      if (reste <= 0) {
        clearInterval(id);
        setResteMs(0);
        repondre(-1, 0);
      } else {
        setResteMs(reste);
      }
    }, 100);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", reprendre);
    };
  }, [step, chosen, fini, partie, repondre, lance]);

  if (!partie) {
    return <div className="h-64 animate-pulse rounded-xl border border-line bg-card" />;
  }

  if (fini) {
    const { titre, mot } = rang(partie.score, partie.questions.length);
    return (
      <div className="animate-monte py-6 text-center">
        {/* Les cotillons ne tombent qu'à un nouveau record : une fête qui a
            lieu à chaque partie n'est plus une fête, et à la dixième elle
            agace. Ils sont supprimés sous prefers-reduced-motion. */}
        {nouveauRecord && <Cotillons />}
        <p className="text-sm uppercase tracking-widest text-muted">{titre}</p>
        <p className="serif mt-2 text-5xl font-semibold tabular-nums">{partie.score}</p>
        <p className="text-sm text-muted">
          points sur {maximum(partie.questions.length)} possibles
        </p>
        <p className="mt-4 text-muted">{mot}</p>

        <dl className="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-2 text-center">
          <Chiffre valeur={`${partie.justes}/${partie.questions.length}`} legende="justes" />
          <Chiffre valeur={`${partie.meilleureSerie}`} legende="meilleure série" />
          <Chiffre valeur={`${Math.max(record, partie.score)}`} legende="record" />
        </dl>

        {nouveauRecord && (
          <p className="mt-4 font-medium text-acquis">Nouveau record personnel.</p>
        )}

        {/* Juste après le score, au moment où l'on a envie de le dire. Placé
            plus bas — après le récapitulatif des erreurs — il arriverait quand
            l'élan est retombé. */}
        <div className="mt-5 flex justify-center">
          <PartagerScore
            score={partie.score}
            justes={partie.justes}
            total={partie.questions.length}
          />
        </div>

        {/* Le podium après le score et le partage : on veut d'abord savoir ce
            qu'on a fait, ensuite qui est devant. C'est ce qui donne envie de
            rejouer — un « Pruneau d'or » se reprend, un premier rang non. */}
        <div className="text-left">
          <Podium compact />
        </div>

        {/* Le seul endroit où le quiz apprend vraiment quelque chose. Pendant
            la partie, la bonne réponse s'affiche une seconde et le joueur
            enchaîne ; ici il la relit au calme, et peut ouvrir la fiche de
            celui qu'il n'a pas su reconnaître. */}
        {partie.ratees.length > 0 && (
          <section className="mt-8 text-left">
            <h2 className="serif mb-3 text-lg font-semibold">
              Ce qui vous a échappé
            </h2>
            <ul className="space-y-3">
              {partie.ratees.map(({ step, donne }) => {
                const q = partie.questions[step];
                if (!q) return null;
                return (
                  <li
                    key={step}
                    className="rounded-lg border border-line bg-card px-3 py-3"
                  >
                    <p className="text-sm">{q.prompt}</p>
                    <p className="mt-1.5 text-sm">
                      <span className="text-muted">Réponse : </span>
                      <span className="font-medium text-acquis">
                        {q.options[q.answer]}
                      </span>
                    </p>
                    {donne >= 0 && (
                      <p className="text-sm text-muted">
                        Vous aviez dit {q.options[donne]}.
                      </p>
                    )}
                    {q.personId && (
                      <Link
                        href={`/personne/${q.personId}`}
                        className="mt-1.5 inline-block text-sm underline underline-offset-4"
                      >
                        Voir sa fiche
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Le classement arrive après le récapitulatif : d'abord ce qu'on a
            appris, ensuite où l'on se situe. L'inverse ferait fermer la page
            avant d'avoir lu les bonnes réponses. */}
        <div className="mt-10 text-left">
          <Classement
            lignes={classement}
            branches={branches}
            camps={camps}
            photos={photos}
            nomsBranches={nomsBranches}
            partie={{
              score: partie.score,
              justes: partie.justes,
              total: partie.questions.length,
            }}
          />
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={rejouer}
            className="rounded-lg bg-accent px-5 py-3 font-medium text-sur-plein"
          >
            Rejouer
          </button>
          <Link href="/photos" className="rounded-lg border border-line px-5 py-3 font-medium">
            Ajouter une photo
          </Link>
        </div>

        {/* Les autres niveaux APRÈS le score, et non avant : « tenter le niveau
            2 » est une proposition qui se comprend quand on vient de finir, pas
            quand on cherche le bouton pour commencer. */}
        <div className="mt-8 text-left">{entete}</div>
      </div>
    );
  }

  if (!lance) {
    const pays = partie.questions.filter((x) => x.kind === "pays").length;
    return (
      <>
      {entete}
      <div className="animate-monte mt-6 rounded-xl border border-line bg-card px-4 py-8 text-center">
        <p className="serif text-2xl">Prêt ?</p>
        <p className="mx-auto mt-3 max-w-sm text-muted">
          {partie.questions.length} questions, {SECONDES} secondes chacune.
          {pays > 0 && (
            <>
              {" "}
              {pays === 1 ? "L'une d'elles porte" : `${pays} d'entre elles portent`}{" "}
              sur {THEME_PAYS}.
            </>
          )}{" "}
          Répondre vite rapporte davantage, et les bonnes réponses d&apos;affilée
          comptent double.
        </p>
        <p className="mt-2 text-sm text-muted">
          Le chronomètre ne démarre qu&apos;au moment où vous commencez.
        </p>
        <button
          onClick={() => setLance(true)}
          autoFocus
          className="mt-6 rounded-lg bg-accent px-6 py-3 font-medium text-sur-plein"
        >
          Commencer
        </button>
        {record > 0 && (
          <p className="mt-4 text-sm text-muted">
            Votre record sur cet appareil : {record} points.
          </p>
        )}

        {/* Le score à battre, montré AVANT de jouer. Le classement n'existait
            qu'à la fin d'une partie : on découvrait donc qu'on avait été
            dépassé une fois la partie finie, quand il était trop tard pour que
            ça change quoi que ce soit à celle-là. Trois lignes suffisent — le
            tableau entier est à un lien. */}
        {classement.length > 0 && (
          <div className="mx-auto mt-8 max-w-sm rounded-xl border border-line bg-card px-4 py-3 text-left">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted">
              À battre
            </p>
            <ol className="space-y-1 text-sm">
              {classement.slice(0, 3).map((l, i) => (
                <li key={`${l.pseudo}-${l.played_at}`} className="flex justify-between gap-3">
                  <span className={l.a_moi ? "font-medium text-accent" : ""}>
                    {["🥇", "🥈", "🥉"][i]} {l.pseudo}
                  </span>
                  <span className="tabular-nums text-muted">{l.score}</span>
                </li>
              ))}
            </ol>
            <Link
              href="/classement"
              className="mt-3 inline-block text-sm underline underline-offset-4"
            >
              Tout le classement
            </Link>
          </div>
        )}
      </div>
      </>
    );
  }

  const q = partie.questions[partie.step];
  const answered = chosen !== null;
  const secondes = Math.ceil(resteMs / 1000);
  const part = resteMs / (SECONDES * 1000);
  const presse = !answered && secondes <= 5;

  return (
    // `scroll-mt-3` : sans cette marge, le compteur de questions se colle au
    // bord haut de l'écran et paraît coupé.
    <div ref={cadre} className="scroll-mt-3">
      {reprise && partie.step > 0 && (
        <p className="mb-4 rounded-lg border border-accent-line bg-accent-surface px-3 py-2 text-sm">
          Partie reprise où vous l&apos;aviez laissée.
        </p>
      )}

      <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted">
          Question {partie.step + 1} / {partie.questions.length}
        </span>
        <span className="flex items-center gap-3">
          {partie.serie >= 2 && (
            <span className="animate-battement font-medium text-acquis">
              série {partie.serie} · ×{multiplicateur(partie.serie)}
            </span>
          )}
          <span className="serif text-lg font-semibold tabular-nums">
            {partie.score}
            <span className="ml-1 text-xs font-normal text-muted">pts</span>
          </span>
        </span>
      </div>

      {/* Deux barres superposées : l'avancement dans la partie, puis le temps
          qui reste sur cette question. Le temps est le seul élément animé de
          l'écran, il attire donc l'œil sans qu'on ait à le souligner. */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-muted transition-[width] duration-300"
          style={{ width: `${(partie.step / partie.questions.length) * 100}%` }}
        />
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full ${
            answered ? "bg-line" : presse ? "animate-battement bg-accent" : "bg-accent"
          }`}
          style={{ width: `${Math.max(0, part) * 100}%` }}
        />
      </div>

      <div className="mt-5 flex items-start justify-between gap-4">
        <h2 className="serif text-2xl leading-snug">{q.prompt}</h2>
        {!answered && (
          <span
            className={`serif shrink-0 text-2xl tabular-nums ${
              presse ? "animate-battement text-accent" : "text-muted"
            }`}
            aria-label={`${secondes} secondes restantes`}
          >
            {secondes}
            <span className="ml-0.5 text-xs">s</span>
          </span>
        )}
      </div>
      {q.hint && <p className="mt-2 text-sm text-muted">{q.hint}</p>}

      {/* « Qui est-ce ? ». Un carré, centré, assez grand pour qu'on reconnaisse
          un visage sur un téléphone tenu à bout de bras — mais pas au point de
          repousser les réponses hors de l'écran : il faut voir la photo ET les
          quatre noms sans faire défiler, sinon le chronomètre gagne. */}
      {q.photo && (
        <div className="mt-4 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={q.photo}
            alt="Portrait à reconnaître"
            width={176}
            height={176}
            className="h-40 w-40 rounded-xl border border-line object-cover sm:h-44 sm:w-44"
          />
        </div>
      )}

      {/* Les questions de pays montrent l'endroit dont elles parlent. Hauteur
          fixe et `object-cover` : sans ça la page saute au chargement de
          l'image et le doigt clique sur la mauvaise réponse. */}
      {q.image && (
        <figure className="mt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={q.image.src}
            alt={q.image.alt}
            width={900}
            height={506}
            className="h-44 w-full rounded-lg border border-line object-cover sm:h-56"
          />
          <figcaption className="mt-1 text-right text-[11px] text-muted">
            {q.image.credit}
          </figcaption>
        </figure>
      )}

      {/* Au clavier, la vitesse coûte une seconde de moins qu'à la souris — et
          la vitesse est la moitié du score. */}
      <RaccourcisQuiz
        actif={!answered}
        nb={q.options.length}
        onRepondre={(i) => repondre(i, resteMs)}
        onSuivante={suivante}
      />

      {/* « Laquelle de ces personnes est X ? » — quatre visages en grille de
          deux, et non la liste verticale des autres questions : c'est le seul
          arrangement qui les fasse tenir tous les quatre dans l'écran d'un
          téléphone en même temps que l'énoncé. Les regarder ENSEMBLE est
          l'exercice ; devoir faire défiler pour comparer le remplacerait par un
          exercice de mémoire.

          🔑 Les noms n'apparaissent QU'APRÈS la réponse. Les afficher sous les
          visages donnait purement et simplement la solution : « Laquelle de ces
          personnes est Edouard Vernet ? » avec « Edouard Vernet » écrit
          sous la quatrième photo n'est plus une question. Avant de répondre on
          ne voit que des visages numérotés ; après, chaque nom se pose sous le
          sien — c'est là qu'on apprend, et c'est le seul moment où l'apprendre
          coûte quelque chose. */}
      {q.photosOptions ? (
        <ul className="mt-5 grid grid-cols-2 gap-2">
          {q.options.map((option, i) => (
            <li key={i}>
              <button
                onClick={() => !answered && repondre(i, resteMs)}
                disabled={answered}
                className={`flex w-full flex-col items-center gap-2 rounded-lg border px-2 py-3 transition-colors ${etat(i)}`}
              >
                {q.photosOptions![i] ? (
                  /* `alt` vide et non le nom : un lecteur d'écran l'annoncerait,
                     et la question serait résolue à voix haute. */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={q.photosOptions![i]}
                    alt=""
                    width={132}
                    height={132}
                    className="h-28 w-28 rounded-lg border border-line object-cover sm:h-32 sm:w-32"
                  />
                ) : (
                  <span className="flex h-28 w-28 items-center justify-center rounded-lg border border-line text-muted sm:h-32 sm:w-32">
                    ?
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-center text-sm">
                  {answered ? (
                    <>
                      {(i === q.answer || i === chosen) && (
                        <span aria-hidden className="font-semibold">
                          {i === q.answer ? "✓" : "✗"}
                        </span>
                      )}
                      {option}
                    </>
                  ) : (
                    // Le numéro tient la place du nom : il fait le nom
                    // accessible du bouton, et il rappelle la touche du clavier.
                    <span className="text-muted">Visage {i + 1}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
      <ul className="mt-5 space-y-2">
        {q.options.map((option, i) => (
          <li key={i}>
            <button
              onClick={() => !answered && repondre(i, resteMs)}
              disabled={answered}
              className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${etat(i)}`}
            >
              {answered && (i === q.answer || i === chosen) && (
                // La couleur seule ne suffit pas : un daltonien voyait deux
                // pastilles pareilles. Le signe dit la même chose sans elle.
                <span aria-hidden className="font-semibold">
                  {i === q.answer ? "✓" : "✗"}
                </span>
              )}
              {/* Le numéro de touche, montré seulement là où il y a un clavier.
                  Un raccourci que personne ne voit n'existe pas — et sur
                  téléphone, il n'occuperait de la place que pour rien. */}
              {!answered && (
                <kbd
                  aria-hidden
                  className="hidden shrink-0 rounded border border-line bg-background px-1.5 py-0.5 font-mono text-xs text-muted sm:inline-block"
                >
                  {i + 1}
                </kbd>
              )}
              <span className="min-w-0">{option}</span>
            </button>
          </li>
        ))}
      </ul>
      )}

      {answered && (
        <div className="animate-monte mt-5">
          <p className="text-center">
            {gain! > 0 ? (
              <>
                <span className="serif text-xl font-semibold text-acquis">+{gain} points</span>
                {/* Sur un portrait, le score ne suffit pas : ce qu'on veut
                    s'entendre dire, c'est qu'on a bien reconnu quelqu'un. Le
                    nom était affiché parmi quatre, avec une coche — il devient
                    une phrase. Réservé aux questions de visage : « c'est bien
                    1956 » ne réjouit personne. */}
                {(q.kind === "visage" || q.kind === "visage_inverse") && (
                  <span className="mt-1 block text-sm">
                    C’est bien <strong>{q.options[q.answer]}</strong>.
                  </span>
                )}
              </>
            ) : chosen === -1 ? (
              <span className="text-muted">Temps écoulé — la bonne réponse porte une coche.</span>
            ) : (
              <span className="text-muted">Raté. La bonne réponse porte une coche.</span>
            )}
          </p>

          {/* Ce qu'on retient, bonne OU mauvaise réponse — c'est l'idée volée
              à Elo.World : on ne repart jamais avec un simple vrai/faux, on
              repart avec trois lignes à raconter à table. Le texte vient de la
              base — le champ « En deux mots » quand la famille l'a rempli, la
              fiche qui se raconte sinon. */}
          {q.apprendre && (
            <p className="mx-auto mt-3 max-w-md rounded-lg border border-line bg-card px-3 py-2.5 text-center text-sm">
              <span aria-hidden>💡 </span>
              {q.apprendre}
            </p>
          )}

          {/* L'invitation tombe pile au bon moment : on vient de penser à
              cette personne, on sait qui elle est, et on a peut-être sa photo
              dans son téléphone. Elle n'apparaît qu'après la réponse, jamais
              pendant : le chrono tourne. */}
          {q.sansPhoto && (
            <Link
              href={`/personne/${q.personId}`}
              onClick={mettreDeCote}
              className="mt-4 block rounded-lg border border-accent-line bg-accent-surface px-3 py-2.5 text-sm"
            >
              <span className="font-medium">
                Personne n&apos;a encore mis de photo de {q.sansPhoto}.
              </span>{" "}
              <span className="text-muted">
                Vous en avez une ? Ajoutez-la, la partie vous attend.
              </span>
            </Link>
          )}

          <div className="sticky bottom-0 mt-4 flex items-center justify-between gap-4 border-t border-line bg-background pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            {q.personId ? (
              <Link
                href={`/personne/${q.personId}`}
                onClick={mettreDeCote}
                className={
                  q.kind === "visage"
                    ? "rounded-lg border border-accent-line bg-accent-surface px-3 py-2 text-sm font-medium"
                    : "text-sm text-muted underline underline-offset-4"
                }
              >
                {q.kind === "visage" ? "Voir sa fiche" : "Voir la fiche"}
              </Link>
            ) : (
              <span />
            )}
            <button
              onClick={suivante}
              autoFocus
              className="rounded-lg bg-accent px-5 py-2.5 font-medium text-sur-plein"
            >
              {partie.step + 1 === partie.questions.length ? "Voir mon score" : "Suivante"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  function suivante() {
    const p = courante.current;
    if (!p) return;
    const prochain = p.step + 1;

    setChosen(null);
    setGain(null);
    setResteMs(SECONDES * 1000);
    setPartie({ ...p, step: prochain });
    enHaut();
    if (prochain >= p.questions.length) oublierPartie();
  }

  // Rien ne défile tout seul : le bouton « Suivante » est en bas de l'écran, et
  // la question d'après s'affiche en haut. Sur un téléphone, on restait donc
  // devant les réponses de la question précédente.
  //
  // 🔑 On remonte au bloc de jeu, PAS au haut de la page. Le premier essai
  // faisait `window.scrollTo({top: 0})` et repassait au-dessus du menu, du
  // titre et du bandeau de niveau : « ça remonte trop du coup maintenant ». Il
  // faut atterrir sur le compteur de questions, qui ouvre le bloc — la question
  // et les réponses suivent immédiatement.
  //
  // Défilement instantané et non « smooth » : le chronomètre de la nouvelle
  // question a déjà commencé.
  function enHaut() {
    cadre.current?.scrollIntoView({ block: "start" });
  }

  function rejouer() {
    oublierPartie();
    setLance(false);
    setPartie(null);
    setChosen(null);
    setGain(null);
    setReprise(false);
    setNouveauRecord(false);
    setResteMs(SECONDES * 1000);
    enHaut();
    router.refresh();
  }

  // Aller lire une fiche au milieu d'une partie est le geste naturel : on veut
  // savoir qui est cette personne. La partie repart d'où on l'a laissée, à la
  // question suivante — celle-ci ayant déjà sa réponse.
  function mettreDeCote() {
    const p = courante.current;
    if (p) sauverPartie({ ...p, step: p.step + 1 });
  }

  // Après réponse, la bonne est toujours montrée : le but est d'apprendre qui
  // est qui, pas de sanctionner.
  function etat(i: number) {
    if (!answered) return "border-line hover:border-accent active:bg-accent-surface";
    if (i === q.answer) return "border-acquis bg-acquis-surface font-medium";
    if (i === chosen) return "border-line bg-line/40 line-through text-muted";
    return "border-line text-muted";
  }
}

function Chiffre({ valeur, legende }: { valeur: string; legende: string }) {
  return (
    <div className="rounded-lg border border-line bg-card px-2 py-3">
      <dt className="serif text-xl font-semibold tabular-nums">{valeur}</dt>
      <dd className="text-xs text-muted">{legende}</dd>
    </div>
  );
}
