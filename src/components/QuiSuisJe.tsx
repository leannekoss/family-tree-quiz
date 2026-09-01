"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Trouvaille = { id: string; nom: string; dates: string | null };

/**
 * « Qui êtes-vous dans l'arbre ? »
 *
 * Sans cette réponse, le journal ne peut désigner un contributeur que par le
 * début de son adresse email — « gardien a posé le visage de… » — devant deux
 * cents personnes. Certaines adresses révèlent un nom complet, d'autres sont
 * simplement laides à lire.
 *
 * La question n'est posée qu'une fois, et seulement à qui n'y a pas encore
 * répondu. Elle se saute : quelqu'un qui ne veut pas se déclarer garde
 * l'affichage par adresse, et rien ne le lui redemande sur cet appareil.
 *
 * Se rattacher est la seule chose qu'un membre puisse écrire sur sa propre
 * ligne — la base le verrouille colonne par colonne.
 */
const IGNORE = "arbre.quisuisje.ignore";

export default function QuiSuisJe() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Trouvaille[]>([]);
  const [etat, setEtat] = useState<"prêt" | "cherche" | "envoi" | "fait">("prêt");
  const [erreur, setErreur] = useState<string | null>(null);
  const [cache, setCache] = useState(false);
  const [lu, setLu] = useState(false);

  // Le stockage n'existe pas au rendu serveur : on le lit au premier rendu
  // client, une seule fois.
  if (!lu && typeof window !== "undefined") {
    setLu(true);
    try {
      if (sessionStorage.getItem(IGNORE)) setCache(true);
    } catch {
      /* navigation privée : la question sera reposée, ce n'est pas grave */
    }
  }

  if (cache || etat === "fait") return null;

  async function chercher(texte: string) {
    setQ(texte);
    setErreur(null);
    if (texte.trim().length < 2) {
      setHits([]);
      return;
    }
    setEtat("cherche");
    const supabase = supabaseBrowser();
    const { data } = await supabase.rpc("search_people", { q: texte.trim() });
    setHits(
      (data ?? []).slice(0, 6).map((p) => ({
        id: p.id,
        nom: `${p.first_name} ${p.married_name ?? p.last_name}`,
        dates: p.birth_display,
      })),
    );
    setEtat("prêt");
  }

  async function choisir(id: string) {
    setEtat("envoi");
    const supabase = supabaseBrowser();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErreur("La session a expiré. Rechargez la page.");
      setEtat("prêt");
      return;
    }
    const { error } = await supabase
      .from("members")
      .update({ person_id: id })
      .eq("user_id", user.id);
    if (error) {
      setErreur("Le rattachement n'a pas pu être enregistré.");
      setEtat("prêt");
      return;
    }
    setEtat("fait");
  }

  /**
   * 🔑 « Plus tard » veut dire plus tard, pas plus jamais.
   *
   * Ce bouton écrivait dans le `localStorage` : un seul clic, et la question
   * n'était plus JAMAIS reposée sur cet appareil. Anna a nommé vingt-neuf
   * visages en une après-midi sans que rien ne porte son nom, faute d'avoir pu
   * revenir à cette question. Le `sessionStorage` s'efface à la fermeture de
   * l'onglet : on n'insiste pas dans la minute, on redemande à la prochaine
   * visite.
   */
  function plusTard() {
    try {
      sessionStorage.setItem(IGNORE, "1");
    } catch {
      /* rien à faire */
    }
    setCache(true);
  }

  return (
    <section className="mb-6 rounded-xl border border-accent-line bg-accent-surface px-4 py-4">
      <h2 className="serif text-lg font-semibold">Qui êtes-vous dans l&apos;arbre ?</h2>
      <p className="mt-1 text-sm text-muted">
        Pour que vos corrections soient signées de votre nom plutôt que du début
        de votre adresse email. Cherchez votre fiche.
      </p>

      <input
        type="search"
        value={q}
        onChange={(e) => chercher(e.target.value)}
        placeholder="Votre prénom, votre nom"
        autoComplete="off"
        className="mt-3 w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-accent"
      />

      {etat === "cherche" && <p className="mt-2 text-sm text-muted">…</p>}

      {hits.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                onClick={() => choisir(h.id)}
                disabled={etat === "envoi"}
                className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-left disabled:opacity-50"
              >
                {h.nom}
                {h.dates && <span className="text-muted"> · {h.dates}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {q.trim().length >= 2 && etat === "prêt" && hits.length === 0 && (
        <p className="mt-2 text-sm text-muted">
          Personne de ce nom. Essayez votre nom de naissance, ou passez.
        </p>
      )}

      {erreur && <p className="mt-2 text-sm text-accent">{erreur}</p>}

      <button
        onClick={plusTard}
        className="mt-3 text-sm text-muted underline underline-offset-4"
      >
        Plus tard
      </button>
    </section>
  );
}
