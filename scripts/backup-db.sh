#!/usr/bin/env bash
# Database backup (BLUEPRINT §18.4): a pg_dump of the public, auth and storage schemas into backups/.
#
#   npm run backup:db
#
# Needs pg_dump (macOS: `brew install libpq` and add it to PATH) and SUPABASE_DB_URL in .env.local
# (Supabase → Project Settings → Database → Connection string, "Session pooler", with your DB password).
# The dump holds personal data and password hashes: keep it private and never commit it.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  SUPABASE_DB_URL="${SUPABASE_DB_URL:-$(grep -E '^SUPABASE_DB_URL=' .env.local | head -1 | cut -d= -f2-)}"
fi
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Set SUPABASE_DB_URL in .env.local first." >&2
  exit 1
fi
if ! command -v pg_dump >/dev/null; then
  echo "pg_dump not found. On macOS: brew install libpq && brew link --force libpq" >&2
  exit 1
fi

mkdir -p backups
out="backups/db-$(date +%Y%m%d-%H%M).dump"
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges --schema=public --schema=auth --schema=storage --file="$out"
echo "Saved $out ($(du -h "$out" | cut -f1)). Restore with: pg_restore --no-owner -d <db-url> $out"
