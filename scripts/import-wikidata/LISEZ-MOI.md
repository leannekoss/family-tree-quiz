# Import Wikidata → seed Windsor

Pipeline déterministe (Python 3, `requests`), sans LLM. Lancer depuis la racine du repo :

```bash
python3 scripts/import-wikidata/1_extraire.py    # Wikidata SPARQL → data/windsor/brut.jsonl
python3 scripts/import-wikidata/2_normaliser.py  # → personnes.jsonl, unions.jsonl, rapport.md
python3 scripts/import-wikidata/3_seed.py        # → supabase/seed-windsor.sql
```

- **Reprise** : `1_extraire.py` ne redemande pas les QID déjà présents dans `brut.jsonl` (lots de 150).
  Pour tout ré-extraire, supprimer `brut.jsonl`.
- **Corrections manuelles** : `data/windsor/corrections.csv` (colonnes `qid,champ,valeur`), appliqué
  en dernier par `2_normaliser.py`. Champs acceptés : `first_name`, `last_name`, `sex`, `birth_display`,
  `death_display`, `deceased`, `branch_id`, `birth_place`, `death_place`, `notes`. Valeur vide = null.
- **Rapport** : `data/windsor/rapport.md` — règles de nommage, compteurs, rejets (chaque ligne
  inexploitable est rejetée et comptée), personnes à contrôler, top 50 pour relecture.
