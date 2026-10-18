#!/bin/bash
# Upiše API ključ u .dev.vars bez prikaza na ekranu. Stari red sa istim imenom se briše.
#   ./set-key.sh                  -> GEMINI_API_KEY (default)
#   ./set-key.sh OPENAI_API_KEY   -> OpenAI ključ
set -euo pipefail
cd "$(dirname "$0")"
NAME="${1:-GEMINI_API_KEY}"
case "$NAME" in GEMINI_API_KEY|OPENAI_API_KEY) ;; *) echo "Nepoznato ime ključa: $NAME"; exit 1 ;; esac
read -rsp "$NAME (ne prikazuje se): " K
echo
if [ -z "$K" ]; then echo "Prazno, nista nije upisano."; exit 1; fi
case "$NAME:$K" in
  GEMINI_API_KEY:AIza*|GEMINI_API_KEY:AQ.*|OPENAI_API_KEY:sk-*) ;;
  *) echo "Upozorenje: kljuc ne izgleda kao uobicajen $NAME. Upisujem svejedno." ;;
esac
touch .dev.vars
sed -i '' "/^$NAME=/d" .dev.vars
printf '%s=%s\n' "$NAME" "$K" >> .dev.vars
unset K
chmod 600 .dev.vars
echo "Upisano: $NAME"
