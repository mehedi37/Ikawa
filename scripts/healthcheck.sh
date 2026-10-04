#!/usr/bin/env bash
# Usage: scripts/healthcheck.sh https://<your-app>.vercel.app
# Checks that the deployed PWA is reachable and serving what we think it is. Exit code 0 = healthy.
# A static site on Vercel (or a Render *static site*) does not "sleep", so no keep-alive cron is needed.
# Run this after each deploy, or from any scheduler (cron, GitHub Actions) if you want monitoring.
set -euo pipefail
URL="${1:?usage: $0 https://app-url}"; URL="${URL%/}"
fail() { echo "UNHEALTHY: $*"; exit 1; }
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$1"; }

[ "$(code "$URL/")" = 200 ] || fail "index not 200"
H=$(curl -s --max-time 20 "$URL/health.json") || fail "no health.json"
echo "$H" | python3 -c 'import sys,json; h=json.load(sys.stdin); assert h["status"]=="ok"; print("commit",h["commit"],"| built",h["builtAt"],"| model",h["model"]["sha256"][:12],h["model"]["bytes"],"bytes")' \
  || fail "bad health.json"
for p in model/leaf_int8.onnx sw.js manifest.webmanifest grid/plot_grid.json grid/rain_asof.json prices/prices.json; do
  [ "$(code "$URL/$p")" = 200 ] || fail "$p not 200"
done
WASM=$(curl -s --max-time 20 "$URL/sw.js" | grep -o 'assets/ort-wasm[^"]*\.wasm' | head -1)
[ -n "$WASM" ] && [ "$(code "$URL/$WASM")" = 200 ] || fail "onnxruntime wasm not reachable"
CT=$(curl -sI --max-time 20 "$URL/$WASM" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type"{print $2}')
[[ "$CT" == application/wasm* ]] || fail "wasm content-type is '$CT' (needs application/wasm)"
SWCC=$(curl -sI --max-time 20 "$URL/sw.js" | tr -d '\r' | awk -F': ' 'tolower($1)=="cache-control"{print $2}')
[[ "$SWCC" == *no-cache* ]] || echo "WARN: sw.js Cache-Control is '$SWCC' (updates may reach phones slowly)"
echo "HEALTHY: $URL"
