#!/bin/bash
# Vérifie que le mode « une seule branche » (/quiz?branche=Rouvière) ne laisse
# JAMAIS sortir une question d'ailleurs.
#
# Le projet n'a pas de lanceur de tests : plutôt que d'en ajouter un pour un
# fichier, on compile `src/lib/quiz.ts` seul et on l'exécute avec node. Le
# tirage étant aléatoire, le contrôle rejoue 200 parties par branche — un seul
# tirage ne prouverait rien.
#
# Usage : bash scripts/verification/verifier-quiz-branche.sh
set -euo pipefail
RACINE="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

cat > "$OUT/tsconfig.json" <<EOF
{
  "compilerOptions": {
    "outDir": "$OUT/js", "module": "commonjs", "target": "es2020",
    "moduleResolution": "node", "skipLibCheck": true, "esModuleInterop": true,
    "baseUrl": "$RACINE", "paths": { "@/*": ["./src/*"] }
  },
  "files": ["$RACINE/src/lib/quiz.ts"]
}
EOF

npx tsc -p "$OUT/tsconfig.json"
# tsc ne réécrit pas les alias de chemin : tout `@/lib/*` vit dans le même
# dossier de sortie, un simple `./` suffit donc.
sed -i '' 's#require("@/lib/#require("./#g' "$OUT"/js/*.js
cp "$RACINE/scripts/verification/quiz-branche-stricte.js" "$OUT/js/t.js"
node "$OUT/js/t.js"
