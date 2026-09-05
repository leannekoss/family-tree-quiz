import { ImageResponse } from "next/og";
import { NOM_FAMILLE, TITRE } from "@/lib/famille";

/**
 * La vignette qui s'affiche quand le lien arrive sur WhatsApp.
 *
 * Le lien va partir dans un groupe de cent seize personnes, la plupart sans
 * autre contexte qu'un message. Sans Open Graph, WhatsApp n'affiche qu'une
 * ligne grise avec l'adresse — indiscernable d'un lien douteux, et c'est
 * précisément ce qu'on ne clique pas quand on a soixante-dix ans.
 *
 * 🔑 Rien de sensible dessus, et c'est une contrainte, pas une négligence : une
 * vignette Open Graph est mise en cache par WhatsApp et voyage avec le lien à
 * chaque transfert, y compris hors de la famille. Le nom de la famille et ce
 * que contient le site, pas un visage ni un chiffre de plus.
 *
 * Les couleurs sont celles du site, écrites en dur : cette image est fabriquée
 * hors du navigateur, aucune variable CSS n'y est résolue.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = TITRE;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#faf7f2",
          color: "#2b2521",
          padding: "0 90px",
          // La bande terracotta sur toute la hauteur : c'est ce qu'on
          // distingue d'une vignette de 200 px de large dans une liste de
          // discussions, bien avant de lire le titre.
          borderLeft: "24px solid #9c4221",
        }}
      >
        <div style={{ fontSize: 30, color: "#6b6058", letterSpacing: 1 }}>
          {`FAMILLE ${NOM_FAMILLE.toUpperCase()}`}
        </div>
        <div
          style={{
            fontSize: 86,
            fontWeight: 700,
            lineHeight: 1.05,
            marginTop: 18,
          }}
        >
          L&apos;arbre de la famille
        </div>
        <div style={{ fontSize: 36, color: "#6b6058", marginTop: 26 }}>
          Qui est qui, avant de tous se retrouver en juin
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 44, fontSize: 30 }}>
          {["Les fiches", "Le quiz", "La carte des maisons"].map((t) => (
            <div
              key={t}
              style={{
                border: "2px solid #d9b3a0",
                background: "#f6ece6",
                color: "#9c4221",
                borderRadius: 14,
                padding: "10px 22px",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
