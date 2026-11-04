#!/usr/bin/env sh
set -eu
PYTHON_BIN="${PYTHON:-python3}"
exec "$PYTHON_BIN" scripts/dev.py
