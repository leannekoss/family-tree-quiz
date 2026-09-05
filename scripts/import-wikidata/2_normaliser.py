#!/usr/bin/env python3
"""Étape 2 : normalisation de brut.jsonl vers le modèle de l'app.

Produit data/windsor/personnes.jsonl, unions.jsonl et rapport.md.
Lit data/windsor/corrections.csv (qid,champ,valeur), appliqué en dernier.
Toute ligne inexploitable est rejetée ET comptée dans le rapport.
"""
import collections
import csv
import json
import re
import uuid
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
DOSSIER = RACINE / "data" / "windsor"
BRUT = DOSSIER / "brut.jsonl"
PERSONNES = DOSSIER / "personnes.jsonl"
UNIONS = DOSSIER / "unions.jsonl"
RAPPORT = DOSSIER / "rapport.md"
CORRECTIONS = DOSSIER / "corrections.csv"

VICTORIA, ALBERT = "Q9439", "Q152245"
BRANCHES = {  # QID de l'enfant de Victoria → (id de branche, nom)
    "Q116728": (21, "Prusse"), "Q155566": (22, "Hesse"), "Q158143": (23, "Cobourg"),
    "Q20875": (24, "Édouard VII"), "Q160541": (25, "Albany"), "Q160558": (26, "Connaught"),
    "Q158140": (27, "Battenberg"), "Q160539": (28, "Schleswig-Holstein"), "Q161167": (29, "Argyll"),
}
SEXES = {"Q6581097": "M", "Q6581072": "F"}

# Mots de titre retirés en tête de libellé (insensible à la casse).
TITRES = {"prince", "princess", "princesse", "prinz", "prinzessin", "lord", "lady", "sir", "dame",
          "baron", "baroness", "baronne", "baronin", "freiherr", "freiin", "count", "countess",
          "comte", "comtesse", "graf", "gräfin", "duke", "duchess", "duc", "duchesse", "don",
          "donna", "dr", "hon.", "the", "archduke", "archduchess", "archiduc", "archiduchesse",
          "infante", "infanta", "king", "queen", "roi", "reine", "marquis", "marquess", "earl",
          "viscount", "vicomte", "landgrave", "margrave", "margravine", "erbprinz", "herzog",
          "herzogin", "erzherzog", "erzherzogin", "fürst", "fürstin", "kronprinz", "reverend"}
# Particules retirées en tête de ce qui reste après le prénom.
PARTICULES = {"de", "du", "d'", "des", "of", "von", "zu", "zur", "van", "di", "da", "della", "af", "der"}
NUMERO_REGNAL = re.compile(r"^[IVXL]+(er|re|e)?$")
PREFIXE_MAISON = re.compile(
    r"^(maison capétienne|famille royale|maison|famille|dynastie|clan|landgraviat|principauté|duc|house)\s+"
    r"(de la |de |du |d'|des |of )?", re.IGNORECASE)


def mots(texte: str) -> list[str]:
    return texte.replace("‑", "-").replace("’", "'").split()


def mots_prenom(texte: str) -> set[str]:
    """Jeu de mots (minuscules, tirets éclatés) servant à retirer le prénom du libellé."""
    return {m.lower() for m in re.split(r"[\s\-]+", texte) if m}


def nettoyer_maison(libelle: str) -> str:
    libelle = libelle.replace("‑", "-")
    libelle = re.sub(r"\s*\(.*\)\s*$", "", libelle)
    libelle = PREFIXE_MAISON.sub("", libelle).strip()
    return libelle


def libelle_de(e: dict) -> str | None:
    return e["label_fr"] or e["label_en"]


def calcul_prenom(e: dict) -> str | None:
    prenoms = [n["label_fr"] or n["label_en"] for n in e["P735"]]
    prenoms = [p for p in prenoms if p]
    if prenoms:
        # « Elizabeth (Alexandra) » — le premier prénom seul, le second entre parenthèses
        if len(prenoms) >= 2:
            return f"{prenoms[0]} ({prenoms[1]})"
        return prenoms[0]
    lib = libelle_de(e)
    if not lib:
        return None
    m = [w for w in mots(lib) if w.lower() not in TITRES]
    return m[0] if m else None


