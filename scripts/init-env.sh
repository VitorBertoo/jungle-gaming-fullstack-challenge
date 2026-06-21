#!/usr/bin/env bash
# Copies .env.example → .env for each service/package that doesn't already have one.
# Safe to run repeatedly — never overwrites an existing .env.

set -e

TARGETS=(
  "services/games"
  "services/wallets"
  "frontend"
)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COPIED=0

for dir in "${TARGETS[@]}"; do
  example="$ROOT/$dir/.env.example"
  target="$ROOT/$dir/.env"

  if [ ! -f "$example" ]; then
    echo "  skip  $dir  (no .env.example)"
    continue
  fi

  if [ -f "$target" ]; then
    echo "  exist $dir/.env"
  else
    cp "$example" "$target"
    echo "  init  $dir/.env"
    COPIED=$((COPIED + 1))
  fi
done

if [ "$COPIED" -gt 0 ]; then
  echo ""
  echo "$COPIED .env file(s) created from .env.example defaults."
fi
