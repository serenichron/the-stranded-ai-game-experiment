#!/bin/sh
# Frozen build for agent C's tests.
# Builds from a private git worktree (test-output/wt-C): HEAD for everything, plus agent C's own
# working files copied over (src/engine, src/level, the world models, tools). Agent D's half-finished
# character edits can never break this build, and the people stay constant between world rounds.
# Swaps into test-output/build-C only if the build worked. Never touches the user's dev server on 5190.
# Serve with: npx vite preview --outDir test-output/build-C --port 5196
cd "$(dirname "$0")/.." || exit 1
ROOT=$(pwd)
WT=test-output/wt-C
if [ ! -d "$WT/.git" ] && [ ! -f "$WT/.git" ]; then
  git worktree add --detach "$WT" HEAD > /dev/null 2>&1 || { echo "worktree add failed"; exit 1; }
  cmd //c mklink //J "$(cygpath -w "$ROOT/$WT/node_modules")" "$(cygpath -w "$ROOT/node_modules")" > /dev/null
fi
( cd "$WT" && git checkout --detach -q -f HEAD 2>/dev/null; git -C "$ROOT" rev-parse HEAD | xargs git checkout --detach -q -f )
# agent C's files: engine, level, world models except the character files, tools
cp -r src/engine/. "$WT/src/engine/"
cp -r src/level/. "$WT/src/level/"
for f in src/world/models/*.ts; do
  case "$(basename "$f")" in char-*|characters.ts) ;; *) cp "$f" "$WT/src/world/models/" ;; esac
done
rm -rf test-output/build-C-next
if ( cd "$WT" && npx vite build --outDir "$ROOT/test-output/build-C-next" --emptyOutDir ) > test-output/build-C.log 2>&1; then
  mkdir -p test-output/build-C && rm -rf test-output/build-C/* && cp -r test-output/build-C-next/. test-output/build-C/ && echo "build ok"
else
  echo "build FAILED, previous build kept:"; grep -E "error|Error|MISSING" test-output/build-C.log | head -5; exit 1
fi
