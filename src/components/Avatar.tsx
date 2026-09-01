/**
 * Un visage, ou son initiale. La pastille vide n'est pas un manque à combler
 * visuellement : c'est le repère qui montre où la famille peut encore aider.
 */
export default function Avatar({
  src,
  name,
  size = 40,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  const initial = name.trim().charAt(0).toUpperCase();

  if (!src) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size, fontSize: size * 0.42 }}
        className="inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-background font-medium text-muted"
      >
        {initial}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire,
    // l'optimiseur d'images de Next le remettrait en cache après expiration.
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      /* 🔑 Les portraits sont stockés en 1000 px — cent trente-sept kilo-octets
         en moyenne — et s'affichent ici en quarante. Le plan Supabase gratuit
         ne redimensionne pas à la volée : à défaut, on ne télécharge que ce qui
         entre dans l'écran. Sur un classement de douze joueurs, c'est un méga-
         octet et demi qui ne part plus au premier affichage. */
      loading="lazy"
      decoding="async"
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full border border-line object-cover"
    />
  );
}
