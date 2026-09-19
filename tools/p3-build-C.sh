#!/bin/sh
# Frozen build for agent C's tests (phase 3).
# Agent C works in a private git worktree (test-output/wt-C, branch c-work), never in the main tree:
# the main tree feeds the user's dev server on 5190, so a half-done edit there reloads (or breaks)
# the user's page. This script builds the worktree as it stands and swaps the result into
# test-output/build-C only if the build worked. A win is brought to master with a commit there.
# Serve with: npx vite preview --outDir test-output/build-C --port 5196
cd "$(dirname "$0")/.." || exit 1
ROOT=$(pwd)
WT=test-output/wt-C
if [ ! -e "$WT/.git" ]; then
  git worktree add -B c-work "$WT" master > /dev/null 2>&1 || { echo "worktree add failed"; exit 1; }
  cmd //c mklink //J "$(cygpath -w "$ROOT/$WT/node_modules")" "$(cygpath -w "$ROOT/node_modules")" > /dev/null
fi
rm -rf test-output/build-C-next
if ( cd "$WT" && npx vite build --outDir "$ROOT/test-output/build-C-next" --emptyOutDir ) > test-output/build-C.log 2>&1; then
  mkdir -p test-output/build-C && rm -rf test-output/build-C/* && cp -r test-output/build-C-next/. test-output/build-C/ && echo "build ok ($(git -C "$WT" log --oneline -1))"
else
  echo "build FAILED, previous build kept:"; grep -E "error|Error|MISSING" test-output/build-C.log | head -5; exit 1
fi
