#!/usr/bin/env bash
# Usage: ml/kaggle/push.sh data-prep|train     (run from the repo root)
# Copies the script next to its kernel-metadata.json, pushes it, and prints how to follow it.
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; source .env; set +a
K=.venv/bin/kaggle
case "${1:-}" in
  data-prep) cp ml/prepare_data.py ml/kaggle/data-prep/prepare_data.py; $K kernels push -p ml/kaggle/data-prep ;;
  train)     cp ml/train.py ml/kaggle/train/train.py;                   $K kernels push -p ml/kaggle/train ;;
  *) echo "usage: $0 data-prep|train"; exit 1 ;;
esac
echo "status : $K kernels status mdmehedihasanmaruf/ikawa-${1}"
echo "output : $K kernels output mdmehedihasanmaruf/ikawa-${1} -p data/interim/kaggle_out/${1}"