def nom_depuis_libelle(e: dict, prenom: str) -> str | None:
    lib = libelle_de(e)
    if not lib:
        return None
    lib = re.sub(r"\s*\(.*?\)", "", lib)
    avant, _, apres = lib.partition(",")
    prenoms = mots_prenom(prenom) | {m for n in e["P735"] for m in mots_prenom(n["label_fr"] or n["label_en"] or "")}
    reste = mots(avant)
    # 1) titres en tête ; 2) mots du prénom ; 3) titres, particules et numéros regnaux en tête du reste.
    while reste and reste[0].lower() in TITRES:
        reste.pop(0)
    while reste and reste[0].lower() in prenoms:
        reste.pop(0)
    reste = sans_tete(reste)
    if not reste and apres.strip():
        # « Andreas, Prince of Leiningen » : la partie après la virgule, seulement si c'est
        # un titre suivi d'une particule (« Prince of X », « Margravine de Y »).
        t = mots(apres)
        while t and t[0].lower() in TITRES:
            t.pop(0)
        if t and (t[0].lower() in PARTICULES or t[0].lower().startswith("d'")):
            reste = sans_tete(t)
    return " ".join(reste) or None


def sans_tete(reste: list[str]) -> list[str]:
    """Retire titres, particules et numéros regnaux en tête de liste."""
    reste = list(reste)
    while reste and (reste[0].lower() in TITRES or reste[0].lower() in PARTICULES
                     or NUMERO_REGNAL.match(reste[0]) or reste[0].lower().startswith("d'")):
        if reste[0].lower().startswith("d'") and reste[0].lower() != "d'":
            reste[0] = reste[0][2:]
            break
        reste.pop(0)
    return reste


def calcul_nom(e: dict, prenom: str) -> tuple[str | None, str]:
    """Retourne (nom, source) — source ∈ {maison, libellé}."""
    maisons = [h for h in e["P53"] if h["label_fr"] or h["label_en"]]
    if maisons:
        # Plusieurs maisons : la plus ancienne dans Wikidata (QID le plus petit), déterministe.
        h = min(maisons, key=lambda h: int(h["qid"][1:]))
        nom = nettoyer_maison(h["label_fr"] or h["label_en"])
        if nom:
            return nom, "maison"
    return nom_depuis_libelle(e, prenom), "libellé"


def date_affichee(d: dict | None) -> str | None:
    if not d:
        return None
    m = re.match(r"^\+?(-?\d+)-(\d\d)-(\d\d)T", d["time"])
    if not m or m.group(1).startswith("-"):
        raise ValueError(f"date inattendue : {d}")
    annee, mois, jour = m.groups()
    if d["precision"] >= 11:
        return f"{jour}.{mois}.{annee}"
    if d["precision"] >= 9:
        return annee
    return None


def annee(d: dict | None) -> int | None:
    if not d or d["precision"] < 9:
        return None
    return int(d["time"].lstrip("+").split("-")[0])


def lieu(liste: list[dict]) -> tuple[str | None, bool]:
    """Libellé fr du premier lieu (repli en, signalé)."""
    if not liste:
        return None, False
    l = liste[0]
    if l["label_fr"]:
        return l["label_fr"], False
    return l["label_en"], l["label_en"] is not None


