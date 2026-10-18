#!/bin/sh
# Waits for the detector comparison, then re-bakes the demo photos, commits, pushes and deploys the better model.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG="$1"
while pgrep -f "cv/finish2.py" >/dev/null; do sleep 15; done
if ! grep -q "^installed" "$LOG"; then echo "detector comparison did not finish; nothing pushed"; exit 1; fi
grep -E "^v4|^v3|installed|keeping" "$LOG" | cut -c1-600
cd "$ROOT/web" || exit 1
curl -s -m 5 localhost:3111/api/index >/dev/null || { (npx next start -p 3111 >/tmp/fp-next.log 2>&1 &); sleep 8; }
node scripts/bake-cv-demo.mjs 6
cd "$ROOT" && git add -A && git -c user.name=RithikSamanthula -c user.email=rithik.samanthula@gmail.com commit -q -m "Install the better pole detector with its measured accuracy" && git push -q origin main
sh "$ROOT/pipeline/cv/deploy.sh"
echo "pushed and deployed"
