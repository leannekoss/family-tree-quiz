import type { MetadataRoute } from "next";

// Le site est privé. Rien ne doit être exploré ni indexé, même la page de
// connexion : un moteur qui indexe /rejoindre expose l'existence du site.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
