#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

check_portal() {
  local portal="$1"
  local baseline="$2"
  local output
  output="$(mktemp)"
  trap 'rm -f "$output"' RETURN

  if ! (cd "$portal" && npm run lint) >"$output" 2>&1; then
    cat "$output"
    echo "::error file=$portal::Lint command failed"
    return 1
  fi

  local summary warnings errors
  summary="$(grep -Eo '[0-9]+ problems \([0-9]+ errors, [0-9]+ warnings\)' "$output" | tail -1 || true)"
  errors="$(printf '%s' "$summary" | sed -nE 's/.*\(([0-9]+) errors.*/\1/p')"
  warnings="$(printf '%s' "$summary" | sed -nE 's/.* ([0-9]+) warnings\).*/\1/p')"
  errors="${errors:-0}"
  warnings="${warnings:-0}"

  if (( errors > 0 )); then
    cat "$output"
    echo "::error file=$portal::Lint reported $errors errors"
    return 1
  fi
  if (( warnings > baseline )); then
    cat "$output"
    echo "::error file=$portal::Lint warning count $warnings exceeds baseline $baseline"
    return 1
  fi
  echo "$portal lint: $warnings warnings (baseline: $baseline), 0 errors"
}

check_portal apps/admin-portal 6
check_portal apps/customer-portal 449
