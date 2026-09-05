# Contribuer à Family Tree Quiz

Merci de vouloir contribuer ! Ce projet est ouvert à tous.

## Pour commencer

1. **Forkez** le repo
2. **Clonez** votre fork :
   ```bash
   git clone https://github.com/<votre-user>/family-tree-quiz.git
   cd family-tree-quiz
   ```
3. **Installez** les dépendances :
   ```bash
   npm install
   ```
4. **Configurez** Supabase (voir [README.md](README.md#démarrage))
5. **Créez une branche** depuis `main` :
   ```bash
   git checkout -b feat/ma-fonctionnalite
   ```

## Conventions

### Branches

- `feat/description` — nouvelle fonctionnalité
- `fix/description` — correction de bug
- `docs/description` — documentation
- `refactor/description` — refactoring sans changement fonctionnel

### Commits

Format : `type: description courte`

Exemples :
- `feat: ajouter le mode multijoueur au quiz`
- `fix: corriger l'affichage de l'arbre sur mobile`
- `docs: compléter le guide d'import GEDCOM`

### Code

- TypeScript strict — pas de `any`
- Tailwind CSS pour les styles
- Composants React Server par défaut, `"use client"` seulement si nécessaire
- Interface en français

## Soumettre une Pull Request

1. Vérifiez que le build passe : `npm run build`
2. Vérifiez le lint : `npm run lint`
3. **Ne commitez jamais de vraies données familiales** — utilisez la famille de démo (Vernet-Delcourt)
4. Ouvrez une PR vers `main` avec une description claire de ce que vous changez et pourquoi

## Signaler un bug ou proposer une idée

Ouvrez une [issue](https://github.com/leannekoss/family-tree-quiz/issues) en utilisant le template adapté.

## Sécurité

Si vous trouvez une faille de sécurité, **ne créez pas d'issue publique**. Envoyez un email à hcasalis@gmail.com.

## Licence

En contribuant, vous acceptez que vos contributions soient publiées sous la [licence MIT](LICENSE).
