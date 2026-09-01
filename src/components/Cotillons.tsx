"use client";

/**
 * Les cotillons de fin de partie.
 *
 * Trente losanges de papier qui tombent une fois, puis disparaissent. Pas de
 * librairie : trente `<span>` et une image-clé suffisent, là où un moteur de
 * particules pèserait plus lourd que tout le reste de l'application réunie.
 *
 * ⚠️ Ils ne tombent PAS à chaque partie. Une fête qui a lieu tous les jours
 * n'est plus une fête : à la troisième, on ne la voit plus, et à la dixième
 * elle agace. Ils sont réservés à un nouveau record personnel ou à une entrée
 * sur le podium — voir `QuizGame`.
 *
 * `prefers-reduced-motion` les supprime entièrement. Pour qui souffre du mal
 * des transports ou de troubles vestibulaires, une pluie d'objets à l'écran ne
 * fait pas plaisir : elle donne la nausée.
 */
export default function Cotillons() {
  // Les couleurs de la maison, plus l'or de la fête. Aucune teinte étrangère à
  // la palette : des confettis fluo dans un site terre et olive feraient tache.
  const couleurs = ["#9c4221", "#55603f", "#d4a24c", "#7d7269", "#c98a5e"];

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden motion-reduce:hidden"
    >
      {Array.from({ length: 30 }, (_, i) => (
        <span
          key={i}
          className="animate-cotillon absolute block h-2.5 w-1.5"
          style={{
            // Réparti sur la largeur, sans hasard : deux cotillons au même
            // endroit font un tas, pas une pluie.
            left: `${(i * 100) / 30 + (i % 3) - 1}%`,
            background: couleurs[i % couleurs.length],
            // Chacun part avec un léger retard et une durée propre, sinon les
            // trente descendent comme un rideau.
            animationDelay: `${(i % 10) * 0.12}s`,
            animationDuration: `${2.4 + (i % 5) * 0.35}s`,
          }}
        />
      ))}
    </div>
  );
}
