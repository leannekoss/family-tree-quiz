import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sans ça, Next remonte jusqu'au package-lock.json de ~ pour tracer les fichiers.
  outputFileTracingRoot: __dirname,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // L'en-tête HTTP couvre aussi les réponses non-HTML, là où la balise
          // meta du layout ne s'applique qu'aux pages rendues.
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
          },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
