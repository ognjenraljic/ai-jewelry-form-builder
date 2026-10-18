#!/bin/bash
# Local start: creates .dev.vars on first run (ADMIN_TOKEN + DEV_MODE), applies D1 migrations, runs wrangler dev.
# Add your image API keys with ./set-key.sh GEMINI_API_KEY and ./set-key.sh OPENAI_API_KEY (never committed).
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f .dev.vars ]; then
  umask 077
  { echo "ADMIN_TOKEN=$(openssl rand -hex 16)"; echo "DEV_MODE=1"; } > .dev.vars
  echo "Created .dev.vars (admin token inside). Now add keys: ./set-key.sh GEMINI_API_KEY / ./set-key.sh OPENAI_API_KEY"
fi
export WRANGLER_LOG_PATH="$PWD/.wrangler/logs" WRANGLER_SEND_METRICS=false
npx wrangler d1 migrations apply konfigurator --local
exec npx wrangler dev --port "${PORT:-8797}" --ip 127.0.0.1
