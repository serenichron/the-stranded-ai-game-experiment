#!/bin/sh
# Frozen build for agent A's tests. Builds into a spare folder, swaps it in only if the build worked.
cd "$(dirname "$0")/.." || exit 1
rm -rf test-output/build-A-next
if npx vite build --outDir test-output/build-A-next --emptyOutDir > test-output/build-A.log 2>&1; then
  mkdir -p test-output/build-A && rm -rf test-output/build-A/* && cp -r test-output/build-A-next/. test-output/build-A/ && echo "build ok"
else
  echo "build FAILED, previous build kept:"; grep -E "error|Error|MISSING" test-output/build-A.log | head -5; exit 1
fi
