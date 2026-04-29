#!/usr/bin/env bash
# Copyright (c) 2026 Brendan Bank
# SPDX-License-Identifier: BSD-2-Clause

# Wait for the two post-tag publish workflows (publish-images.yml +
# publish-npm.yml) to finish for a given tag. Thin wrapper around
# ``wait-runs.sh`` — kept as its own script so the maintainer flow
# in RELEASING.md step 8 stays a single, named command.
#
# Usage:
#   ./scripts/wait-publish.sh v0.16.1

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <vX.Y.Z>" >&2
  exit 64
fi

TAG="$1"

exec "$(dirname "$0")/wait-runs.sh" "$TAG" \
  publish-images.yml \
  publish-npm.yml
