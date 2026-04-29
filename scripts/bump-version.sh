#!/usr/bin/env bash
# Copyright (c) 2026 Brendan Bank
# SPDX-License-Identifier: BSD-2-Clause

# Bump every place atrium's version is pinned, in lockstep.
#
# Usage:
#   ./scripts/bump-version.sh 0.16.0
#
# Touches (in lockstep — the publish-npm workflow fans out to all four
# packages, so a stale version in any one blocks the release):
#
#   backend/pyproject.toml                      version = "X.Y.Z"
#   packages/host-types/package.json            "version"
#   packages/host-bundle-utils/package.json     "version"
#   packages/test-utils/package.json            "version"
#   packages/create-atrium-host/package.json    "version"
#   packages/create-atrium-host/src/cli.js      DEFAULT_ATRIUM_VERSION = 'X.Y'
#   packages/create-atrium-host/README.md       "default: \`X.Y\`" pin call-out
#   packages/host-types/README.md               "Pin \`^X.Y\`" + "atrium X.Y.x"
#   packages/host-bundle-utils/README.md        same
#   docs/new-project/README.md                  ATRIUM_IMAGE=…/atrium:X.Y
#   docs/new-project/SKILL.md                   same
#   examples/hello-world/Dockerfile             ARG ATRIUM_IMAGE=…/atrium:X.Y
#
# Does NOT refresh the lockfiles (uv.lock, pnpm-lock.yaml) or write a
# compat-matrix row — both belong in the calling Makefile target so the
# user can review the resulting diff before committing.
#
# Uses ``perl -i -pe`` for in-place substitution so this script works
# unchanged on macOS (BSD sed differs in -i argument handling) and Linux
# (GNU sed). ``jq`` for the package.json edits — preserves trailing
# newline + key order.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <X.Y.Z>" >&2
  exit 64
fi

VERSION="$1"

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must be in X.Y.Z form (got '$VERSION')" >&2
  exit 64
fi

MINOR="${VERSION%.*}"   # 0.16.0 → 0.16

cd "$(dirname "$0")/.."

# ---- backend/pyproject.toml ------------------------------------------------
perl -i -pe 's{^version = "[^"]*"}{version = "'"$VERSION"'"}' \
  backend/pyproject.toml

# ---- packages/*/package.json -----------------------------------------------
for pkg in host-types host-bundle-utils test-utils create-atrium-host; do
  f="packages/$pkg/package.json"
  tmp=$(mktemp)
  jq --arg v "$VERSION" '.version = $v' "$f" > "$tmp"
  mv "$tmp" "$f"
done

# ---- packages/create-atrium-host/src/cli.js --------------------------------
# DEFAULT_ATRIUM_VERSION pins the major.minor that scaffolded hosts
# emit in their compose / Dockerfile / package.json, so the patch digit
# is intentionally dropped here.
perl -i -pe "s{DEFAULT_ATRIUM_VERSION = '[^']*'}{DEFAULT_ATRIUM_VERSION = '$MINOR'}" \
  packages/create-atrium-host/src/cli.js

# ---- READMEs: illustrative pin examples ------------------------------------
# `Pin \`^0.15\`` → `Pin \`^0.16\``; `0.15.x` → `0.16.x`.
for f in packages/host-types/README.md \
         packages/host-bundle-utils/README.md; do
  perl -i -pe "s{Pin \`\\^[0-9]+\\.[0-9]+\`}{Pin \`^$MINOR\`}g; \
              s{atrium [0-9]+\\.[0-9]+\\.x}{atrium $MINOR.x}g" \
    "$f"
done

# create-atrium-host's README has a `--atrium` default cell in the
# options table.
perl -i -pe "s{\\(default: \`[0-9]+\\.[0-9]+\`\\)}{(default: \`$MINOR\`)}" \
  packages/create-atrium-host/README.md

# ---- docs/new-project + examples/hello-world: image pins -------------------
# Match `atrium:0.X` only when followed by a quote, end-of-line, or
# whitespace so a hypothetical reference to `atrium:0.15.3` (a fully-
# pinned tag) inside an unrelated example block isn't rewritten.
PIN_REGEX='atrium:[0-9]+\.[0-9]+(?=["\s]|$)'
for f in docs/new-project/README.md \
         docs/new-project/SKILL.md \
         examples/hello-world/Dockerfile; do
  perl -i -pe "s{$PIN_REGEX}{atrium:$MINOR}g" "$f"
done

# ---- packages/create-atrium-host: scaffolder fixtures ---------------------
# The render-test renders templates against an ``ATRIUM_VERSION``
# fixture and asserts the resulting compose contains ``atrium:<minor>``.
# Both the input fixture and the assertion must move in lockstep —
# missing the fixture and bumping only the assertion makes the test
# fail (rendered output uses the old minor; assertion expects the
# new one). The template README has an illustrative full-version
# example for the override flag.
perl -i -pe "s{atrium:[0-9]+\\.[0-9]+(?=['\"])}{atrium:$MINOR}g; \
            s{ATRIUM_VERSION: '[0-9]+\\.[0-9]+'}{ATRIUM_VERSION: '$MINOR'}g" \
  packages/create-atrium-host/test/render.test.js
perl -i -pe "s{atrium:[0-9]+\\.[0-9]+\\.[0-9]+ make build}{atrium:$VERSION make build}g" \
  packages/create-atrium-host/template/README.md

echo "Bumped to $VERSION (minor=$MINOR). Refresh lockfiles next:"
echo "  ( cd backend && uv lock --quiet )"
echo "  pnpm install --lockfile-only"
echo "Then add a row to docs/compat-matrix.md and review with: git diff"
