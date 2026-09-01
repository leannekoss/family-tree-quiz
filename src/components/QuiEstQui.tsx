"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { decouperVisage } from "@/lib/decouper";
import { fullName } from "@/lib/types";

export type Repere = {
  id: number;
  person_id: string | null;
  x: number;
  y: number;
  nom: string | null;
  /** La personne a-t-elle déjà un portrait sur sa fiche ? */
  aPhoto: boolean;
};

export type Gens = { id: string; nom: string; aPhoto: boolean };

/** Cadrage de départ : bon sur une photo de groupe ordinaire, à resserrer à trente. */
const DEFAUT = 0.14;

/** Ce que renvoie la RPC `search_people` — on n'en garde que le nom et le visage. */
type PersonneTrouvee = {
  id: string;
  first_name: string;
  last_name: string;
  married_name: string | null;
  sex: string | null;
  photo_url: string | null;
};

/**
 * Le « qui est qui » d'une photo de groupe.
 *
 * Une photo de trente-trois personnes vaut trente-trois portraits et
 * trente-trois questions de quiz — à condition que quelqu'un dise qui est où.
 * Personne ne sait tout : celui qui a la photo reconnaît son grand-père et
 * ignore les cousins d'à côté. D'où les deux gestes, séparés :
 *
 * 1. **Pointer une tête** — même sans savoir qui c'est. Le repère anonyme est
 *    une question posée à deux cents personnes, pas un trou dans les données.
 * 2. **Nommer un repère** — le geste de celui qui passe et qui reconnaît.
 *
 * Les repères sont en fraction de l'image (0 à 1), jamais en pixels : la même
 * photo s'affiche sur un téléphone et sur un écran, et des pixels se
 * décaleraient d'un appareil à l'autre.
 */
