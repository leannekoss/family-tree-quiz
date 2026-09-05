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
NB_LIEUX = 12

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


def lieux_frequents(personnes: list[dict]) -> list[dict]:
    """Les NB_LIEUX lieux de naissance/décès les plus fréquents ayant des coordonnées."""
    occurrences = collections.Counter()
    infos = {}
    for p in personnes:
        for l in p["P19"] + p["P20"]:
            if not l["coord"]:
                continue
            occurrences[l["qid"]] += 1
            infos[l["qid"]] = l
    lieux = []
    for q, n in sorted(occurrences.items(), key=lambda kv: (-kv[1], int(kv[0][1:])))[:NB_LIEUX]:
        l = infos[q]
        m = re.match(r"^Point\(([-\d.eE]+) ([-\d.eE]+)\)$", l["coord"])
        if not m:
            raise ValueError(f"coordonnées inattendues pour {q} : {l['coord']}")
        nom = l["label_fr"] or l["label_en"]
        if not nom:
            raise ValueError(f"lieu {q} sans libellé")
        lieux.append({"name": nom, "lon": float(m.group(1)), "lat": float(m.group(2)),
                      "outside": l["pays"] != ROYAUME_UNI, "occurrences": n})
    return lieux


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

    lieux = lieux_frequents(personnes)
    L.append("insert into places (id, name, lat, lon, commune, geo_precision, geo_source, outside) values")
    L.append(",\n".join(
        f"  ({i + 1}, {sql(l['name'])}, {l['lat']}, {l['lon']}, null, 'exact', 'Wikidata P625', {sql(l['outside'])})"
        for i, l in enumerate(lieux)) + "\non conflict (id) do nothing;")
    L.append(f"select setval(pg_get_serial_sequence('places','id'), {len(lieux) + 1});\n")

    L.append("insert into app_config (key, value) values ('invite_code', 'A_DEFINIR'), ('acces_ouvert', 'oui'), "
             "('lecture_seule', 'oui') on conflict (key) do update set value = excluded.value;")
    SEED.write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"{SEED} : {SEED.stat().st_size / 1024:.0f} Ko · {len(personnes) + 1} personnes · {len(unions)} unions · {len(lieux)} lieux")
    for l in lieux:
        print(f"  lieu : {l['name']} ({l['occurrences']}) hors RU = {l['outside']}")


if __name__ == "__main__":
    main()
