#!/usr/bin/env bash
# Copyright (c) 2026 Brendan Bank
# SPDX-License-Identifier: BSD-2-Clause

# Render .github/RELEASE_NOTES_TEMPLATE.md into a working draft for the
# named release tag, with placeholders substituted and one
# ``## <title> — closes #N`` section pre-stubbed for every issue
# referenced as ``closes #N`` (or fixes/resolves #N) in commits since
# the previous v* tag.
#
# Usage:
#   ./scripts/release-notes.sh v0.16.0
#
# Output: .context/release-notes-v0.16.0.md   (gitignored)
#
# The maintainer then writes the per-issue prose by hand and passes
# the file to ``gh release create --notes-file …``. See RELEASING.md
# step 9 for the editorial rules (hand-write, no auto-generation, etc.).

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <vX.Y.Z>" >&2
  exit 64
fi

TAG="$1"

if ! [[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: tag must look like vX.Y.Z (got '$TAG')" >&2
  exit 64
fi

VERSION="${TAG#v}"
MINOR="${VERSION%.*}"
MAJOR="${VERSION%%.*}"

cd "$(dirname "$0")/.."

# Previous tag = highest existing v* tag that isn't this one. Used as
# both the diff base for "closes #N" extraction and as the
# {{PREV_VERSION}} substitution in the upgrade snippet.
PREV_TAG=$(
  git tag -l 'v*' --sort=-v:refname \
    | grep -v "^$TAG$" \
    | head -1 \
    || true
)
if [[ -z "$PREV_TAG" ]]; then
  echo "Warning: no previous v* tag found; {{PREV_VERSION}} will be empty" >&2
  PREV_VERSION=""
  PREV_MINOR=""
else
  PREV_VERSION="${PREV_TAG#v}"
  PREV_MINOR="${PREV_VERSION%.*}"
fi

# Extract issue numbers referenced as closes/fixes/resolves in commit
# bodies between PREV_TAG and HEAD. ``HEAD`` because at this point in
# the release flow the tag is already pushed; the diff is the same.
RANGE_BASE="${PREV_TAG:-}"
if [[ -n "$RANGE_BASE" ]]; then
  RANGE="$RANGE_BASE..HEAD"
else
  RANGE="HEAD"
fi

# Match (closes|close|closed|fix|fixes|fixed|resolve|resolves|resolved) #N
# case-insensitive — GitHub's own keyword set. ``sort -un`` dedupes
# while preserving issue numbers as numbers (so #9 sorts before #80).
ISSUE_NUMS=$(
  git log "$RANGE" --pretty=%B \
    | grep -ioE '(close[sd]?|fix(e[sd])?|resolve[sd]?) #[0-9]+' \
    | grep -oE '#[0-9]+' \
    | tr -d '#' \
    | sort -un \
    || true
)

# Build the per-issue stub block. ``gh issue view`` for the title; if
# the issue number doesn't resolve (deleted / wrong repo), surface a
# placeholder rather than failing the whole script.
build_section() {
  local num="$1"
  local title
  title=$(gh issue view "$num" --json title --jq .title 2>/dev/null || true)
  if [[ -z "$title" ]]; then
    title="<title for #$num — gh couldn't resolve>"
  fi
  cat <<EOF
## $title — closes #$num

<!--
  User-visible behaviour first, then technical detail. Code blocks for
  any new API surface. Inline ``(closes #$num)`` is already in the
  section header; don't repeat it.
-->
EOF
}

ISSUE_SECTIONS=""
if [[ -n "$ISSUE_NUMS" ]]; then
  # Two blank lines between sections — bash's $(...) strips trailing
  # newlines, so adding $'\n\n' here gives us the section + blank
  # separator the rendered Markdown wants.
  while IFS= read -r num; do
    [[ -z "$num" ]] && continue
    ISSUE_SECTIONS+="$(build_section "$num")"$'\n\n'
  done <<< "$ISSUE_NUMS"
else
  ISSUE_SECTIONS="<!-- No \`closes #N\` references in commits since ${PREV_TAG:-the start of history}. Add ## sections by hand. -->"$'\n'
fi

# Substitute placeholders in the stencil. Use Python so we don't have
# to escape ``ISSUE_SECTIONS`` for sed (it can contain anything).
mkdir -p .context
OUT=".context/release-notes-$TAG.md"

python3 - "$OUT" <<PYEOF
import sys
from pathlib import Path

stencil = Path(".github/RELEASE_NOTES_TEMPLATE.md").read_text()

subs = {
    "{{VERSION}}": "$VERSION",
    "{{MINOR}}": "$MINOR",
    "{{MAJOR}}": "$MAJOR",
    "{{PREV_VERSION}}": "$PREV_VERSION",
    "{{PREV_MINOR}}": "$PREV_MINOR",
}
out = stencil
for k, v in subs.items():
    out = out.replace(k, v)

# The leading ``<!--`` block on the stencil is for the maintainer
# reading the *file*; it shouldn't end up in the GitHub release. Drop
# everything from the start of the stencil up to and including the
# first closing ``-->``.
end = out.find("-->\n")
if end != -1:
    out = out[end + len("-->\n"):].lstrip()

# {{ISSUE_SECTIONS}} sits inside an HTML comment so the un-rendered
# stencil still reads cleanly in editors. Drop the wrapper and inline
# the generated sections.
out = out.replace(
    "<!-- {{ISSUE_SECTIONS}} -->",
    """${ISSUE_SECTIONS}""".rstrip(),
)

Path(sys.argv[1]).write_text(out)
PYEOF

echo "Wrote $OUT"
echo "  prev tag: ${PREV_TAG:-<none>}"
if [[ -n "$ISSUE_NUMS" ]]; then
  echo "  issues:   $(echo "$ISSUE_NUMS" | tr '\n' ' ')"
else
  echo "  issues:   <none — add sections by hand>"
fi
echo
echo "Edit the prose, then:"
echo "  gh release create $TAG --title \"$TAG — <headline>\" --notes-file $OUT"
