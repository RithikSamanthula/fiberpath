#!/bin/sh
# Usage: sh batch.sh 13281 13111 54075 ...   (5-digit county GEOIDs)
cd "$(dirname "$0")"
for g in "$@"; do ../.venv/bin/python plan.py "$g" > "cache/run-$g.log" 2>&1 || echo "failed $g"; done
