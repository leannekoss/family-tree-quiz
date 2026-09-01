"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Choisir le visage dans une photo avant de l'envoyer.
 *
 * Trois raisons, dans l'ordre d'importance :
 *
 * 1. **Ce qui n'est pas cadré ne part pas.** Sur une photo où figure un enfant,
 *    recadrer sur l'adulte laisse l'enfant sur le téléphone — il n'entre jamais
 *    en base. C'est la seule façon propre d'utiliser une photo prise à deux.
 * 2. Les avatars sont ronds. Une photo en pied envoyée telle quelle donne une
 *    pastille où l'on voit un torse, et le visage nulle part.
 * 3. Personne n'a de portrait cadré sous la main : on a des photos de vacances.
 *
 * La mécanique est celle de la page « Retrouver les visages », qui découpe déjà
 * dans les photos du bulletin — mais elle y était enfermée, utilisable seulement
 * sur les photos que le site connaissait d'avance.
 */

/** Part de la plus grande dimension prise par le carré, au palier 1. */
const CADRE = 0.3;
const PALIERS = [0.4, 0.6, 1, 1.5, 2.2];
const DEPART = 2;

export default function Recadrer({
  fichier,
  onValider,
  onAnnuler,
}: {
  fichier: File;
  onValider: (blob: Blob) => void;
  onAnnuler: () => void;
}) {
  const image = useRef<HTMLImageElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [palier, setPalier] = useState(DEPART);
  const [apercu, setApercu] = useState<string | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(fichier);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [fichier]);

  // Le découpage se fait sur l'image telle qu'elle a été chargée, pas telle
  // qu'elle est affichée : à l'écran elle est réduite de moitié, et découper
  // dans la version réduite donnerait un visage de quarante pixels.
  const decouper = useCallback((x: number, y: number, facteur: number): Promise<Blob | null> => {
    const img = image.current;
    if (!img) return Promise.resolve(null);

    const cote = Math.round(
      Math.max(img.naturalWidth, img.naturalHeight) * CADRE * PALIERS[facteur],
    );
    const gauche = Math.max(0, Math.min(img.naturalWidth - cote, Math.round(x - cote / 2)));
    const haut = Math.max(0, Math.min(img.naturalHeight - cote, Math.round(y - cote / 2)));

    const canvas = document.createElement("canvas");
    canvas.width = cote;
    canvas.height = cote;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(img, gauche, haut, cote, cote, 0, 0, cote, cote);

    return new Promise((r) => canvas.toBlob((b) => r(b), "image/jpeg", 0.9));
  }, []);

  // Le palier change sans qu'on ait à repointer : on garde le même centre.
  useEffect(() => {
    if (!point) return;
    let vivant = true;
    decouper(point.x, point.y, palier).then((b) => {
      if (vivant && b) setApercu(URL.createObjectURL(b));
    });
    return () => {
      vivant = false;
    };
  }, [point, palier, decouper]);

  function viser(e: React.MouseEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const boite = img.getBoundingClientRect();
    setPoint({
      x: ((e.clientX - boite.left) / boite.width) * img.naturalWidth,
      y: ((e.clientY - boite.top) / boite.height) * img.naturalHeight,
    });
  }

  async function valider() {
    if (!point) return;
    const blob = await decouper(point.x, point.y, palier);
    if (blob) onValider(blob);
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-accent bg-accent-surface p-3">
      <p className="text-sm">
        {apercu ? (
          <>C&apos;est bien ce visage ? Ajustez si besoin.</>
        ) : (
          <strong>Touchez le visage à garder.</strong>
        )}
      </p>

      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={image}
          src={url}
          alt=""
          onClick={viser}
          className="max-h-72 w-full cursor-crosshair rounded-lg object-contain"
        />
      )}

      {apercu && (
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={apercu}
            alt=""
            className="mx-auto aspect-square w-28 rounded-full border border-accent object-cover"
          />
          {/* Rond, comme il apparaîtra sur la fiche : montrer un carré ferait
              valider un cadrage dont les coins seront rognés. */}
          <div className="mt-2 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPalier((p) => Math.max(0, p - 1))}
              disabled={palier === 0}
              className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Resserrer
            </button>
            <button
              type="button"
              onClick={() => setPalier((p) => Math.min(PALIERS.length - 1, p + 1))}
              disabled={palier === PALIERS.length - 1}
              className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Élargir
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={valider}
          disabled={!point}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-sur-plein disabled:opacity-50"
        >
          Enregistrer ce visage
        </button>
        {/* Une photo déjà cadrée n'a pas à passer par le découpage : l'étape
            deviendrait une corvée pour le cas le plus simple. */}
        <button
          type="button"
          onClick={() => onValider(fichier)}
          className="rounded-lg border border-line bg-card px-4 py-2 text-sm"
        >
          Garder la photo entière
        </button>
        <button
          type="button"
          onClick={onAnnuler}
          className="rounded-lg px-4 py-2 text-sm text-muted underline underline-offset-4"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
