"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { deposerGroupe } from "@/lib/photo-envoi";

export type Candidate = { id: string; nom: string; branche: string | null; aPhoto: boolean };

/**
 * Le plafond du nombre de personnes cochées sur une même photo.
 *
 * Il était à 20, au motif qu'au-delà on ne coche plus, on tapisse. La première
 * vraie photo de groupe du bulletin l'a démenti : elle porte sa légende
 * imprimée — « De gauche à droite et de haut en bas » — et trente noms, dont
 * vingt-quatre déjà dans l'arbre. Refuser les six derniers pour tenir un chiffre
 * rond, c'est jeter la meilleure moisson du site.
 *
 * Trente-cinq, parce que c'est ce que contient une photo de famille prise devant
 * une maison. Le vrai garde-fou n'est pas le nombre : c'est que le travail de
 * découpe se partage entre tous ceux qui passent sur « Retrouver les visages ».
 */
const MAX = 35;

/**
 * Déposer une photo de groupe et dire qui s'y trouve.
 *
 * C'est le carburant de « Retrouver les visages », et il n'y en avait plus :
 * les trois photos du bulletin sont traitées, la page est vide. Or une photo de
 * mariage à onze donne onze visages d'un coup, là où les fiches se remplissent
 * une par une.
 *
 * Le tri met en tête ceux qui n'ont pas encore de visage : ce sont eux qu'on
 * vient chercher, et les faire remonter évite de parcourir deux cents noms pour
 * trouver les quatre qui comptent.
 */
export default function AjouterGroupe({ gens }: { gens: Candidate[] }) {
  const router = useRouter();
  const fichier = useRef<HTMLInputElement>(null);

  const [ouvert, setOuvert] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [legende, setLegende] = useState("");
  const [quand, setQuand] = useState("");
  const [q, setQ] = useState("");
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [etat, setEtat] = useState<"prêt" | "envoi" | "fait">("prêt");
  const [photoId, setPhotoId] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const listeTriee = useMemo(
    () => [...gens].sort((a, b) => Number(a.aPhoto) - Number(b.aPhoto) || a.nom.localeCompare(b.nom)),
    [gens],
  );

  const visibles = useMemo(() => {
    const nu = (s: string) =>
      s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const t = nu(q.trim());
    // Sans recherche, on ne montre que ceux qui manquent : la liste entière
    // fait quatre cents lignes, et personne ne fait défiler quatre cents lignes
    // sur un téléphone.
    const base = t ? listeTriee : listeTriee.filter((p) => !p.aPhoto);
    return (t ? base.filter((p) => nu(p.nom).includes(t)) : base).slice(0, 60);
  }, [listeTriee, q]);

  function basculer(id: string) {
    setChoisis((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size < MAX) n.add(id);
      return n;
    });
  }

  async function envoyer() {
    // 🔑 Cocher n'est plus obligatoire. C'était le mur : la photo du bulletin
    // porte trente noms, à trouver dans une liste de quatre cents, AVANT même
    // d'avoir envoyé le fichier — elle n'est jamais montée. Une photo déposée
    // sans un seul nom vaut mieux qu'une photo restée sur un téléphone : les
    // têtes se pointent et se nomment ensuite, à plusieurs, sur sa page.
    if (!image) return;
    setEtat("envoi");
    setErreur(null);
    try {
      const id = await deposerGroupe(
        supabaseBrowser(),
        image,
        {
          caption: legende.trim() || "Photo de famille",
          source: "la famille",
          taken: quand.trim() || null,
        },
        [...choisis],
      );
      setPhotoId(id);
      setEtat("fait");
      router.refresh();
    } catch (e) {
      setEtat("prêt");
      setErreur(e instanceof Error ? e.message : "envoi impossible");
    }
  }

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="rounded-lg border border-line bg-card px-4 py-2.5 text-sm"
      >
        Déposer une photo de groupe
      </button>
    );
  }

  if (etat === "fait") {
    return (
      <div className="rounded-xl border border-acquis bg-acquis-surface px-4 py-6 text-center">
        <p className="serif text-xl">La photo est en ligne</p>
        <p className="mt-1 text-sm text-muted">
          {choisis.size > 0
            ? `${choisis.size} visage${choisis.size > 1 ? "s" : ""} à découper, et vous pouvez pointer les autres têtes.`
            : "Pointez les têtes que vous reconnaissez — les autres seront nommées par la famille."}
        </p>
        <a
          href={photoId ? `/photo/${photoId}` : "/visages"}
          className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 font-medium text-sur-plein"
        >
          Dire qui est qui
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-accent-line bg-accent-surface p-4">
      <input
        ref={fichier}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setImage(f);
          setApercu(URL.createObjectURL(f));
        }}
      />

      {apercu ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={apercu} alt="" className="max-h-56 w-full rounded-lg object-contain" />
      ) : null}

      <button
        onClick={() => fichier.current?.click()}
        className="w-full rounded-lg border border-line bg-card px-4 py-3 text-sm"
      >
        {image ? "Choisir une autre photo" : "Choisir la photo"}
      </button>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Quelle occasion</span>
          <input
            value={legende}
            onChange={(e) => setLegende(e.target.value)}
            placeholder="Le mariage de Marthe"
            className={champ}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Quand</span>
          <input
            value={quand}
            onChange={(e) => setQuand(e.target.value)}
            placeholder="3 juillet 2026"
            className={champ}
          />
        </label>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">
          Qui est dessus{" "}
          <span className="font-normal text-muted">(facultatif)</span>{" "}
          <span className="font-normal text-muted">
            · {choisis.size} coché{choisis.size > 1 ? "s" : ""}
            {choisis.size >= MAX && " (maximum)"}
          </span>
        </p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Chercher un nom"
          className={champ}
        />
        {/* Sans recherche, la liste ne montre que les visages manquants. Celui
            qui cherche quelqu'un de précis le tape, et retrouve alors tout le
            monde, photo ou pas. */}
        <p className="mt-1 text-xs text-muted">
          {q
            ? "Toute la famille"
            : "Ceux qui n'ont pas encore de visage. Tapez un nom pour chercher les autres."}
        </p>

        <ul className="mt-2 flex max-h-64 flex-wrap gap-1.5 overflow-y-auto">
          {visibles.map((p) => {
            const pris = choisis.has(p.id);
            return (
              <li key={p.id}>
                <button
                  onClick={() => basculer(p.id)}
                  className={`rounded-lg border px-2.5 py-1.5 text-sm ${
                    pris ? "border-accent bg-accent text-sur-plein" : "border-line bg-card"
                  }`}
                >
                  {pris && <span aria-hidden>✓ </span>}
                  {p.nom}
                  {p.aPhoto && !pris && (
                    <span className="ml-1 text-xs text-muted">·a déjà</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {erreur && <p className="text-sm text-alerte">{erreur}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={envoyer}
          disabled={!image || etat === "envoi"}
          className="rounded-lg bg-accent px-5 py-2.5 font-medium text-sur-plein disabled:opacity-50"
        >
          {etat === "envoi"
            ? "Envoi…"
            : choisis.size > 0
              ? `Déposer pour ${choisis.size}`
              : "Déposer la photo"}
        </button>
        <button
          onClick={() => setOuvert(false)}
          className="rounded-lg border border-line px-5 py-2.5 text-sm"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

const champ =
  "w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-accent";
