#!/bin/sh
# Frozen builds for agent D's tests (phase 3), each from a private git worktree, so work in progress
# in the shared tree (either lead's) never breaks a test build.
#   sh tests/p3-build-D.sh        HEAD plus agent D's uncommitted character files -> test-output/build-D
#   sh tests/p3-build-D.sh base   HEAD only (the last commit, for side-by-sides)  -> test-output/build-D-base
# Never run two builds at once.
cd "$(dirname "$0")/.." || exit 1
ROOT=$(pwd)
if [ "$1" = "base" ]; then WT=test-output/wt-base; OUT=build-D-base; else WT=test-output/wt-D; OUT=build-D; fi
[ -d "$WT" ] || git worktree add --detach "$WT" HEAD >/dev/null 2>&1
git -C "$WT" checkout -q -- . && git -C "$WT" clean -qfd -- src tests >/dev/null
git -C "$WT" checkout -q --detach "$(git rev-parse HEAD)" || exit 1
if [ "$1" != "base" ]; then
  # agent D's files only: characters, the bench, the creation screen, tests
  for f in $(git status --porcelain -- src/world/models/char-*.ts src/world/models/characters.ts src/world/models/dev src/ui/creation.ts src/ui/style.css tests vite.frozen.config.ts | awk '{print $2}'); do
    mkdir -p "$WT/$(dirname "$f")" && cp "$f" "$WT/$f"
  done
fi
cd "$WT" || exit 1
rm -rf "$ROOT/test-output/$OUT-next"
if node "$ROOT/node_modules/vite/bin/vite.js" build --config vite.frozen.config.ts --outDir "$ROOT/test-output/$OUT-next" --emptyOutDir > "$ROOT/test-output/$OUT.log" 2>&1; then
  mkdir -p "$ROOT/test-output/$OUT" && rm -rf "$ROOT/test-output/$OUT"/* && cp -r "$ROOT/test-output/$OUT-next/." "$ROOT/test-output/$OUT/" && echo "build ok ($OUT at $(git rev-parse --short HEAD))"
else
  echo "build FAILED, previous build kept:"; grep -E "error|Error|MISSING" "$ROOT/test-output/$OUT.log" | head -5; exit 1
fi
