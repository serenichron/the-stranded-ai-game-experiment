#!/bin/sh
# Frozen build for agent B's tests. Builds into a spare folder, swaps it in only if the build worked.
cd "$(dirname "$0")/.." || exit 1
rm -rf test-output/build-B-next
if npx vite build --outDir test-output/build-B-next --emptyOutDir > test-output/build-B.log 2>&1; then
  mkdir -p test-output/build-B && rm -rf test-output/build-B/* && cp -r test-output/build-B-next/. test-output/build-B/ && echo "build ok"
else
  echo "build FAILED, previous build kept:"; grep -E "error|Error|MISSING" test-output/build-B.log | head -5; exit 1
fi
