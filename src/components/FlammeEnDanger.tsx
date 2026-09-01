import Link from "next/link";

/**
 * La flamme sur l'accueil — et seulement quand elle risque de s'éteindre.
 *
 * 🔑 La série existait déjà, mais uniquement sur la page du quiz : elle ne
 * parlait donc qu'à ceux qui étaient DÉJÀ revenus. Or c'est exactement
 * l'inverse qu'on veut. Mesuré le 15/08 : un seul joueur tenait une série de
 * trois jours, et il ne pouvait la voir menacée qu'en ouvrant lui-même le quiz.
 *
 * 🔑 Ce bandeau ne s'affiche QUE dans le cas où il sert : deux jours au moins,
 * et la partie du jour pas encore jouée. Une flamme déjà sauvée n'a rien à
 * demander, une flamme d'un jour n'est pas une série. Le reste du temps, la
 * page ne dit rien — un rappel permanent devient un décor qu'on ne voit plus.
 */
export default function FlammeEnDanger({ jours }: { jours: number }) {
  return (
    <Link
      href="/quiz"
      className="mb-6 flex items-center gap-3 rounded-xl border border-accent-line bg-accent-surface px-4 py-3"
    >
      <span aria-hidden className="text-2xl">
        🔥
      </span>
      <span className="min-w-0 text-sm">
        <strong>{jours} jours d&apos;affilée.</strong> Une partie aujourd&apos;hui
        et votre flamme tient — sinon elle repart de zéro demain.
      </span>
    </Link>
  );
}
