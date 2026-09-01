# Vérifier le mode « une seule branche »

`/quiz?branche=Rouvière` ne doit JAMAIS servir une question sur quelqu'un d'une
autre branche. Deux contrôles, l'un sur des données inventées, l'autre sur la
vraie base.

## 1. Données inventées — se lance seul

```bash
bash scripts/verification/verifier-quiz-branche.sh
```

Trois branches factices, 200 parties chacune. Vérifie qu'aucun sujet ne vient
d'ailleurs, qu'aucune question de pays ni de branche ne passe, et qu'une branche
de trois fiches rend une partie de trois questions — jamais complétée en douce.

🔑 Il contient un **contrôle négatif** : une partie de niveau 3 doit toucher
plusieurs branches. Sans lui, un `buildQuiz` cassé qui rendrait une liste vide
passerait le test avec un score parfait — « aucune fuite » est vrai de rien.

## 2. Vraies fiches — demande un export

```bash
# 657 fiches, connecté en gardien (voir PROMPT-QA-PLAYWRIGHT.md)
curl -s "$URL/rest/v1/people?select=...&collateral=eq.false&hors_quiz=eq.false" … \
  > /tmp/vraies-fiches.json
node scripts/verification/quiz-branche-donnees-reelles.js
```

Relevé du 22/08/2026 — 900 parties, aucune fuite, dix questions dans les neuf
branches, Lanvin compris (onze fiches).

⚠️ **Morel et Lanvin ne produisent aucune question de visage** : ces branches
n'ont pas de photo. Ce n'est pas un défaut du mode strict, c'est l'état de la
base — mais une partie « Lanvin » est donc plus sèche que les autres.

## 3. Les notes servies au joueur

```bash
node scripts/verification/quiz-notes-jouables.js   # même export que le §2
```

L'encadré 💡 du quiz affiche le champ « En deux mots ». Ce champ ayant été rempli
à l'import, il contient surtout des références de source et des annotations de
travail — que `noteJouable()` écarte désormais (`quiz.ts`).

Relevé du 22/08/2026 sur 400 parties : **143 notes écartées**, phrase composée
servie à la place ; **4 seulement passent encore**, et ce sont de vraies
anecdotes (« Pince sans rire », « Enterrée au cimetière de Roquefère »…).

⚠️ Relancer ce contrôle après tout nouvel import : une note de travail d'un
format inédit passerait le filtre, et c'est ici qu'on la verrait.
