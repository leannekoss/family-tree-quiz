#!/bin/bash
# Garde-fou avant tout push : échoue fort si une donnée réelle réapparaît.
# Usage : bash scripts/verification/scan-anonymisation.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

MOTIFS='nairac|vernejoul|vernéjoul|feyerabend|hcasalis|casalis|schloesing|persy|monflanquin2026|vienot|parlier|pacquement|kreiss|odier|meynard|steinhel|dietrich|glaubitz|becays|bécays|capdeville|vossius|quincy|gaillardou|tendoux|colombié|bercou'

if grep -rniE "$MOTIFS" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=__pycache__ --exclude-dir=data --exclude=LICENSE --exclude=scan-anonymisation.sh . ; then
  echo "❌ Données réelles détectées — NE PAS PUSHER." >&2
  exit 1
fi

# Emails réels (tout ce qui n'est pas example.com / agentmail générique)
if grep -rnoE "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --include="*.ts" --include="*.tsx" --include="*.sql" . | grep -v "example.com\|exemple.fr\|votre-inbox@agentmail.to" ; then
  echo "❌ Adresse email réelle détectée — NE PAS PUSHER." >&2
  exit 1
fi

echo "✅ Scan d'anonymisation : rien à signaler."
