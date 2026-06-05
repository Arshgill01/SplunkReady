#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

fail() {
  echo "FAIL secret env ignore audit: $*" >&2
  exit 1
}

require_ignored() {
  local path="$1"

  git check-ignore -q "$path" || fail "$path is not ignored"
}

require_not_ignored() {
  local path="$1"

  if git check-ignore -q "$path"; then
    fail "$path should remain available for a checked-in example"
  fi
}

require_ignored ".splunkready"
require_ignored ".splunkready.local"
require_ignored ".splunkready.env"
require_ignored ".splunkready-live.env"
require_not_ignored ".splunkready.example"
require_ignored ".env"
require_ignored ".env.local"
require_not_ignored ".env.example"

echo "PASS secret env ignore audit"