export default function QuiEstQui({
  photoId,
  src,
  reperes,
}: {
  photoId: number;
  src: string;
  reperes: Repere[];
}) {
  const router = useRouter();
  const image = useRef<HTMLImageElement>(null);
  const [enCours, setEnCours] = useState<{ x: number; y: number } | null>(null);
  const [choisi, setChoisi] = useState<Repere | null>(null);
  const [q, setQ] = useState("");
  const [occupe, setOccupe] = useState(false);
  // Le portrait en préparation : quel repère, et quelle taille de cadre.
  // 0,14 de la largeur convient à une photo de groupe ordinaire ; sur les
  // trente-trois du bulletin il faudra resserrer, sur cinq personnes élargir —
  // d'où le curseur plutôt qu'une valeur unique qui n'irait à personne.
  const [portrait, setPortrait] = useState<{ r: Repere; taille: number; auto: boolean } | null>(null);
  const [trouves, setTrouves] = useState<Gens[]>([]);

  // 🔑 Les personnes déjà pointées sur la photo ne sont pas reproposées — sauf
  // celle du repère qu'on est en train de corriger. Sans cette exception,
  // rectifier une identification devenait impossible : « je voulais lui faire
  // un portrait mais ça me dit que c'est déjà lié » (Anna). Le nom cherché
  // était bien dans la base, mais il s'excluait lui-même de la liste.
  const dejaLa = useMemo(
    () =>
      new Set(
        reperes
          .filter((r) => r.id !== choisi?.id)
          .map((r) => r.person_id)
          .filter(Boolean) as string[],
      ),
    [reperes, choisi],
  );

  // 🔑 On demande les noms à la base, à la frappe, au lieu de filtrer un
  // tableau chargé d'avance. La version d'avant recevait « toutes » les
  // personnes — en réalité les mille premières, plafond silencieux de
  // PostgREST — et tout ce qui suivait dans l'alphabet était introuvable sans
  // le moindre message. `search_people` est la RPC de la recherche du site :
  // elle ignore les accents et tolère les fautes de frappe, ce que le
  // `includes` d'ici ne faisait pas.
  useEffect(() => {
    const t = q.trim();
    let annule = false;
    const minuteur = setTimeout(async () => {
      if (t.length < 2) {
        setTrouves([]);
        return;
      }
      const { data } = await supabaseBrowser().rpc("search_people", { q: t });
      if (annule) return;
      setTrouves(
        (data ?? [])
          .filter((p: PersonneTrouvee) => !dejaLa.has(p.id))
          .slice(0, 8)
          .map((p: PersonneTrouvee) => ({
            id: p.id,
            nom: fullName(p),
            aPhoto: Boolean(p.photo_url),
          })),
      );
    }, 180);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [q, dejaLa]);

  /** Le clic sur l'image pose un repère — en fraction, pas en pixels. */
  function pointer(e: React.MouseEvent<HTMLImageElement>) {
    const b = e.currentTarget.getBoundingClientRect();
    setChoisi(null);
    setQ("");
    setEnCours({ x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height });
  }

  async function poser(qui: Gens | null) {
    if (!enCours || occupe) return;
    const personId = qui?.id ?? null;
    setOccupe(true);
    const sb = supabaseBrowser();
    const { data, error } = await sb
      .from("photo_marks")
      .insert({
        photo_id: photoId,
        person_id: personId,
        x: enCours.x,
        y: enCours.y,
        ...(personId
          ? { named_by: (await sb.auth.getUser()).data.user?.id, named_at: new Date().toISOString() }
          : {}),
      })
      .select("id")
      .single();
    setOccupe(false);
    if (error) {
      alert(error.message);
      return;
    }
    const place = enCours;
    setEnCours(null);
    setQ("");
    // 🔑 On enchaîne sur le portrait sans rien redemander. Nommer quelqu'un et
    // vouloir son visage sur sa fiche, c'est le même geste dans la tête de
    // celui qui le fait : l'interrompre pour lui faire retoucher le rond, c'est
    // le perdre. Seulement s'il n'a pas déjà de portrait — on ne propose pas de
    // remplacer ce qui existe.
    // Un repère anonyme n'a personne à portraiturer : la proposition ne vaut
    // que si l'on vient de mettre un nom.
    if (qui) proposerLePortrait(qui, data.id, place.x, place.y);
    router.refresh();
  }

  /** Nommer un repère que quelqu'un d'autre a posé sans savoir. */
  /** Le repère reste, son nom s'en va : il retourne parmi les « ? » à trouver. */
  async function denommer() {
    if (!choisi || occupe) return;
    setOccupe(true);
    const { error } = await supabaseBrowser()
      .from("photo_marks")
      .update({ person_id: null, named_by: null, named_at: null })
      .eq("id", choisi.id);
    setOccupe(false);
    if (error) return alert(error.message);
    setChoisi(null);
    setQ("");
    router.refresh();
  }

  async function nommer(qui: Gens) {
    if (!choisi || occupe) return;
    setOccupe(true);
    const sb = supabaseBrowser();
    const { error } = await sb
      .from("photo_marks")
      .update({
        person_id: qui.id,
        named_by: (await sb.auth.getUser()).data.user?.id,
        named_at: new Date().toISOString(),
      })
      .eq("id", choisi.id);
    setOccupe(false);
    if (error) {
      alert(error.message);
      return;
    }
    const place = choisi;
    setChoisi(null);
    setQ("");
    proposerLePortrait(qui, place.id, place.x, place.y);
    router.refresh();
  }

  /**
   * Après avoir mis un nom sur une tête : proposer d'en faire son portrait.
   *
   * Le lien avec la fiche, lui, est DÉJÀ fait — la photo apparaîtra dans « on
   * la ou le voit ici » sans que personne n'ait rien à demander. Ce qui reste
   * ouvert, c'est la photo principale, et c'est un choix : le cadre peut être
   * mauvais, la personne de dos, une meilleure photo peut exister ailleurs.
   */
  /**
   * 🔑 Le portrait est POSÉ d'office, pas proposé.
   *
   * Avant, nommer une tête ouvrait un panneau qui demandait « voulez-vous en
   * faire sa photo de profil ? », et « Non merci » était la réponse la plus
   * facile. Résultat : des dizaines de visages nommés sur les photos de groupe
   * dont aucune fiche n'a jamais porté le portrait — donc absents du quiz, qui
   * ne connaît que `people.photo_url`. Le travail était fait, il ne servait à
   * personne.
   *
   * On découpe donc au cadrage par défaut, tout de suite, et le panneau ne
   * demande plus l'autorisation : il montre le résultat et offre de le
   * rectifier. La condition qui compte reste la même — seulement si la fiche
   * n'a pas déjà de portrait, on ne remplace jamais ce qui existe.
   *
   * Le filet est « Ce n'est pas X » : il retire le portrait posé d'office en
   * même temps que le nom. Poser un visage d'office suppose de pouvoir le
   * défaire d'un geste, sans quoi une erreur d'identification reste sur la
   * fiche.
   */
  async function proposerLePortrait(g: Gens, repereId: number, x: number, y: number) {
    if (g.aPhoto) return;
    const r: Repere = { id: repereId, person_id: g.id, x, y, nom: g.nom, aPhoto: false };
    setPortrait({ r, taille: DEFAUT, auto: true });
    try {
      await decouperVisage(supabaseBrowser(), {
        src,
        personId: g.id,
        x,
        y,
        taille: DEFAUT,
      });
      router.refresh();
    } catch {
      // La découpe est un bonus : son échec ne doit pas défaire le nommage,
      // qui, lui, est enregistré. Le panneau reste ouvert pour la refaire à la
      // main.
      setPortrait({ r, taille: DEFAUT, auto: false });
    }
  }

  /** Défaire un portrait posé d'office : le nom était faux. */
  async function retirerLePortrait(personId: string) {
    await supabaseBrowser().from("people").update({ photo_url: null }).eq("id", personId);
  }

  /**
   * Effacer un repère mal placé ou mal attribué.
   *
   * Renommer suffit quand on sait qui c'est vraiment ; effacer sert quand on
   * ne sait pas — et laisser un nom faux vaut bien pire qu'un rond « ? ». La
   * base ne l'autorise qu'à celui qui l'a posé et aux gardiens : sur une photo
   * de famille, personne ne doit pouvoir défaire le travail des autres.
   */
  async function effacerLeRepere() {
    if (!choisi || occupe) return;
    setOccupe(true);
    const { error } = await supabaseBrowser().from("photo_marks").delete().eq("id", choisi.id);
    setOccupe(false);
    if (error) {
      alert("Ce repère a été posé par quelqu'un d'autre : vous pouvez le renommer, pas l'effacer.");
      return;
    }
    setChoisi(null);
    setQ("");
    router.refresh();
  }

  /** Découper le visage et le poser sur la fiche — le repère, lui, ne bouge pas. */
  async function faireLePortrait() {
    if (!portrait || occupe) return;
    const { r, taille } = portrait;
    if (!r.person_id) return;
    setOccupe(true);
    try {
      await decouperVisage(supabaseBrowser(), {
        src,
        personId: r.person_id,
        x: r.x,
        y: r.y,
        taille,
      });
      setPortrait(null);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "découpe impossible");
    } finally {
      setOccupe(false);
    }
  }

  const anonymes = reperes.filter((r) => !r.person_id).length;
  const aPortraiturer = reperes.filter((r) => r.person_id && !r.aPhoto).length;

  return (
    <div>
      <div className="relative select-none overflow-hidden rounded-xl border border-line">
        {/* 🔑 « Ils sont trop serrés, je ne peux pas bien choisir un portrait »
            (Anna, sur la photo des cent ans de Georges Chastel). Sur une photo
            de trente personnes vue sur un téléphone, un visage fait quelques
            millimètres : régler un cadre à l'aveugle est impossible. Dès qu'on
            prépare un portrait, l'image grossit AUTOUR du repère — même
            mécanique que sur la fiche, par `transform-origin`, sans calcul de
            décalage. Le zoom porte sur le bloc entier pour que les repères et
            le cadre suivent l'image. */}
        <div
          style={
            portrait
              ? {
                  transform: "scale(3)",
                  transformOrigin: `${portrait.r.x * 100}% ${portrait.r.y * 100}%`,
                }
              : undefined
          }
          className="relative transition-transform duration-300"
        >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={image}
          src={src}
          alt="photo de famille"
          onClick={pointer}
          className="block w-full cursor-crosshair"
        />

        {reperes.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              setEnCours(null);
              setQ("");
              // Sans portrait, on va droit au découpage ; avec, on ouvre la
              // fiche d'identité du repère, d'où l'on peut refaire la photo.
              if (r.person_id && !r.aPhoto) {
                setChoisi(null);
                setPortrait({ r, taille: DEFAUT, auto: false });
              } else {
                setPortrait(null);
                setChoisi(r);
              }
            }}
            style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%` }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
              r.person_id
                ? "size-6 border-accent bg-accent/20"
                : "size-7 border-dashed border-alerte bg-card/70 text-xs font-bold text-alerte"
            }`}
            title={r.nom ?? "à identifier"}
          >
            {r.person_id ? "" : "?"}
          </button>
        ))}

        {portrait && (
          <span
            style={{
              left: `${portrait.r.x * 100}%`,
              top: `${portrait.r.y * 100}%`,
              width: `${portrait.taille * 100}%`,
              // Le cadre est carré en pixels d'image : sa hauteur en pourcentage
              // dépend donc du rapport de la photo.
              aspectRatio: "1 / 1",
            }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
          />
        )}

        {enCours && (
          <span
            style={{ left: `${enCours.x * 100}%`, top: `${enCours.y * 100}%` }}
            className="pointer-events-none absolute size-7 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-accent bg-accent/30"
          />
        )}
        </div>
      </div>

      <p className="mt-2 text-sm text-muted">
        {reperes.length === 0 ? (
          <>
            <strong>Touchez une tête</strong> sur la photo pour poser un repère.
            Vous n&apos;êtes pas obligé de savoir qui c&apos;est : quelqu&apos;un
            d&apos;autre le reconnaîtra.
          </>
        ) : (
          <>
            {reperes.length} repère{reperes.length > 1 ? "s" : ""} ·{" "}
            {anonymes > 0 ? (
              <strong className="text-alerte">
                {anonymes} à identifier — touchez un rond « ? »
              </strong>
            ) : (
              "tout le monde est nommé"
            )}
            {aPortraiturer > 0 && (
              <>
                {" "}
                ·{" "}
                <strong className="text-accent">
                  {aPortraiturer} portrait{aPortraiturer > 1 ? "s" : ""} à faire —
                  touchez un rond plein
                </strong>
              </>
            )}
          </>
        )}
      </p>

      {/* Le panneau du portrait : ajuster le cadre, puis l'envoyer sur la
          fiche. Il s'ouvre en touchant une tête DÉJÀ nommée dont la personne
          n'a pas de visage — c'est ce qu'on attend en la touchant. */}
      {/* 🔑 Les deux panneaux flottent au BAS DE L'ÉCRAN, ils ne suivent plus
          la photo. Une photo en portrait fait mille pixels de haut : le panneau
          s'ouvrait sous elle, donc hors de vue, et toucher un visage semblait
          ne rien faire. On voit le cadre sur la photo ET les boutons en même
          temps — c'est la seule disposition où le réglage est réglable. */}
      {portrait && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-accent-line bg-accent-surface p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.18)] sm:mx-auto sm:max-w-2xl sm:rounded-t-2xl">
          <p className="font-medium">
            <span aria-hidden>✓ </span>
            {portrait.r.nom} est reliée à cette photo
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {portrait.auto ? (
              <>
                Elle apparaît sur sa fiche, et son visage vient d&apos;y être
                posé comme <strong>photo de profil</strong> — c&apos;est ce qui
                la fait entrer au quiz. Si le cadre tombe mal, ajustez-le et
                enregistrez.
              </>
            ) : (
              <>
                Elle apparaît maintenant sur sa fiche, avec les autres personnes
                nommées ici — et elle y restera. Voulez-vous en plus en faire{" "}
                <strong>sa photo de profil</strong> ? Ajustez le cadre autour de
                son visage.
              </>
            )}
          </p>

          <label className="mt-3 block">
            <span className="mb-1 block text-sm">Taille du cadre</span>
            <input
              type="range"
              min={4}
              max={45}
              value={Math.round(portrait.taille * 100)}
              onChange={(e) =>
                setPortrait({ ...portrait, taille: Number(e.target.value) / 100 })
              }
              className="w-full accent-[var(--accent)]"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              disabled={occupe}
              onClick={faireLePortrait}
              className="min-h-11 rounded-lg bg-accent px-5 font-medium text-sur-plein disabled:opacity-50"
            >
              {occupe
                ? "Envoi…"
                : portrait.auto
                  ? "Enregistrer ce cadrage"
                  : "Oui, en faire son portrait"}
            </button>
            <button
              disabled={occupe}
              onClick={async () => {
                // Le nom est faux : le portrait posé d'office part avec lui.
                if (portrait.auto && portrait.r.person_id) {
                  setOccupe(true);
                  await retirerLePortrait(portrait.r.person_id);
                  setOccupe(false);
                }
                setChoisi(portrait.r);
                setPortrait(null);
              }}
              className="min-h-11 rounded-lg border border-line bg-card px-4 text-sm"
            >
              Ce n&apos;est pas {portrait.r.nom}
            </button>
            <button
              onClick={() => setPortrait(null)}
              className="min-h-11 rounded-lg px-4 text-sm text-muted underline underline-offset-4"
            >
              {portrait.auto ? "C'est bien ainsi" : "Non merci"}
            </button>
          </div>
        </div>
      )}

      {/* Le panneau de nomination, ouvert soit par un nouveau point, soit par
          un repère anonyme. Un seul formulaire pour les deux gestes : c'est la
          même question posée à deux moments. */}
      {(enCours || choisi) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-accent-line bg-accent-surface p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.18)] sm:mx-auto sm:max-w-2xl sm:rounded-t-2xl">
          <p className="mb-2 font-medium">
            {choisi?.nom
              ? `C'est ${choisi.nom} — corriger ?`
              : "Qui est-ce ?"}
          </p>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tapez un prénom ou un nom"
            className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-accent"
          />

          {trouves.length > 0 && (
            <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
              {trouves.map((g) => (
                <li key={g.id}>
                  <button
                    disabled={occupe}
                    onClick={() => (choisi ? nommer(g) : poser(g))}
                    className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-line bg-card px-3 text-left text-sm"
                  >
                    <span>{g.nom}</span>
                    {!g.aPhoto && (
                      <span className="ml-auto text-xs text-accent">visage manquant</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {/* Le portrait se refait à volonté : le premier cadrage est souvent
                trop large, et une photo posée sur une fiche se remplace. */}
            {choisi?.person_id && (
              <button
                onClick={() => {
                  const r = choisi;
                  setChoisi(null);
                  setPortrait({ r, taille: DEFAUT, auto: false });
                }}
                className="min-h-11 rounded-lg border border-accent-line bg-card px-4 text-sm text-accent"
              >
                {choisi.aPhoto ? "Refaire son portrait" : "En faire son portrait"}
              </button>
            )}
            {/* Retirer un nom posé par erreur. Ce geste manquait : on pouvait
                nommer, jamais dénommer, et l'erreur restait affichée à toute
                la famille. Le repère est conservé — le visage est bien là,
                c'est son identité qui était fausse. */}
            {choisi?.person_id && (
              <button
                disabled={occupe}
                onClick={() => denommer()}
                className="min-h-11 rounded-lg border border-line bg-card px-4 text-sm text-muted"
              >
                Ce n&apos;est pas {choisi.nom?.split(" ")[0] ?? "cette personne"}
              </button>
            )}
            {enCours && (
              <button
                disabled={occupe}
                onClick={() => poser(null)}
                className="min-h-11 rounded-lg border border-line bg-card px-4 text-sm"
              >
                Je ne sais pas qui c&apos;est
              </button>
            )}
            {choisi && (
              <button
                disabled={occupe}
                onClick={effacerLeRepere}
                className="min-h-11 rounded-lg px-4 text-sm text-alerte underline underline-offset-4"
              >
                Effacer ce repère
              </button>
            )}
            <button
              onClick={() => {
                setEnCours(null);
                setChoisi(null);
                setQ("");
              }}
              className="min-h-11 rounded-lg px-4 text-sm text-muted underline underline-offset-4"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
