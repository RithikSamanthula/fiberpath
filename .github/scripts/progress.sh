#!/usr/bin/env bash
# Progress lives on an orphan branch called "progress": one text file of finished GEOIDs per shard.
#   progress.sh pull  <dir>            -> writes <dir>/done.txt with every finished GEOID
#   progress.sh push  <shard> <file>   -> appends <file>'s GEOIDs to progress/shard-<shard>.txt
#   progress.sh reset                  -> starts a new cycle (monthly refresh)
set -euo pipefail
repo="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
work="$(mktemp -d)"

clone() {
  if git ls-remote --exit-code --heads "$repo" progress >/dev/null 2>&1; then
    git clone --quiet --depth 1 --branch progress "$repo" "$work"
  else
    git init --quiet "$work"
    git -C "$work" checkout --quiet --orphan progress
    echo "$(date -u +%F)" > "$work/cycle.txt"
    git -C "$work" add cycle.txt
    git -C "$work" -c user.name=fiberpath-bot -c user.email=bot@users.noreply.github.com commit --quiet -m "start progress tracking"
    git -C "$work" remote add origin "$repo"
  fi
}

case "$1" in
  pull)
    clone
    mkdir -p "$2"
    cat "$work"/fcc-shard-*.txt "$work"/published.txt 2>/dev/null | sort -u > "$2/done.txt" || true
    touch "$2/done.txt"
    cp "$work/cycle.txt" "$2/cycle.txt"
    ;;
  published)
    # $2 = file of GEOIDs that already have release files; merge into the progress branch
    for i in 1 2 3; do
      rm -rf "$work"; work="$(mktemp -d)"; clone
      cp "$2" "$work/published.txt"
      git -C "$work" add -A
      git -C "$work" -c user.name=fiberpath-bot -c user.email=bot@users.noreply.github.com commit --quiet -m "published: $(wc -l < "$2") counties" || exit 0
      git -C "$work" push --quiet origin progress && exit 0
      sleep 5
    done
    ;;
  push)
    for i in 1 2 3 4 5 6; do
      rm -rf "$work"; work="$(mktemp -d)"; clone
      cat "$3" >> "$work/fcc-shard-$2.txt" 2>/dev/null || true
      sort -u -o "$work/fcc-shard-$2.txt" "$work/fcc-shard-$2.txt"
      git -C "$work" add -A
      git -C "$work" -c user.name=fiberpath-bot -c user.email=bot@users.noreply.github.com commit --quiet -m "shard $2: $(wc -l < "$3") counties" || exit 0
      git -C "$work" push --quiet origin progress && exit 0
      sleep $((RANDOM % 10 + 3))
    done
    exit 1
    ;;
  reset)
    clone
    git -C "$work" rm --quiet -f fcc-shard-*.txt 2>/dev/null || true
    echo "$(date -u +%F)" > "$work/cycle.txt"
    git -C "$work" add -A
    git -C "$work" -c user.name=fiberpath-bot -c user.email=bot@users.noreply.github.com commit --quiet -m "new cycle" || true
    git -C "$work" push --quiet origin progress
    ;;
esac
