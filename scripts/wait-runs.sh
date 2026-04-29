#!/usr/bin/env bash
# Copyright (c) 2026 Brendan Bank
# SPDX-License-Identifier: BSD-2-Clause

# Wait for one or more named workflow runs on a given head ref to
# finish, then exit non-zero if any didn't end in ``success``. Used by
# both ``wait-publish.sh`` (post-tag publish workflows) and the
# ``make ci-wait`` target (pre-merge PR CI), which is why the workflow
# names are arguments rather than baked in.
#
# Usage:
#   ./scripts/wait-runs.sh <head-ref> <workflow.yml> [<workflow.yml>...]
#
# Examples:
#   ./scripts/wait-runs.sh v0.16.1 publish-images.yml publish-npm.yml
#   ./scripts/wait-runs.sh release-tooling ci.yml
#
# Why this exists vs. plain ``gh run watch``:
#
# 1. ``gh run watch --exit-status`` returns 0 in some failure
#    scenarios — observed when watching a multi-job workflow whose
#    overall conclusion settles after ``status=completed`` first
#    appears. We belt-and-braces by **also** reading
#    ``gh run view --json conclusion`` after the watch returns and
#    failing if it isn't ``success``.
# 2. Spinning two parallel ``gh run watch``s in an agent loop is
#    expensive — each cross-cache wakeup costs more than the foreground
#    watch saves. Doing it in bash is one shell, no wakeups.
# 3. Tag- and branch-triggered workflows take a few seconds to register
#    after ``git push``, so we poll briefly to resolve the run id
#    before watching.

set -euo pipefail

if [[ $# -lt 2 ]]; then
  cat >&2 <<EOF
Usage: $0 <head-ref> <workflow.yml> [<workflow.yml>...]
  <head-ref>      tag (e.g. v0.16.1) or branch name (e.g. release-tooling)
  <workflow.yml>  workflow filename(s) under .github/workflows/
EOF
  exit 64
fi

HEAD_REF="$1"
shift
WORKFLOWS=("$@")

cd "$(dirname "$0")/.."

# A run can take a few seconds to register after the trigger event
# (tag push / PR sync). Try for ~25 s before giving up, and skip
# workflows that are configured with ``paths-ignore`` and produced no
# run for this ref (CI for a docs-only branch, for example).
resolve_run() {
  local wf=$1 try
  for try in 1 2 3 4 5; do
    local id
    id=$(gh run list --workflow="$wf" --limit 5 \
        --json databaseId,headBranch \
        --jq ".[] | select(.headBranch == \"$HEAD_REF\") | .databaseId" \
        | head -1)
    if [[ -n "${id:-}" ]]; then
      echo "$id"
      return 0
    fi
    sleep 5
  done
  return 1
}

declare -a RESOLVED=()
declare -a SKIPPED=()
for wf in "${WORKFLOWS[@]}"; do
  echo "Resolving run for $wf on $HEAD_REF..." >&2
  if id=$(resolve_run "$wf"); then
    echo "  $wf → run $id"
    RESOLVED+=("$wf=$id")
  else
    echo "  $wf → no run found (paths-ignore'd? skipping)" >&2
    SKIPPED+=("$wf")
  fi
done

if [[ ${#RESOLVED[@]} -eq 0 ]]; then
  echo "No runs to watch (every workflow was skipped)." >&2
  exit 0
fi

# Watch each resolved run serially. ``gh run watch --exit-status``
# blocks until completion. We don't trust its exit status alone —
# see the doc comment at the top — and re-check the conclusion via
# ``gh run view`` afterwards.
status=0
for entry in "${RESOLVED[@]}"; do
  wf="${entry%%=*}"
  id="${entry##*=}"
  echo
  echo "==> watching $wf (run $id)"
  # ``--exit-status`` is best-effort; we accept whatever it reports
  # and re-check below. ``|| true`` so a non-zero from watch alone
  # doesn't kill the loop before we've run every workflow.
  gh run watch "$id" --exit-status || true
  conclusion=$(gh run view "$id" --json conclusion --jq .conclusion 2>/dev/null || echo "")
  if [[ "$conclusion" != "success" ]]; then
    status=1
  fi
done

echo
for entry in "${RESOLVED[@]}"; do
  wf="${entry%%=*}"
  id="${entry##*=}"
  conclusion=$(gh run view "$id" --json conclusion --jq .conclusion 2>/dev/null || echo "?")
  printf '  %-22s %s\n' "$wf" "$conclusion"
done
# ``${arr[@]:+...}`` expands to nothing when the array is empty, dodging
# bash's ``set -u`` "unbound variable" error on an empty array.
for wf in "${SKIPPED[@]:+${SKIPPED[@]}}"; do
  printf '  %-22s skipped (no run)\n' "$wf"
done

exit $status
