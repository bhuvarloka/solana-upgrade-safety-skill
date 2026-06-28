#!/usr/bin/env bash
# CI gate: fail if the committed IDL is an un-migrated, account-corrupting change vs the
# previous tagged IDL. Reused by .github/workflows/upgrade-gate.yml; runnable locally for tests.
#
#   IDL=path/to/idl.json BASE_REF=v1.2.3 ./upgrade-gate.sh
#
# BASE_REF defaults to the most recent tag. If the IDL didn't exist at BASE_REF (first commit
# of it), there is nothing to corrupt → pass. Exit 1 only on verdict MIGRATE.
set -euo pipefail

IDL="${IDL:-}"
BASE_REF="${BASE_REF:-$(git describe --tags --abbrev=0 2>/dev/null || true)}"

if [[ -z "$IDL" ]]; then
  echo "upgrade-gate: set IDL=<path to committed idl.json>" >&2
  exit 2
fi
if [[ ! -f "$IDL" ]]; then
  echo "upgrade-gate: IDL not found: $IDL" >&2
  exit 2
fi
if [[ -z "$BASE_REF" ]]; then
  echo "upgrade-gate: no previous tag to compare against — nothing to gate. PASS."
  exit 0
fi

before="$(mktemp)"
trap 'rm -f "$before"' EXIT

if ! git show "$BASE_REF:$IDL" >"$before" 2>/dev/null; then
  echo "upgrade-gate: $IDL did not exist at $BASE_REF — new IDL, nothing to corrupt. PASS."
  exit 0
fi

echo "upgrade-gate: comparing $BASE_REF:$IDL → working tree $IDL"
out="$(mktemp -d)"
trap 'rm -f "$before"; rm -rf "$out"' EXIT
idl_abs="$(cd "$(dirname "$IDL")" && pwd)/$(basename "$IDL")"

# The CLI exits 1 on MIGRATE (corrupting), 0 otherwise. Any other code is an internal error,
# not a verdict — don't mislabel a crash as account corruption.
rc=0
pnpm -C engine run -s check-upgrade "$before" "$idl_abs" --out "$out" || rc=$?
case "$rc" in
  0) echo "upgrade-gate: PASS — no un-migrated account-corrupting change." ;;
  1)
    echo "::error::upgrade-gate: this change corrupts already-deployed accounts. Migrate or ship a new program ID."
    [[ -f "$out/report.md" ]] && cat "$out/report.md"
    ;;
  *) echo "::error::upgrade-gate: classifier failed (exit $rc) — not a verdict. Check the IDL is valid JSON." >&2 ;;
esac
exit "$rc"
