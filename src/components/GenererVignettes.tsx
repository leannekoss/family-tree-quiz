"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { deposerVignette } from "@/lib/photo-envoi";

/**
 * Fabrique après coup les vignettes des photos déjà déposées.
 *
 * 🔑 AUCUNE PHOTO N'EST TOUCHÉE. On lit l'original, on écrit un fichier
 * NOUVEAU sous le préfixe `vignettes/`, et c'est tout : pas de suppression, pas
 * de remplacement, pas d'écriture au chemin d'origine. Si la fabrication rate,
 * la photo reste affichée en pleine taille comme avant — le pire cas est de ne
 * rien gagner.
 *
 * 🔑 Le travail se fait dans CE navigateur, avec la session de l'administrateur :
 * le redimensionnement demande un canvas, et la clé de service n'existe nulle
 * part côté serveur.
 *
 * 🔑 Par lots de cinq, en reprenant là où l'on s'est arrêté : trente-deux
 * méga-octets à rapatrier et renvoyer ne tiennent pas dans une requête, et une
 * page fermée en cours de route ne doit rien casser — on relance, les vignettes
 * déjà faites sont sautées.
 */
export default function GenererVignettes() {
  const [etat, setEtat] = useState<"prêt" | "travaille" | "fini">("prêt");
  const [faites, setFaites] = useState(0);
  const [restantes, setRestantes] = useState<number | null>(null);
  const [journal, setJournal] = useState<string[]>([]);

  async function aFaire(sb: ReturnType<typeof supabaseBrowser>) {
    // Les chemins réellement utilisés par une fiche : inutile de fabriquer des
    // vignettes pour des photos que plus personne n'affiche.
    const { data } = await sb.from("people").select("photo_url").not("photo_url", "is", null);
    const chemins = [...new Set((data ?? []).map((p) => p.photo_url as string))];

    const { data: existantes } = await sb.storage
      .from("visages")
      .createSignedUrls(chemins.map((c) => `vignettes/${c}`), 60);
    const deja = new Set(
      (existantes ?? []).filter((e) => e.signedUrl && !e.error).map((e) => e.path?.replace(/^vignettes\//, "")),
    );
    return chemins.filter((c) => !deja.has(c));
  }

  async function lancer() {
    setEtat("travaille");
    const sb = supabaseBrowser();
    const liste = await aFaire(sb);
    setRestantes(liste.length);
    if (liste.length === 0) {
      setEtat("fini");
      return;
    }

    let n = 0;
    for (let i = 0; i < liste.length; i += 5) {
      const lot = liste.slice(i, i + 5);
      const { data: liens } = await sb.storage.from("visages").createSignedUrls(lot, 300);
      await Promise.all(
        (liens ?? []).map(async (l) => {
          if (!l.path || !l.signedUrl) return;
          const ok = await deposerVignette(sb, l.path, l.signedUrl);
          n += ok ? 1 : 0;
          if (!ok) setJournal((j) => [...j.slice(-4), `sautée : ${l.path}`]);
        }),
      );
      setFaites(n);
      setRestantes(liste.length - Math.min(i + 5, liste.length));
    }
    setEtat("fini");
  }

  return (
    <section className="mt-8 rounded-xl border border-line bg-card p-4">
      <h2 className="serif text-lg">Alléger les photos</h2>
      <p className="mt-1 text-sm text-muted">
        Fabrique une petite copie de chaque portrait, pour que les listes de
        visages se chargent sans télécharger les grandes images.{" "}
        <strong>Aucune photo n&apos;est modifiée ni supprimée</strong> : ce sont
        de nouveaux fichiers, à côté des originaux.
      </p>

      {etat === "prêt" && (
        <button
          onClick={lancer}
          className="mt-3 min-h-11 rounded-lg bg-accent px-5 font-medium text-sur-plein"
        >
          Fabriquer les petites copies
        </button>
      )}

      {etat === "travaille" && (
        <p className="mt-3 text-sm">
          {faites} faites{restantes !== null ? ` · ${restantes} à traiter` : ""} —
          laissez cette page ouverte.
        </p>
      )}

      {etat === "fini" && (
        <p className="mt-3 text-sm text-acquis">
          {faites > 0 ? `${faites} petites copies fabriquées.` : "Tout était déjà fait."}{" "}
          Rien n&apos;a été supprimé.
        </p>
      )}

      {journal.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-muted">
          {journal.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
