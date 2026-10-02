#!/usr/bin/env bash
# Build into dist-<name> from a snapshot of the repo that leaves out studios still being written
# (no fa-IR or en text yet), so parallel work in progress never blocks someone else's build.
# Usage (from site/): scripts/build-isolated.sh <name>      →  site/dist-<name>
set -euo pipefail
name=${1:?usage: scripts/build-isolated.sh <name>}
repo=$(cd .. && pwd)
snap=$(mktemp -d)/kamangir
mkdir -p "$snap"
rsync -a --exclude node_modules --exclude 'dist*' --exclude test-results "$repo/site" "$repo/content" "$snap/"
for y in "$snap"/content/studios/*.yaml; do
  id=$(basename "$y" .yaml)
  if [[ ! -f "$snap/content/locales/fa-IR/studios/$id.json" || ! -f "$snap/content/locales/en/studios/$id.json" ]]; then
    echo "skipping unfinished studio: $id"
    rm "$y"
  fi
done
ln -s "$repo/site/node_modules" "$snap/site/node_modules"
(cd "$snap/site" && npx astro build --outDir "$repo/site/dist-$name" >/dev/null)
rm -rf "$(dirname "$snap")"
echo "built site/dist-$name"
