# Architecture

## Vue d'ensemble

```
Next.js (App Router, tout en force-dynamic)
  ├── pages serveur : arbre, fiches, quiz, carte, classements
  ├── composants client : QuizGame, PlacesMap, SearchBox, recadrage photo
  └── Supabase JS (@supabase/ssr) — cookies de session côté serveur
Supabase
  ├── Postgres + RLS : TOUTE la sécurité est en base (is_member / is_admin)
  ├── ~35 fonctions SQL (RPC) : quiz, classements, recherche, parenté, journal
  ├── Auth : comptes créés à la volée par le code famille (rejoindre_avec_code)
  └── Storage : bucket privé `visages` (photos + vignettes), liens signés
```

## Principes

- **La sécurité vit dans Postgres.** Le client n'a que la clé anon ; chaque table est
  derrière RLS avec `is_member()` (une ligne dans `members` pour mon `auth.uid()`).
  Aucune clé service : l'app ne peut rien faire que la base n'autorise.
- **Les jugements de forme vivent en SQL.** Recherche (`search_people`, trigrammes +
  `f_unaccent`), parenté (`parente_entre`, parcours de graphe), classements, anniversaires
  (`fam_jour`/`fam_mois` sur les dates affichées) : une RPC par question, la page affiche.
- **Le quiz est généré côté serveur** (`src/lib/quiz.ts`) depuis le graphe complet :
  vivier par branche, anti-répétition par cookie, questions de filiation/fratrie/visage/camp.
- **Traçabilité** : `audit_log` + triggers sur les tables sensibles, `journal_famille()`
  pour l'afficher, `restaurer_fiche()` pour défaire.
- **PostgREST plafonne à 1000 lignes** : toute lecture « graphe entier » pagine par
  tranches de 1000 sur une colonne unique (`src/lib/tout.ts`).

## Schéma (tables principales)

`people` (fiches, filiation par `father_id`/`mother_id`, années générées depuis les dates
affichées) · `unions` (couples) · `branches` (+ camp calculé) · `members` (compte ↔ fiche) ·
`places` + `place_stories` (les maisons) · `scores` (parties de quiz) · `duels` ·
`group_photos` / `photo_marks` / `visages` (photos de groupe et visages nommés) ·
`app_config` (code famille, accès ouvert/fermé) · `audit_log`.
