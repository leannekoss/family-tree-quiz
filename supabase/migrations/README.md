# État des migrations

⚠️ **Ce dossier est incomplet et ne peut pas reconstruire la base.** La production
compte **16 migrations appliquées** ; seules `0001` et `0006` figurent ici.

Conséquence à connaître avant tout `supabase db reset` : `0001_schema.sql` décrit une
sécurité **plus faible** que la réalité. Il définit un `is_member()` qui ne vérifie que
l'appartenance à `members`, et un `join_family()` qui ne contrôle pas l'adresse — alors
que la production exige en plus la présence dans `allowed_emails`. Rejouer ce dossier
tel quel installerait une version dégradée.

## Migrations réellement appliquées

| Version | Nom | Ce qu'elle porte |
|---|---|---|
| 20260810100010 | 0001_schema | tables, RLS, recherche trigram, audit — **version dépassée** |
| 20260810100802 | 0002_lock_down_functions | `revoke execute … from public` : révoquer sur `anon` seul ne fait rien |
| 20260810103330 | 0003_allowlist_et_import | `allowed_emails`, `is_member()` durci, import |
| 20260810103414 | 0004_import_fk_safe | la FK se vérifie à l'UPDATE, pas au commit |
| 20260810103448 | 0005_fermer_import | suppression de la porte d'import |
| 20260810110742 | 0006_annees_deux_chiffres | `fam_year()` — « 16.6.37 » n'a pas 4 chiffres |
| 20260810123228 | 0007_stockage_visages | bucket privé + policies storage |
| 20260810123401 | 0008_search_avec_photo | photo dans les résultats |
| 20260810134539 | 0009_lieux_dits | `places`, `people.place_id` |
| 20260810134934 | 0010_coordonnees_lieux | lat/lon, source et fiabilité du géocodage |
| 20260810142422 | 0011_gestion_des_acces | `is_admin`, policies allowlist |
| 20260810142514 | 0012_lire_code_invitation | `invite_code()` réservée aux gardiens |
| 20260810153310 | 0013_audit_allowed_emails | trigger dédié (table sans colonne `id`) |
| 20260810161405 | 0014_inviter_sans_email | création de compte sans email |
| 20260810182537 | 0015_search_avec_sexe | sexe dans les résultats, pour les accords |
| 20260810194459 | 0016_verrouiller_is_admin_et_audit | **correctif de sécurité**, voir ci-dessous |

## Pour récupérer le SQL exact

```sql
select name, array_to_string(statements, E'\n;\n')
from supabase_migrations.schema_migrations order by version;
```

## Le correctif 0016, à ne pas perdre

Une policy RLS filtre les **lignes**, jamais les **colonnes**. Depuis l'ajout de
`members.is_admin`, la policy « chacun modifie sa ligne » laissait donc n'importe quel
membre se nommer gardien d'un simple `PATCH`, puis lire le code famille et l'allowlist,
et couper l'accès de toute la famille. Le correctif passe par un privilège colonne, qui
résistera à la prochaine colonne sensible :

```sql
revoke update on members from authenticated, anon;
grant update (person_id) on members to authenticated;
```

Et l'audit contournait ce verrou : le trigger y écrit la ligne entière, et tout membre
lisait `audit_log`. La lecture est désormais scindée — les fiches pour tous, le reste
pour les gardiens.
