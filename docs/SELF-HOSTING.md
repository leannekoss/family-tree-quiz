# Héberger l'arbre pour votre famille

Coût : 0 € pour une famille (free tier Supabase + hobby Vercel).

## 1. Supabase

1. Créer un projet sur [supabase.com](https://supabase.com) (région proche de la famille).
2. SQL Editor → coller et exécuter, dans l'ordre :
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_storage.sql`
   - `supabase/seed-demo.sql` (pour essayer) — ou vos propres données.
3. Authentication → Providers : garder Email. Les comptes sont créés par la fonction
   `rejoindre_avec_code`, personne ne s'inscrit par le formulaire Supabase.
4. Settings → API : copier l'URL du projet et la clé `anon`.

## 2. Vercel

1. Forker ce repo, l'importer sur [vercel.com](https://vercel.com).
2. Variables d'environnement : `NEXT_PUBLIC_SUPABASE_URL` et
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Déployer. C'est tout — la région est dans `vercel.json` (`cdg1`, à adapter).

## 3. Ouvrir aux vôtres

- Le code famille est dans `app_config` (`invite_code`). Le changer :
  `select regler_acces('votrecode2026');` (en tant que gardien).
- Fermer/ouvrir l'entrée libre : clé `acces_ouvert` (`oui`/`non`), ou `regler_acces`.
- Le premier compte créé doit devenir gardien : `update members set ... ` — voir
  `is_admin()` dans le schéma, le gardien est porté par `allowed_emails`/`members`.

## Vos données

- Saisie manuelle dans l'app (fiches, unions, photos), ou import SQL en vous inspirant
  de `supabase/seed-demo.sql` (54 fiches d'exemple).
- Dates au format `JJ.MM.AAAA` (ou année seule) dans `birth_display`/`death_display` —
  les années/jours/mois sont des colonnes générées.
- Photos : bucket `visages`, une vignette 240 px est générée au dépôt par l'app.

## Alertes email (optionnel)

`src/lib/alerte.ts` prévient le gardien par email quand une fiche est créée ou qu'une
filiation change, via [AgentMail](https://agentmail.to). Sans les variables
`AGENTMAIL_*`, rien n'est envoyé et l'app fonctionne normalement.