def main() -> None:
    brut = {e["qid"]: e for e in (json.loads(l) for l in BRUT.open(encoding="utf-8") if l.strip())}
    if not CORRECTIONS.exists():
        CORRECTIONS.write_text("qid,champ,valeur\n", encoding="utf-8")
    corrections = list(csv.DictReader(CORRECTIONS.open(encoding="utf-8")))

    rejets = collections.Counter()
    rejetes: list[tuple[str, str, str]] = []  # (qid, libellé, motif)
    compteurs = collections.Counter()
    personnes: dict[str, dict] = {}

    for q, e in brut.items():
        lib = libelle_de(e) or "(sans libellé)"
        sexe = SEXES.get(e["P21"][0]["qid"]) if e["P21"] else None
        if sexe is None:
            rejets["sexe absent ou inconnu"] += 1
            rejetes.append((q, lib, "sexe"))
            continue
        prenom = calcul_prenom(e)
        if not prenom:
            rejets["prénom introuvable"] += 1
            rejetes.append((q, lib, "prénom"))
            continue
        nom, source_nom = calcul_nom(e, prenom)
        if not nom:
            rejets["nom introuvable"] += 1
            rejetes.append((q, lib, "nom"))
            continue
        compteurs[f"nom depuis {source_nom}"] += 1
        naissance, deces = date_affichee(e["P569"]), date_affichee(e["P570"])
        an_naiss = annee(e["P569"])
        decede = bool(e["P570"]) or (an_naiss is not None and an_naiss < 1910)
        lieu_n, repli_n = lieu(e["P19"])
        lieu_d, repli_d = lieu(e["P20"])
        compteurs["lieu en repli anglais"] += repli_n + repli_d
        personnes[q] = {
            "qid": q, "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, q)),
            "first_name": prenom, "last_name": nom, "sex": sexe,
            "father_qid": None, "mother_qid": None, "branch_id": None,
            "birth_display": naissance, "death_display": deces, "deceased": decede,
            "birth_place": lieu_n, "death_place": lieu_d,
            "notes": e["description_fr"], "image": e["P18"][0] if e["P18"] else None,
            "sitelinks": e["sitelinks"], "annee_naissance": an_naiss,
            "P19": e["P19"], "P20": e["P20"],
        }

    # Parents : uniquement s'ils sont dans le jeu.
    for q, p in personnes.items():
        e = brut[q]
        for prop, champ in (("P22", "father_qid"), ("P25", "mother_qid")):
            dans_jeu = sorted((x["qid"] for x in e[prop] if x["qid"] in personnes), key=lambda s: int(s[1:]))
            if len(e[prop]) > 1:
                compteurs[f"{champ} : plusieurs valeurs Wikidata"] += 1
            if dans_jeu:
                p[champ] = dans_jeu[0]
            elif e[prop]:
                compteurs[f"{champ} hors du jeu (mis à null)"] += 1

    # Descendance : BFS depuis Victoria par les liens parents internes.
    enfants = collections.defaultdict(list)
    for q, p in personnes.items():
        for parent in (p["father_qid"], p["mother_qid"]):
            if parent:
                enfants[parent].append(q)
    descendants, file = set(), [VICTORIA]
    while file:
        cur = file.pop(0)
        for c in enfants[cur]:
            if c not in descendants:
                descendants.add(c)
                file.append(c)
    # Branche : celle du père si le père est un descendant, sinon celle de la mère (récursif,
    # mémoïsé — le graphe des descendants est acyclique, le résultat ne dépend d'aucun ordre).
    import sys
    sys.setrecursionlimit(10_000)

    def branche(q: str) -> int | None:
        p = personnes[q]
        if p["branch_id"] is None and q not in BRANCHES:
            for parent in (p["father_qid"], p["mother_qid"]):
                if parent in descendants and branche(parent):
                    p["branch_id"] = branche(parent)
                    break
        return p["branch_id"]

    for q, (bid, _) in BRANCHES.items():
        if q in personnes:
            personnes[q]["branch_id"] = bid
    for q in descendants:
        branche(q)
    sans_branche = [q for q in descendants if not personnes[q]["branch_id"]]

    # Unions : paires P26 dédupliquées, les deux dans le jeu ; date = année de P580 si dispo.
    unions: dict[tuple[str, str], str | None] = {}
    for q in personnes:
        for c in brut[q]["P26"]:
            if c["qid"] not in personnes:
                compteurs["conjoint hors du jeu (union ignorée)"] += 1
                continue
            cle = tuple(sorted((q, c["qid"]), key=lambda s: int(s[1:])))
            an = c["debut"][:4] if c["debut"] and c["debut"][:4].isdigit() else None
            if cle not in unions or (unions[cle] is None and an):
                unions[cle] = an

    # Corrections manuelles, appliquées en dernier.
    for c in corrections:
        if c["qid"] not in personnes:
            compteurs["correction sur QID absent (ignorée)"] += 1
            continue
        if c["champ"] not in personnes[c["qid"]]:
            raise ValueError(f"corrections.csv : champ inconnu {c['champ']!r}")
        valeur = c["valeur"]
        if c["champ"] == "deceased":
            valeur = valeur.lower() in ("true", "oui", "1")
        elif c["champ"] == "branch_id":
            valeur = int(valeur)
        personnes[c["qid"]][c["champ"]] = valeur or None
        compteurs["corrections appliquées"] += 1

    CHAMPS = ["qid", "id", "first_name", "last_name", "sex", "father_qid", "mother_qid", "branch_id",
              "birth_display", "death_display", "deceased", "birth_place", "death_place", "notes",
              "image", "sitelinks", "P19", "P20"]
    with PERSONNES.open("w", encoding="utf-8") as f:
        for q in sorted(personnes, key=lambda s: int(s[1:])):
            f.write(json.dumps({k: personnes[q][k] for k in CHAMPS}, ensure_ascii=False) + "\n")
    with UNIONS.open("w", encoding="utf-8") as f:
        for (a, b), an in sorted(unions.items(), key=lambda kv: (int(kv[0][0][1:]), int(kv[0][1][1:]))):
            f.write(json.dumps({"p1_qid": a, "p2_qid": b, "p1_id": personnes[a]["id"],
                                "p2_id": personnes[b]["id"], "date_display": an}) + "\n")

    # Rapport.
    par_branche = collections.Counter(p["branch_id"] for p in personnes.values())
    noms_branches = {bid: nom for bid, nom in BRANCHES.values()}
    vivants_recents = [p for p in personnes.values() if not p["deceased"] and p["birth_display"]]
    sans_naissance = [p for p in personnes.values() if not p["birth_display"]]
    top = sorted(personnes.values(), key=lambda p: (-p["sitelinks"], int(p["qid"][1:])))[:50]

    def ligne(p):
        dates = f"{p['birth_display'] or '?'} – {p['death_display'] or ''}".rstrip(" –")
        br = noms_branches.get(p["branch_id"], "—")
        return f"| {p['qid']} | {p['first_name']} | {p['last_name']} | {dates} | {br} |"

    r = ["# Rapport de normalisation Windsor", "",
         "## Règles de nommage", "",
         "- `first_name` : prénoms Wikidata (P735, libellé fr sinon en) joints par un espace, "
         "au plus 2 ; repli = premier mot du libellé (fr sinon en) hors titres.",
         "- `last_name` : libellé fr de la maison noble (P53) nettoyé — préfixe « maison de / famille / "
         "dynastie / clan / landgraviat… » retiré, parenthèse finale retirée ; si plusieurs maisons, "
         "celle au QID le plus petit (déterministe, cf. corrections.csv pour forcer). "
         "Repli = libellé fr (sinon en) sans la partie après virgule, sans titres en tête, sans les "
         "mots du prénom, sans particule (de, du, d', of, von, zu, van…) ni numéro regnal en tête. "
         "Exemple : « Xenia de Prusse » → Xenia / Prusse. Si rien ne reste : rejet.",
         "- `sex` : P21 masculin → M, féminin → F, autre/absent → rejet.",
         "- Dates : précision 11 → JJ.MM.AAAA, 9-10 → AAAA, moins précis → vide.",
         "- `deceased` : date de décès présente → vrai ; sinon né avant 1910 → vrai ; sinon faux.",
         "- `branch_id` : BFS depuis Victoria ; branche du père si le père est un descendant avec "
         "branche, sinon celle de la mère ; conjoints entrants, Victoria et Albert → null.",
         "- Corrections manuelles : `corrections.csv` (qid,champ,valeur) appliqué en dernier.", "",
         "## Compteurs", "",
         f"- entités brutes : {len(brut)}",
         f"- personnes retenues : {len(personnes)}",
         f"- rejets : {sum(rejets.values())}"]
    r += [f"  - {motif} : {n}" for motif, n in rejets.most_common()]
    r += [f"- descendants atteignables depuis Victoria : {len(descendants)}",
          f"- descendants sans branche (anomalie) : {len(sans_branche)}",
          f"- avec image (P18) : {sum(1 for p in personnes.values() if p['image'])}",
          f"- unions : {len(unions)} (dont datées : {sum(1 for a in unions.values() if a)})"]
    r += [f"- {k} : {v}" for k, v in sorted(compteurs.items())]
    r += ["", "### Par branche", ""]
    r += [f"- {noms_branches.get(bid, 'sans branche (conjoints, Victoria, Albert)')} : {n}"
          for bid, n in sorted(par_branche.items(), key=lambda kv: (kv[0] is None, kv[0] or 0))]
    r += ["", "## Rejets", "", "| QID | libellé | motif |", "|---|---|---|"]
    r += [f"| {q} | {lib} | {motif} |" for q, lib, motif in rejetes]
    r += ["", f"## Nés ≥ 1910 sans date de décès ({len(vivants_recents)}) — considérés vivants", ""]
    r += [f"- {p['qid']} {p['first_name']} {p['last_name']} ({p['birth_display']})"
          for p in sorted(vivants_recents, key=lambda p: p["birth_display"][-4:])]
    r += ["", f"## Sans date de naissance ({len(sans_naissance)})", ""]
    r += [f"- {p['qid']} {p['first_name']} {p['last_name']} — décédé : {p['deceased']}" for p in sans_naissance]
    if sans_branche:
        r += ["", "## Descendants sans branche", ""] + [f"- {q} {personnes[q]['first_name']} {personnes[q]['last_name']}" for q in sans_branche]
    r += ["", "## Top 50 par nombre de sitelinks (relecture humaine)", "",
          "| QID | first_name | last_name | dates | branche |", "|---|---|---|---|---|"]
    r += [ligne(p) for p in top]
    RAPPORT.write_text("\n".join(r) + "\n", encoding="utf-8")
    print("\n".join(r[r.index("## Compteurs"):r.index("## Rejets")]))


if __name__ == "__main__":
    main()
