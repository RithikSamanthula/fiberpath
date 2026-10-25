#!/bin/sh
cd "$(dirname "$0")"
for g in "$@"; do ../.venv/bin/python plan.py "$g" > "cache/run-$g.log" 2>&1 || echo "failed $g"; done
