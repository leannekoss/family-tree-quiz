#!/usr/bin/env python3
"""Étape 3 : génération de supabase/seed-windsor.sql depuis personnes.jsonl et unions.jsonl.

Les personnes sont insérées en deux passes (sans parents, puis UPDATE des liens) pour
satisfaire les clés étrangères sans tri topologique.
"""
import collections
import json
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
DOSSIER = RACINE / "data" / "windsor"
SEED = RACINE / "supabase" / "seed-windsor.sql"
GARDIEN = "a0000000-0000-4000-8000-0000000000ff"
ROYAUME_UNI = "Q145"
MIN_OCCURRENCES = 4

BRANCHES = [  # (id, nom, camp)
    (21, "Prusse", "Continent"), (22, "Hesse", "Continent"), (23, "Cobourg", "Continent"),
    (24, "Édouard VII", "Windsor"), (25, "Albany", "Continent"), (26, "Connaught", "Windsor"),
    (27, "Battenberg", "Windsor"), (28, "Schleswig-Holstein", "Windsor"), (29, "Argyll", "Windsor"),
]


def sql(v) -> str:
    """Littéral SQL : NULL, booléen, entier ou texte (apostrophes doublées)."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def lire(nom: str) -> list[dict]:
    return [json.loads(l) for l in (DOSSIER / nom).open(encoding="utf-8") if l.strip()]


def lieux_retenus(personnes: list[dict]) -> tuple[list[dict], dict]:
    """Les lieux (naissance ou décès, avec coordonnées) cités au moins MIN_OCCURRENCES fois,
    plus le premier lieu de naissance de chaque branche : toutes les branches ont un point.
    Rend la liste des lieux et la table qid Wikidata → id de place (1..n)."""
    occurrences = collections.Counter()
    par_branche = collections.defaultdict(collections.Counter)
    infos = {}
    for p in personnes:
        for l in p["P19"] + p["P20"]:
            if not l["coord"]:
                continue
            occurrences[l["qid"]] += 1
            infos[l["qid"]] = l
        for l in p["P19"]:
            if l["coord"] and p["branch_id"] is not None:
                par_branche[p["branch_id"]][l["qid"]] += 1
    retenus = {q for q, n in occurrences.items() if n >= MIN_OCCURRENCES}
    for compteur in par_branche.values():
        if compteur:
            retenus.add(compteur.most_common(1)[0][0])
    lieux, par_qid = [], {}
    for q in sorted(retenus, key=lambda q: (-occurrences[q], int(q[1:]))):
        l = infos[q]
        m = re.match(r"^Point\(([-\d.eE]+) ([-\d.eE]+)\)$", l["coord"])
        if not m:
            raise ValueError(f"coordonnées inattendues pour {q} : {l['coord']}")
        nom = l["label_fr"] or l["label_en"]
        if not nom:
            raise ValueError(f"lieu {q} sans libellé")
        lon, lat = float(m.group(1)), float(m.group(2))
        # `outside` = hors d'Europe : posé sur la carte mais pas dans le cadre de
        # départ, sinon New York et Rio tassent tout le continent en une grappe.
        lieux.append({"name": nom, "lon": lon, "lat": lat,
                      "outside": not (35 <= lat <= 72 and -25 <= lon <= 45), "occurrences": occurrences[q]})
        par_qid[q] = len(lieux)
    return lieux, par_qid


def place_de(p: dict, par_qid: dict) -> int | None:
    """Le lieu d'une personne : sa naissance si elle est sur la carte, sinon son décès."""
    for l in p["P19"] + p["P20"]:
        if l["qid"] in par_qid:
            return par_qid[l["qid"]]
    return None


