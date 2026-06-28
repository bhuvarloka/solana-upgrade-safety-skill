#!/usr/bin/env bash
# Portable entry point — works in any agent or shell, no Claude Code required.
# Compares the previously committed IDL against the working-tree IDL and exits:
#   0 = safe to upgrade in place
#   1 = MIGRATE — this corrupts already-deployed accounts
#   2 = bad input / not a verdict (don't treat as corruption)
#
#   ./check-upgrade.sh path/to/idl.json [BASE_REF]
#
# BASE_REF defaults to the latest git tag. If the IDL didn't exist there, nothing
# to corrupt → exit 0. This is the same comparison the CI gate runs.
set -euo pipefail

IDL="${1:-}"
BASE_REF="${2:-$(git describe --tags --abbrev=0 2>/dev/null || true)}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[[ -n "$IDL" ]]   || { echo "usage: ./check-upgrade.sh <idl.json> [BASE_REF]" >&2; exit 2; }
[[ -f "$IDL" ]]   || { echo "IDL not found: $IDL" >&2; exit 2; }
[[ -n "$BASE_REF" ]] || { echo "no git tag to compare against — nothing to gate. PASS."; exit 0; }

before="$(mktemp)"; trap 'rm -f "$before"' EXIT
if ! git show "$BASE_REF:$IDL" >"$before" 2>/dev/null; then
  echo "$IDL did not exist at $BASE_REF — new IDL, nothing to corrupt. PASS."; exit 0
fi

idl_abs="$(cd "$(dirname "$IDL")" && pwd)/$(basename "$IDL")"
exec npx --prefix "$ROOT/engine" tsx "$ROOT/engine/src/cli.ts" "$before" "$idl_abs"
