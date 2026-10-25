#!/bin/sh
cd "$(dirname "$0")"
while pgrep -f fcc_all.sh >/dev/null; do sleep 20; done
for f in data/state-*-fcc-h3.csv.gz; do
  s=$(basename "$f" | sed 's/state-\([0-9]*\)-.*/\1/')
  [ -f "data/fcc-providers/$s.json.gz" ] && continue
  echo "== providers for $s"
  ../.venv/bin/python -u fcc_bdc.py $s && gzip -f "data/state-$s-fcc-h3.csv" || echo "FAILED $s"
done
echo finished