def main() -> None:
    personnes, unions = lire("personnes.jsonl"), lire("unions.jsonl")
    ids = {p["id"] for p in personnes}
    par_qid = {p["qid"]: p["id"] for p in personnes}
    L = ["-- seed-windsor.sql — descendance de la reine Victoria, extraite de Wikidata (CC0).",
         "-- Généré par scripts/import-wikidata/3_seed.py — ne pas éditer à la main.",
         "-- À charger après les migrations (dont 0003 qui ajoute branches.camp).", ""]

    L.append("insert into branches (id, name, camp) values")
    L.append(",\n".join(f"  ({i}, {sql(n)}, {sql(c)})" for i, n, c in BRANCHES) + "\non conflict (id) do nothing;")
    L.append("select setval(pg_get_serial_sequence('branches','id'), 30);\n")

    L.append("insert into people (id, first_name, last_name, sex, birth_display, death_display, deceased, "
             "branch_id, birth_place, death_place, notes, hors_quiz) values")
    lignes = [f"  ({sql(GARDIEN)}, 'Le gardien', {sql("de l'arbre")}, 'M', "
              f"null, null, false, null, null, null, null, true)"]
    for p in personnes:
        lignes.append("  (" + ", ".join(sql(v) for v in (
            p["id"], p["first_name"], p["last_name"], p["sex"], p["birth_display"], p["death_display"],
            p["deceased"], p["branch_id"], p["birth_place"], p["death_place"], p["notes"], False)) + ")")
    L.append(",\n".join(lignes) + "\non conflict (id) do nothing;\n")

    L.append("-- Deuxième passe : liens père/mère (les deux parents existent désormais).")
    for p in personnes:
        pere = par_qid.get(p["father_qid"]) if p["father_qid"] else None
        mere = par_qid.get(p["mother_qid"]) if p["mother_qid"] else None
        if (p["father_qid"] and not pere) or (p["mother_qid"] and not mere):
            raise ValueError(f"{p['qid']} : parent hors du jeu, personnes.jsonl incohérent")
        if pere or mere:
            L.append(f"update people set father_id = {sql(pere)}, mother_id = {sql(mere)} where id = {sql(p['id'])};")
    L.append("")

    L.append("insert into unions (p1_id, p2_id, kind, date_display) values")
    lignes = []
    for u in unions:
        if u["p1_id"] not in ids or u["p2_id"] not in ids:
            raise ValueError(f"union {u['p1_qid']}-{u['p2_qid']} : personne hors du jeu")
        lignes.append(f"  ({sql(u['p1_id'])}, {sql(u['p2_id'])}, 'mariage', {sql(u['date_display'])})")
    L.append(",\n".join(lignes) + "\non conflict do nothing;\n")

    lieux, lieux_par_qid = lieux_retenus(personnes)
    L.append("insert into places (id, name, lat, lon, commune, geo_precision, geo_source, outside) values")
    L.append(",\n".join(
        f"  ({i + 1}, {sql(l['name'])}, {l['lat']}, {l['lon']}, null, 'exact', 'Wikidata P625', {sql(l['outside'])})"
        for i, l in enumerate(lieux)) + "\non conflict (id) do nothing;")
    L.append(f"select setval(pg_get_serial_sequence('places','id'), {len(lieux) + 1});\n")

    L.append("-- Troisième passe : chaque personne sur sa maison (naissance, sinon décès).")
    relies = 0
    for p in personnes:
        pid = place_de(p, lieux_par_qid)
        if pid is not None:
            L.append(f"update people set place_id = {pid} where id = {sql(p['id'])};")
            relies += 1
    L.append("")

    L.append("insert into app_config (key, value) values ('invite_code', 'windsor'), ('acces_ouvert', 'oui'), "
             "('lecture_seule', 'oui') on conflict (key) do update set value = excluded.value;")
    SEED.write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"{SEED} : {SEED.stat().st_size / 1024:.0f} Ko · {len(personnes) + 1} personnes · {len(unions)} unions · {len(lieux)} lieux · {relies} personnes reliées à un lieu")
    for l in lieux:
        print(f"  lieu : {l['name']} ({l['occurrences']}) hors RU = {l['outside']}")


if __name__ == "__main__":
    main()
