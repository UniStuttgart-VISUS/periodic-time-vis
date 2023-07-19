#!/usr/bin/env bash

set -euo pipefail

poetry run python -m gunicorn \
  --reload \
  --threads 100 \
  --access-logfile - \
  backend:app
