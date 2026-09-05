#!/usr/bin/env python3
"""Étape 1 : extraction brute depuis Wikidata (SPARQL).

Produit data/windsor/brut.jsonl : une ligne JSON par entité (descendants de la reine
Victoria, leurs conjoints, plus Victoria et Albert). Reprise : les QID déjà présents
dans brut.jsonl ne sont pas redemandés. Aucun appel à Commons ici.
"""
import json
import sys
import time
from pathlib import Path

import requests

RACINE = Path(__file__).resolve().parents[2]
SORTIE = RACINE / "data" / "windsor" / "brut.jsonl"
SPARQL = "https://query.wikidata.org/sparql"
ENTETES = {"User-Agent": "family-tree-demo/0.1 (contact@example.com)"}
VICTORIA, ALBERT = "Q9439", "Q152245"
TAILLE_LOT = 150

# Propriétés à valeur « entité » ramenées à plat, avec libellés fr et en de la cible.
PROPS_ENTITE = ["P21", "P22", "P25", "P53"]


def requete(sparql: str) -> list[dict]:
    """Exécute une requête SPARQL, échoue fort sinon (3 tentatives sur 429/5xx)."""
    for tentative in range(3):
        r = requests.get(SPARQL, params={"query": sparql, "format": "json"},
                         headers=ENTETES, timeout=180)
        if r.status_code in (429, 500, 502, 503, 504) and tentative < 2:
            time.sleep(10 * (tentative + 1))
            continue
        r.raise_for_status()
        return r.json()["results"]["bindings"]
    raise RuntimeError("inatteignable")


def qid(uri: str) -> str:
    return uri.rsplit("/", 1)[-1]


def val(b: dict, cle: str):
    return b[cle]["value"] if cle in b else None


def valeurs_sparql(qids: list[str]) -> str:
    return " ".join(f"wd:{q}" for q in qids)


def lire_deja_faits() -> set[str]:
    if not SORTIE.exists():
        return set()
    with SORTIE.open(encoding="utf-8") as f:
        return {json.loads(ligne)["qid"] for ligne in f if ligne.strip()}


def perimetre() -> list[str]:
    """Descendants de Victoria + leurs conjoints + Victoria et Albert."""
    desc = [qid(b["p"]["value"]) for b in requete(
        "SELECT DISTINCT ?p WHERE { wd:Q9439 wdt:P40+ ?p }")]
    conjoints = [qid(b["s"]["value"]) for b in requete(
        "SELECT DISTINCT ?s WHERE { wd:Q9439 wdt:P40+ ?d . ?d wdt:P26 ?s }")]
    print(f"descendants : {len(desc)} · conjoints : {len(conjoints)}")
    vus, ordre = set(), []
    for q in [VICTORIA, ALBERT] + desc + conjoints:
        if q not in vus:
            vus.add(q)
            ordre.append(q)
    return ordre


