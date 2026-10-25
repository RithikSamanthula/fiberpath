#!/bin/sh
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d)"
git -C "$ROOT" worktree add -f "$TMP/fp" HEAD >/dev/null 2>&1
cp -r "$ROOT/web/.vercel" "$TMP/fp/web/.vercel"
cd "$TMP/fp/web"
npx --yes vercel@latest deploy --prod --yes 2>&1 | tail -4
cd "$ROOT" && git worktree remove --force "$TMP/fp"
