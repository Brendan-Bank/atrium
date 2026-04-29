#!/usr/bin/env bash
# Copyright (c) 2026 Brendan Bank
# SPDX-License-Identifier: BSD-2-Clause

# Wait for the pre-merge CI workflows (ci.yml, codeql.yml, security.yml)
# to finish for a given branch and exit non-zero if any failed. Thin
# wrapper around ``wait-runs.sh``.
#
# Usage:
#   ./scripts/wait-ci.sh <branch-name>
#
# Or, more typically, via the Makefile:
#
#   make ci-wait BR=<branch-name>
#
# Why the workflows are listed explicitly rather than auto-detected:
# this repo runs three on every PR. Hardcoding them makes a missing
# run detectable (``wait-runs.sh`` will skip workflows with no run on
# the ref, which is correct when paths-ignore filtered them out, but
# the maintainer should know up-front that they're being skipped —
# not surprised by a green ``ci-wait`` on a branch where CI didn't
# even fire).

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <branch-name>" >&2
  exit 64
fi

BRANCH="$1"

exec "$(dirname "$0")/wait-runs.sh" "$BRANCH" \
  ci.yml \
  codeql.yml \
  security.yml