def extraire_lot(qids: list[str]) -> dict[str, dict]:
    v = valeurs_sparql(qids)
    ent = {q: {"qid": q, "label_fr": None, "label_en": None, "description_fr": None,
               "sitelinks": 0, "P21": [], "P22": [], "P25": [], "P53": [], "P18": [],
               "P26": [], "P569": None, "P570": None, "P19": [], "P20": [], "P735": []}
           for q in qids}

    # Libellés, description, sitelinks.
    for b in requete(f"""
        SELECT ?item ?lfr ?len ?dfr ?sl WHERE {{
          VALUES ?item {{ {v} }}
          OPTIONAL {{ ?item rdfs:label ?lfr FILTER(LANG(?lfr)="fr") }}
          OPTIONAL {{ ?item rdfs:label ?len FILTER(LANG(?len)="en") }}
          OPTIONAL {{ ?item schema:description ?dfr FILTER(LANG(?dfr)="fr") }}
          OPTIONAL {{ ?item wikibase:sitelinks ?sl }}
        }}"""):
        e = ent[qid(b["item"]["value"])]
        e["label_fr"], e["label_en"] = val(b, "lfr"), val(b, "len")
        e["description_fr"] = val(b, "dfr")
        e["sitelinks"] = int(val(b, "sl") or 0)

    # Sexe, père, mère, maison : QID cible + libellés fr/en.
    props = " ".join(f"wdt:{p}" for p in PROPS_ENTITE)
    for b in requete(f"""
        SELECT ?item ?prop ?cible ?cfr ?cen WHERE {{
          VALUES ?item {{ {v} }}
          VALUES ?prop {{ {props} }}
          ?item ?prop ?cible .
          OPTIONAL {{ ?cible rdfs:label ?cfr FILTER(LANG(?cfr)="fr") }}
          OPTIONAL {{ ?cible rdfs:label ?cen FILTER(LANG(?cen)="en") }}
        }}"""):
        p = qid(b["prop"]["value"])
        ent[qid(b["item"]["value"])][p].append(
            {"qid": qid(b["cible"]["value"]), "label_fr": val(b, "cfr"), "label_en": val(b, "cen")})

    # Image Commons (nom de fichier).
    for b in requete(f"""
        SELECT ?item ?img WHERE {{ VALUES ?item {{ {v} }} ?item wdt:P18 ?img }}"""):
        nom = requests.utils.unquote(b["img"]["value"].rsplit("/", 1)[-1])
        ent[qid(b["item"]["value"])]["P18"].append(nom)

    # Dates avec précision (déclaration de meilleur rang).
    for b in requete(f"""
        SELECT ?item ?prop ?t ?prec WHERE {{
          VALUES ?item {{ {v} }}
          VALUES (?prop ?p ?psv) {{ ("P569" p:P569 psv:P569) ("P570" p:P570 psv:P570) }}
          ?item ?p ?st . ?st a wikibase:BestRank .
          ?st ?psv ?nv . ?nv wikibase:timeValue ?t ; wikibase:timePrecision ?prec .
        }}"""):
        e = ent[qid(b["item"]["value"])]
        prop = b["prop"]["value"]
        if e[prop] is None:  # plusieurs déclarations de meilleur rang : on garde la première
            e[prop] = {"time": b["t"]["value"], "precision": int(b["prec"]["value"])}

    # Lieux de naissance / décès : libellé fr + coordonnées.
    for b in requete(f"""
        SELECT ?item ?prop ?lieu ?lfr ?len ?coord WHERE {{
          VALUES ?item {{ {v} }}
          VALUES (?prop ?wdt) {{ ("P19" wdt:P19) ("P20" wdt:P20) }}
          ?item ?wdt ?lieu .
          OPTIONAL {{ ?lieu rdfs:label ?lfr FILTER(LANG(?lfr)="fr") }}
          OPTIONAL {{ ?lieu rdfs:label ?len FILTER(LANG(?len)="en") }}
          OPTIONAL {{ ?lieu wdt:P625 ?coord }}
        }}"""):
        e = ent[qid(b["item"]["value"])]
        e[b["prop"]["value"]].append({"qid": qid(b["lieu"]["value"]), "label_fr": val(b, "lfr"),
                                      "label_en": val(b, "len"), "coord": val(b, "coord"),
                                      "pays": None})

    # Pays du lieu (P17) : pour savoir si le lieu est hors Royaume-Uni.
    lieux = sorted({l["qid"] for e in ent.values() for p in ("P19", "P20") for l in e[p]})
    pays = {}
    if lieux:
        for b in requete(f"""
            SELECT ?lieu ?pays WHERE {{ VALUES ?lieu {{ {valeurs_sparql(lieux)} }} ?lieu wdt:P17 ?pays }}"""):
            pays.setdefault(qid(b["lieu"]["value"]), qid(b["pays"]["value"]))
        for e in ent.values():
            for p in ("P19", "P20"):
                for l in e[p]:
                    l["pays"] = pays.get(l["qid"])

    # Prénoms, ordonnés par P1545 si présent.
    for b in requete(f"""
        SELECT ?item ?nom ?nfr ?nen ?ordre WHERE {{
          VALUES ?item {{ {v} }}
          ?item p:P735 ?st . ?st ps:P735 ?nom .
          OPTIONAL {{ ?st pq:P1545 ?ordre }}
          OPTIONAL {{ ?nom rdfs:label ?nfr FILTER(LANG(?nfr)="fr") }}
          OPTIONAL {{ ?nom rdfs:label ?nen FILTER(LANG(?nen)="en") }}
        }}"""):
        e = ent[qid(b["item"]["value"])]
        e["P735"].append({"qid": qid(b["nom"]["value"]), "label_fr": val(b, "nfr"),
                          "label_en": val(b, "nen"), "ordre": val(b, "ordre")})
    for e in ent.values():
        # Tri : ceux qui ont un ordre d'abord (numérique), les autres ensuite dans l'ordre reçu.
        e["P735"].sort(key=lambda n: (n["ordre"] is None, int(n["ordre"]) if n["ordre"] and n["ordre"].isdigit() else 0))
        # Un même prénom peut sortir en double si plusieurs libellés : dédoublonner par QID.
        vus, uniques = set(), []
        for n in e["P735"]:
            if n["qid"] not in vus:
                vus.add(n["qid"])
                uniques.append(n)
        e["P735"] = uniques

    # Conjoints avec date de début (P580) si disponible.
    for b in requete(f"""
        SELECT ?item ?conj ?debut WHERE {{
          VALUES ?item {{ {v} }}
          ?item p:P26 ?st . ?st ps:P26 ?conj .
          OPTIONAL {{ ?st pq:P580 ?debut }}
        }}"""):
        e = ent[qid(b["item"]["value"])]
        e["P26"].append({"qid": qid(b["conj"]["value"]), "debut": val(b, "debut")})

    return ent


def main() -> None:
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    cibles = perimetre()
    faits = lire_deja_faits()
    restants = [q for q in cibles if q not in faits]
    print(f"périmètre : {len(cibles)} · déjà extraits : {len(faits)} · à faire : {len(restants)}")
    with SORTIE.open("a", encoding="utf-8") as f:
        for i in range(0, len(restants), TAILLE_LOT):
            lot = restants[i:i + TAILLE_LOT]
            ent = extraire_lot(lot)
            for q in lot:
                f.write(json.dumps(ent[q], ensure_ascii=False) + "\n")
            f.flush()
            print(f"lot {i // TAILLE_LOT + 1} : {len(lot)} entités écrites", file=sys.stderr)
    print(f"terminé : {len(lire_deja_faits())} entités dans {SORTIE}")


if __name__ == "__main__":
    main()
