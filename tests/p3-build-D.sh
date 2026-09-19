#!/bin/sh
# Frozen build for agent D's tests (phase 3). Includes the character bench as a second page.
# Builds into a spare folder, swaps it in only if the build worked. Never run two builds at once.
cd "$(dirname "$0")/.." || exit 1
rm -rf test-output/build-D-next
if npx vite build --config vite.frozen.config.ts --outDir test-output/build-D-next --emptyOutDir > test-output/build-D.log 2>&1; then
  mkdir -p test-output/build-D && rm -rf test-output/build-D/* && cp -r test-output/build-D-next/. test-output/build-D/ && echo "build ok"
else
  echo "build FAILED, previous build kept:"; grep -E "error|Error|MISSING" test-output/build-D.log | head -5; exit 1
fi
