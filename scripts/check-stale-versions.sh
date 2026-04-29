#!/usr/bin/env bash
# Copyright (c) 2026 Brendan Bank
# SPDX-License-Identifier: BSD-2-Clause

# Find leftover references to *previous* atrium minor versions in the
# files where pin-version-currency is load-bearing. Run after
# ``bump-version.sh`` to confirm the doc sweep is complete.
#
# Usage:
#   ./scripts/check-stale-versions.sh 0.16.0
#
# Exits non-zero if anything looks stale, printing one ``file:line: …``
# per finding so an editor can jump straight to it.
#
# Scope: explicit allowlist of files, NOT a tree-walk. Two reasons:
# (1) cheaper / no need to maintain large exclusion lists; (2) places
# that legitimately mention past versions — RELEASING.md prose,
# docs/published-images.md historical notes, ADR records, code
# comments — don't get false-positive matches. The trade-off is that
# adding a new pin location requires extending both this list and
# ``bump-version.sh``.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <X.Y.Z>" >&2
  exit 64
fi

VERSION="$1"
MINOR="${VERSION%.*}"

cd "$(dirname "$0")/.."

# Files where ``atrium:0.X`` (minor pin) must equal current minor.
IMAGE_PIN_FILES=(
  docs/new-project/README.md
  docs/new-project/SKILL.md
  examples/hello-world/Dockerfile
)

# Files where the README pin example (``Pin `^0.X``` / ``atrium 0.X.x``)
# must equal current minor.
README_PIN_FILES=(
  packages/host-types/README.md
  packages/host-bundle-utils/README.md
)

# Single-file pins that bump-version.sh handles individually.
SCAFFOLDER_FILE=packages/create-atrium-host/src/cli.js
SCAFFOLDER_README=packages/create-atrium-host/README.md
SCAFFOLDER_TEST=packages/create-atrium-host/test/render.test.js
SCAFFOLDER_TEMPLATE_README=packages/create-atrium-host/template/README.md

stale=0
emit() {
  # ``grep -En`` returns ``line:match`` per file. Prefix the file path
  # so jumps work in editors.
  local label=$1 file=$2 pattern=$3 keep=$4
  echo "==> $label ($file)"
  if [[ ! -f "$file" ]]; then
    echo "  (file missing — extend bump-version.sh or remove from this checker)" >&2
    stale=$((stale + 1))
    return
  fi
  local hits
  hits=$(grep -En -e "$pattern" "$file" 2>/dev/null \
    | grep -vE "$keep" \
    | sed "s|^|$file:|" \
    || true)
  if [[ -n "$hits" ]]; then
    echo "$hits"
    stale=$((stale + $(printf '%s\n' "$hits" | wc -l)))
  fi
}

for f in "${IMAGE_PIN_FILES[@]}"; do
  emit "image pin" "$f" \
       'atrium:0\.[0-9]+([^0-9]|$)' \
       "atrium:$MINOR([^0-9]|\$)"
done

for f in "${README_PIN_FILES[@]}"; do
  emit "README pin" "$f" \
       'Pin `\^0\.[0-9]+`|atrium 0\.[0-9]+\.x' \
       "Pin \`\^$MINOR\`|atrium $MINOR\.x"
done

emit "scaffolder default" "$SCAFFOLDER_FILE" \
     "DEFAULT_ATRIUM_VERSION = '0\.[0-9]+'" \
     "DEFAULT_ATRIUM_VERSION = '$MINOR'"

emit "scaffolder README options table" "$SCAFFOLDER_README" \
     'default: `0\.[0-9]+`' \
     "default: \`$MINOR\`"

emit "scaffolder render-test compose pin" "$SCAFFOLDER_TEST" \
     'atrium:0\.[0-9]+' \
     "atrium:$MINOR"

emit "scaffolder render-test ATRIUM_VERSION fixture" "$SCAFFOLDER_TEST" \
     "ATRIUM_VERSION: '0\.[0-9]+'" \
     "ATRIUM_VERSION: '$MINOR'"

emit "scaffolder template README override example" "$SCAFFOLDER_TEMPLATE_README" \
     'atrium:0\.[0-9]+\.[0-9]+' \
     "atrium:$VERSION"

if [[ $stale -gt 0 ]]; then
  echo
  echo "Found $stale stale reference(s). Sweep manually or extend bump-version.sh." >&2
  exit 1
fi

echo
echo "No stale version references."
