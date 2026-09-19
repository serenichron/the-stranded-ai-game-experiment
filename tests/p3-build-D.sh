#!/bin/sh
# Frozen builds for agent D's tests (phase 3), each from a private git worktree, so work in progress
# in the shared tree never breaks a test build, and D's edits never reload the user's page.
#   sh tests/p3-build-D.sh        agent D's working worktree as it is (test-output/wt-D, branch d-work) -> test-output/build-D
#   sh tests/p3-build-D.sh base   master HEAD only (the last commit, for side-by-sides)                   -> test-output/build-D-base
# Never run two builds at once.
cd "$(dirname "$0")/.." || exit 1
ROOT=$(pwd)
if [ "$1" = "base" ]; then
  WT=test-output/wt-base; OUT=build-D-base
  [ -d "$WT" ] || git worktree add --detach "$WT" master >/dev/null 2>&1
  git -C "$WT" checkout -q -- . && git -C "$WT" checkout -q --detach master || exit 1
else
  WT=test-output/wt-D; OUT=build-D
  [ -d "$WT" ] || git worktree add -b d-work "$WT" master >/dev/null 2>&1
fi
cd "$WT" || exit 1
rm -rf "$ROOT/test-output/$OUT-next"
if node "$ROOT/node_modules/vite/bin/vite.js" build --config vite.frozen.config.ts --outDir "$ROOT/test-output/$OUT-next" --emptyOutDir > "$ROOT/test-output/$OUT.log" 2>&1; then
  mkdir -p "$ROOT/test-output/$OUT" && rm -rf "$ROOT/test-output/$OUT"/* && cp -r "$ROOT/test-output/$OUT-next/." "$ROOT/test-output/$OUT/" && echo "build ok ($OUT at $(git rev-parse --short HEAD), $(git status --porcelain | wc -l) files changed)"
else
  echo "build FAILED, previous build kept:"; grep -E "error|Error|MISSING" "$ROOT/test-output/$OUT.log" | head -5; exit 1
fi
