#!/bin/sh
cd "$(dirname "$0")"
while true; do
  ../../.venv/bin/python -u retrain.py ${1:-20} 2>&1 | tail -6
  sleep 900
done
