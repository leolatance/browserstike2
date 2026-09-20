#!/bin/bash
# Bundles the engine into one ESM file for the Deno edge functions (no engine source changes).
set -e
cd "$(dirname "$0")/.."
npx esbuild packages/engine/src/index.ts --bundle --format=esm --platform=neutral --target=es2022 --outfile=supabase/functions/_shared/engine.js --log-level=warning
echo "engine bundled → supabase/functions/_shared/engine.js"
