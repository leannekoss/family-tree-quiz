"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { deposerPhoto } from "@/lib/photo-envoi";

export type Tache = {
  id: number;
  position: string | null;
  nom: string;
  personId: string;
  source: string;
  caption: string;
  taken: string | null;
  url: string; // lien signé de la photo de groupe
};

// Part de la plus grande dimension prise par le carré. Réglé à l'écran : à 15 %
// le cadre attrapait trois convives du dîner de la page 16. Mieux vaut partir
// trop serré — on voit tout de suite qu'il manque le menton, alors qu'un cadre
// trop large passe pour correct et donne un avatar où l'on ne distingue
// personne. Les deux boutons couvrent le reste, du buste au gros plan.
const CADRE = 0.12;
const PALIERS = [0.55, 0.75, 1, 1.35, 1.8];
const DEPART = 1;

export default function PoserVisages({ taches: initiales }: { taches: Tache[] }) {
  const [taches, setTaches] = useState(initiales);
  const [rang, setRang] = useState(0);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [palier, setPalier] = useState(DEPART);
  const [apercu, setApercu] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [posees, setPosees] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);

  const image = useRef<HTMLImageElement>(null);
  const t = taches[rang];

  // Le recadrage se fait sur l'image telle qu'elle est chargée, pas telle
  // qu'elle est affichée : sur un téléphone la photo est réduite de moitié, et
  // découper dans la version réduite donnerait un visage en 40 pixels.
  const decouper = useCallback(
    (x: number, y: number, facteur: number): Promise<Blob | null> => {
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
    },
    [],
  );

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

  function suivante() {
    setPoint(null);
    setApercu(null);
    setPalier(DEPART);
    setRang((r) => r + 1);
  }

  async function valider() {
    if (!point || !t) return;
    setBusy(true);
    setErreur(null);
    try {
      const blob = await decouper(point.x, point.y, palier);
      if (!blob) throw new Error("découpe impossible");
      const fichier = new File([blob], "visage.jpg", { type: "image/jpeg" });
      await deposerPhoto(supabaseBrowser(), t.personId, fichier);

      setPosees((n) => n + 1);
      // Une personne peut figurer sur deux photos : une fois posée, ses autres
      // tâches n'ont plus lieu d'être.
      setTaches((all) => all.filter((x) => x.id === t.id || x.personId !== t.personId));
      suivante();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "envoi impossible");
    } finally {
      setBusy(false);
    }
  }

  async function passer() {
    if (!t) return;
    // On note qui a passé, pour ne pas reproposer indéfiniment le même visage à
    // quelqu'un qui ne le reconnaît pas. Les autres continuent de le voir.
    // Si l'enregistrement échoue, on passe quand même : la tâche reviendra à la
    // prochaine visite, ce qui est un moindre mal comparé à un bouton qui ne
    // répond pas.
    await supabaseBrowser().rpc("passer_tache", { tache: t.id });
    suivante();
  }

  if (!t) {
    return (
      <div className="rounded-xl border border-line bg-card px-4 py-10 text-center">
        <p className="serif text-2xl">
          {posees > 0
            ? `${posees} visage${posees > 1 ? "s" : ""} retrouvé${posees > 1 ? "s" : ""}. Merci.`
            : "Plus personne à retrouver ici."}
        </p>
        <p className="mt-2 text-muted">
          Les autres visages ne sont sur aucune photo du bulletin : ils viendront
          de vos albums.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/photos" className="rounded-lg bg-accent px-5 py-3 font-medium text-sur-plein">
            Ajouter mes photos
          </Link>
          <Link href="/quiz" className="rounded-lg border border-line px-5 py-3 font-medium">
            Au quiz
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="serif text-xl leading-tight">
          {apercu ? "C'est bien " : "Touchez le visage de "}
          <Link href={`/personne/${t.personId}`} className="underline underline-offset-4">
            {t.nom}
          </Link>
          {apercu ? " ?" : ""}
        </p>
        <span className="shrink-0 text-sm tabular-nums text-muted">
          {rang + 1}/{taches.length}
        </span>
      </div>

      {t.position && !apercu && (
        <p className="mb-3 text-sm text-muted">
          D&apos;après la légende : {t.position}.
        </p>
      )}

      {apercu ? (
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={apercu}
            alt=""
            className="mx-auto aspect-square w-40 rounded-xl border border-accent object-cover"
          />

          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              onClick={() => setPalier((p) => Math.max(0, p - 1))}
              disabled={palier === 0}
              className="rounded-lg border border-line px-3 py-1.5 text-sm disabled:opacity-40"
              aria-label="Resserrer le cadrage"
            >
              Resserrer
            </button>
            <button
              onClick={() => setPalier((p) => Math.min(PALIERS.length - 1, p + 1))}
              disabled={palier === PALIERS.length - 1}
              className="rounded-lg border border-line px-3 py-1.5 text-sm disabled:opacity-40"
              aria-label="Élargir le cadrage"
            >
              Élargir
            </button>
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              onClick={valider}
              disabled={busy}
              className="rounded-lg bg-accent px-6 py-3 font-medium text-sur-plein disabled:opacity-50"
            >
              {busy ? "Envoi…" : `Oui, c'est ${t.nom.split(" ")[0]}`}
            </button>
            <button
              onClick={() => {
                setPoint(null);
                setApercu(null);
              }}
              className="rounded-lg border border-line px-5 py-3"
            >
              Reprendre
            </button>
          </div>
        </div>
      ) : null}

      {/* La photo reste visible sous l'aperçu : on veut pouvoir re-viser sans
          rien fermer. */}
      <figure className={apercu ? "mt-6 opacity-60" : ""}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* `crossOrigin` est indispensable, pas décoratif : la photo vient du
            stockage Supabase, donc d'une autre origine. Sans cet attribut elle
            s'affiche parfaitement — et le canvas qui la découpe devient
            inexportable, avec une SecurityError au moment du toBlob(). Le
            stockage répond « Access-Control-Allow-Origin: * », il ne manquait
            que la demande. */}
        <img
          ref={image}
          src={t.url}
          alt={t.caption}
          crossOrigin="anonymous"
          onClick={viser}
          className="w-full cursor-crosshair rounded-xl border border-line"
        />
        <figcaption className="mt-2 text-xs text-muted">
          {t.source}
          {t.taken && ` — ${t.taken}`}. {t.caption}
        </figcaption>
      </figure>

      {erreur && <p className="mt-3 text-sm text-accent">{erreur}</p>}

      <div className="mt-5 flex items-center justify-between gap-3">
        <button onClick={passer} className="text-sm text-muted underline underline-offset-4">
          Je ne la reconnais pas
        </button>
        {posees > 0 && (
          <span className="text-sm text-acquis">
            {posees} ajouté{posees > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
