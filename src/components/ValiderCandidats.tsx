"use client";

import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { deposerPhoto, recupererFichier } from "@/lib/photo-envoi";

export type Candidat = {
  id: number;
  personId: string;
  nom: string;
  age: string | null;
  site: string;
  titre: string;
  lien: string;
  pourquoi: string | null;
  confiance: string;
  url: string; // lien signé de l'image candidate
};

const TON: Record<string, string> = {
  "sûr": "border-accent-line bg-accent-surface text-accent",
  plausible: "border-line bg-card text-muted",
  douteux: "border-line bg-line/30 text-muted",
  alerte: "border-alerte bg-alerte/10 font-medium text-alerte",
};

const DIT: Record<string, string> = {
  "sûr": "un fait recoupe la fiche",
  plausible: "vraisemblable, non vérifié",
  douteux: "à vérifier de près",
  alerte: "cette personne ne publie rien en ligne",
};

/**
 * Une photo trouvée en ligne n'est jamais posée d'office. Sur les essais menés :
 * une certaine, une plausible, une qui était probablement une homonyme. Aucune
 * règle automatique ne sépare ces cas — quelqu'un de la famille, si, en une
 * seconde. D'où deux boutons, une grande image, et la provenance en clair :
 * c'est elle qui permet de juger.
 */
export default function ValiderCandidats({ candidats }: { candidats: Candidat[] }) {
  const [rang, setRang] = useState(0);
  const [busy, setBusy] = useState(false);
  const [gardees, setGardees] = useState(0);
  const [refusees, setRefusees] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);

  const c = candidats[rang];

  if (!c) {
    if (gardees + refusees === 0) return null;
    return (
      <section className="mb-8 rounded-xl border border-line bg-card px-4 py-8 text-center">
        <p className="serif text-xl">
          {gardees > 0 && `${gardees} photo${gardees > 1 ? "s" : ""} gardée${gardees > 1 ? "s" : ""}`}
          {gardees > 0 && refusees > 0 && ", "}
          {refusees > 0 && `${refusees} écartée${refusees > 1 ? "s" : ""}`}.
        </p>
        <p className="mt-1 text-sm text-muted">
          C&apos;est tout ce que j&apos;ai trouvé en ligne pour l&apos;instant.
        </p>
      </section>
    );
  }

  async function garder() {
    setBusy(true);
    setErreur(null);
    try {
      const fichier = await recupererFichier(c.url);
      await deposerPhoto(supabaseBrowser(), c.personId, fichier);
      setGardees((n) => n + 1);
      setRang((r) => r + 1);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "envoi impossible");
    } finally {
      setBusy(false);
    }
  }

  async function ecarter() {
    setBusy(true);
    await supabaseBrowser().rpc("refuser_candidat", { candidat: c.id });
    setRefusees((n) => n + 1);
    setRang((r) => r + 1);
    setBusy(false);
  }

  return (
    <section className="mb-8">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="serif text-lg">Trouvées en ligne</h2>
        <span className="text-sm tabular-nums text-muted">
          {rang + 1}/{candidats.length}
        </span>
      </div>

      {/* La carte est bornée en largeur : en pleine page le portrait carré
          faisait sept cents pixels de haut et repoussait les deux boutons hors
          de l'écran — on jugeait sans voir ce sur quoi on allait cliquer. */}
      <div
        className={`mx-auto max-w-sm overflow-hidden rounded-2xl border bg-card ${
          c.confiance === "alerte" ? "border-2 border-alerte" : "border-line"
        }`}
      >
        {/* Une personne qui n'a jamais rien publié ne peut pas avoir de photo en
            ligne. S'il y en a une, c'est une homonyme ou une fuite depuis un
            compte privé — jamais une trouvaille. Le bandeau se met AVANT
            l'image : le temps qu'on la regarde, on sait déjà quoi en penser. */}
        {c.confiance === "alerte" && (
          <p className="bg-alerte px-4 py-2.5 text-sm font-medium text-sur-plein">
            Attention : cette personne n&apos;a jamais mis de photo en ligne.
            Cette image vient donc de quelqu&apos;un d&apos;autre, ou d&apos;un
            compte qui n&apos;aurait pas dû être public. Écartez-la.
          </p>
        )}
        {/* Le format carré est celui de l'avatar que cette photo deviendra :
            autant juger ce qu'on obtiendra. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={c.url}
          alt=""
          className="aspect-square w-full bg-background object-cover"
        />

        <div className="p-4">
          <p className="serif text-xl leading-tight">
            Est-ce bien{" "}
            <Link href={`/personne/${c.personId}`} className="underline underline-offset-4">
              {c.nom}
            </Link>
            {c.age && <span className="text-muted"> ({c.age})</span>} ?
          </p>

          <p
            className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-xs ${
              TON[c.confiance] ?? TON.douteux
            }`}
          >
            {DIT[c.confiance] ?? DIT.douteux}
          </p>

          {c.pourquoi && <p className="mt-2 text-sm text-muted">{c.pourquoi}</p>}

          <p className="mt-2 text-sm text-muted">
            {c.titre} —{" "}
            <a
              href={c.lien}
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-4"
            >
              {c.site}
            </a>
          </p>

          {erreur && <p className="mt-3 text-sm text-accent">{erreur}</p>}

          {/* Écarter à gauche, garder à droite : le geste doit être le même à
              chaque carte, sinon on valide par réflexe ce qu'on voulait rejeter. */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {/* Les deux boutons gardent leur place quel que soit le niveau —
                un bouton qui se déplace se clique par réflexe. Seul le poids
                visuel s'inverse sur une alerte : c'est « écarter » qui devient
                le geste plein, et « garder » qui demande d'y penser. */}
            <button
              onClick={ecarter}
              disabled={busy}
              className={`rounded-xl px-4 py-3 font-medium disabled:opacity-50 ${
                c.confiance === "alerte"
                  ? "bg-alerte text-sur-plein"
                  : "border border-line"
              }`}
            >
              Ce n&apos;est pas {c.nom.split(" ")[0]}
            </button>
            <button
              onClick={garder}
              disabled={busy}
              className={`rounded-xl px-4 py-3 font-medium disabled:opacity-50 ${
                c.confiance === "alerte"
                  ? "border border-line"
                  : "bg-accent text-sur-plein"
              }`}
            >
              {busy ? "…" : "Oui, c'est bien"}
            </button>
          </div>

          <p className="mt-3 text-xs text-muted">
            Dans le doute, écartez : une photo ajoutée sur la mauvaise fiche ne se
            corrige que si quelqu&apos;un s&apos;en aperçoit.
            {gardees > 0 && <span className="text-acquis"> {gardees} gardée{gardees > 1 ? "s" : ""}.</span>}
          </p>
        </div>
      </div>
    </section>
  );
}
