#!/usr/bin/env bash
# Copyright (c) 2026 Brendan Bank
# SPDX-License-Identifier: BSD-2-Clause

# Wait for both publish workflows to finish for a given tag, then exit
# non-zero if either failed. Replaces the dance of running two
# ``gh run watch`` calls in parallel.
#
# Usage:
#   ./scripts/wait-publish.sh v0.16.0
#
# What it does:
#
#   1. Resolve the run IDs for ``publish-images.yml`` and
#      ``publish-npm.yml`` triggered by the named tag. Polls briefly
#      because the runs may not yet exist when this is called right
#      after ``git push origin <tag>``.
#   2. Watches both with ``gh run watch --exit-status``.
#   3. Prints a one-line summary; non-zero exit if either workflow
#      didn't end in ``success``.
#
# Why bash + ``gh`` instead of doing this from the agent's loop:
# spinning two background watches and waking up on cron means each
# wake-up crosses the 5-minute prompt-cache TTL, which is more
# expensive than blocking on a foreground bash call.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <vX.Y.Z>" >&2
  exit 64
fi

TAG="$1"
WORKFLOWS=(publish-images.yml publish-npm.yml)

# ``gh run list --event tag --workflow=<wf>`` filters by trigger. We
# match on the head ref the workflow saw (``refs/tags/<tag>`` shows up
# as ``<tag>`` in ``headBranch``) so a second push with the same tag
# would still resolve to the latest run.

resolve_run() {
  local wf=$1 try
  for try in 1 2 3 4 5; do
    local id
    id=$(gh run list --workflow="$wf" --limit 5 \
        --json databaseId,headBranch \
        --jq ".[] | select(.headBranch == \"$TAG\") | .databaseId" \
        | head -1)
    if [[ -n "${id:-}" ]]; then
      echo "$id"
      return 0
    fi
    # Tag-triggered workflows can take a few seconds to register.
    sleep 5
  done
  echo "Error: no run for workflow $wf on tag $TAG (after 25s)" >&2
  return 1
}

declare -a RUN_IDS=()
for wf in "${WORKFLOWS[@]}"; do
  echo "Resolving run for $wf..." >&2
  id=$(resolve_run "$wf")
  echo "  $wf → run $id"
  RUN_IDS+=("$id")
done

# Watch both. ``gh run watch --exit-status`` blocks until completion
# and exits non-zero on failure; we watch them serially because the
# typical critical path is publish-images (3-5 min) >> publish-npm
# (~1 min) and a parallel watch saves only the npm minute on failure.
status=0
for i in "${!WORKFLOWS[@]}"; do
  wf="${WORKFLOWS[$i]}"
  id="${RUN_IDS[$i]}"
  echo
  echo "==> watching $wf (run $id)"
  if ! gh run watch "$id" --exit-status; then
    status=1
  fi
done

echo
for i in "${!WORKFLOWS[@]}"; do
  wf="${WORKFLOWS[$i]}"
  id="${RUN_IDS[$i]}"
  conclusion=$(gh run view "$id" --json conclusion --jq .conclusion)
  printf '  %-22s %s\n' "$wf" "$conclusion"
done

exit $status
