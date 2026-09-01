# Remplir l'arbre : FamilySearch, GEDCOM, et la recherche assistée par IA

Le seed de démo fait 54 fiches. Une vraie famille en a vite des milliers. Voici le
pipeline utilisé sur l'arbre d'origine (~7 000 fiches), reproductible chez vous.

## 1. Récupérer vos ancêtres sur FamilySearch

[FamilySearch](https://www.familysearch.org) (gratuit, compte requis) héberge un arbre
mondial collaboratif. Si votre famille y figure, ne ressaisissez rien :

1. Retrouvez un ancêtre « charnière » (un aïeul de ~1850 connu de l'arbre mondial).
2. Exportez la descendance/ascendance en **GEDCOM** : arbre → Options d'exportation,
   ou via un outil tiers ([Getmyancestors](https://github.com/Linekio/getmyancestors)
   exporte N générations depuis un identifiant de personne).
3. Recommencez depuis plusieurs charnières : chaque export couvre un morceau,
   l'union des fichiers couvre la famille.

## 2. Importer le GEDCOM dans la base

Le format GEDCOM est simple à parser : blocs `0 @I..@ INDI` (personnes : NAME, SEX,
BIRT/DATE, FAMC/FAMS) et `0 @F..@ FAM` (familles : HUSB, WIFE, CHIL). Écrivez dans
`people` (avec `father_id`/`mother_id`) et dans `unions`.

**Trois pièges appris à la dure :**

1. **Le bloc `FAM` sert deux fois.** Il porte la filiation (HUSB/WIFE → CHIL) **et**
   le mariage (HUSB × WIFE). Si vous ne lisez que la filiation, les conjoints entrants
   se retrouvent « reliés à personne » — l'arbre d'origine a dû réparer 1 676 unions
   oubliées après coup. Écrivez les deux dès l'import.
2. **`1 DEAT` ne prouve RIEN.** FamilySearch ne publie pas les personnes vivantes :
   ses exports portent une balise décès sur quasiment tout le monde, date ou pas.
   Ne posez `deceased = true` que sur une date de décès réelle ou une preuve (voir §3).
   Sinon vous enterrez des vivants, ou fêtez les 339 ans d'une aïeule en page d'accueil.
3. **Les doublons se fusionnent sur preuve structurelle** (mêmes parents, même
   conjoint ou même enfant), jamais sur le nom seul : deux frères portent souvent le
   même prénom (l'aîné mort en bas âge, le cadet qui le reprend). Une année de
   naissance différente écarte la fusion.

Après tout import en masse : requêtes de contrôle (comptages avant/après, doublons,
fiches isolées = sans parent NI conjoint NI enfant) avant de crier victoire.

## 3. Aller plus loin avec un agent IA : Léonore, archives, presse

Une fois le squelette importé, un agent IA (Claude, ou un agent maison qui tourne sur
un serveur) peut enrichir fiche par fiche à partir des fonds numérisés français.
Règle d'or : **l'agent propose, la preuve décide** — rien ne s'écrit en base sans un
acte ou une publication citée en source dans `notes`.

Les fonds qui rapportent le plus :

- **Base Léonore** ([leonore.archives-nationales.culture.gouv.fr](https://www.leonore.archives-nationales.culture.gouv.fr)) :
  les dossiers de la **Légion d'honneur**, numérisés. Un aïeul décoré = un dossier
  complet (état civil, états de service, parfois correspondance). Cherchez par nom
  de naissance ; le dossier tranche les filiations douteuses.
- **Archives départementales** : registres paroissiaux et état civil numérisés
  (naissances/mariages/décès jusqu'à ~1920 selon les départements), tables
  décennales, recensements. L'agent cherche la commune + la décennie, vous lisez
  l'acte dans la visionneuse.
- **Fichier des décès INSEE** ([deces.matchid.io](https://deces.matchid.io)) :
  décès en France depuis 1970. ⚠️ Négatif ≠ vivant (décès à l'étranger invisibles),
  et vérifiez l'identité par la parentèle, pas l'homonymie.
- **Presse ancienne** : Gallica, RetroNews, et le carnet du jour du Figaro pour les
  familles qui y publiaient. Astuce qui change tout : chercher les femmes **au nom
  d'épouse**, pas au nom de naissance — presse et pompes funèbres classent au nom
  d'usage.

Boucle type de l'agent, personne par personne :

```
fiche incomplète → requête Léonore (nom + prénom)
                 → requête archives dép. (commune + période)
                 → requête presse (nom d'usage)
→ preuve trouvée ? écrire la donnée + la source dans notes
→ pas de preuve ?  écrire « non prouvé » — jamais une déduction silencieuse
```

L'avis de décès d'un conjoint sert dans les deux sens : celui du mari prouve
l'épouse vivante à cette date (elle signe l'avis).
