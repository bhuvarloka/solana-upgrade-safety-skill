---
description: Analyze an Anchor IDL upgrade for account-layout compatibility and generate the migration.
---

# /check-upgrade

Run the upgrade-safety analysis on a pair of Anchor IDLs (or a proposed change) and emit the migration artifacts.

## Usage

```
pnpm -C <skill-dir>/engine run check-upgrade <before.json> <after.json> [--json | --out <dir>] [--assume <model>]
```

`<skill-dir>` is the installed skill directory (e.g. `~/.claude/skills/upgrade-safety`). Use absolute paths for the IDLs so it runs from any working directory.

- `<before.json>` — the currently-deployed IDL (or `anchor idl fetch <program-id>`).
- `<after.json>` — the new/proposed IDL.
- `--json` — print a single JSON line with the verdict and the artifacts (including `report.md`) and write nothing. Use this to diagnose.
- `--out <dir>` — write the migration artifacts to `<dir>`. Use this only when generating the migration.
- `--assume <model>` — force the serialization model: `anchor-borsh` | `zero-copy` | `manual`. Skips detection.

## What it does

1. **Gate** — detect the serialization model. Refuses confidently on manual/unknown layouts.
2. **Classify** — walk the five compatibility categories and roll up to SAFE / MIGRATE / COORDINATE / REFUSE.
3. **Generate** (with `--out`) — write `report.md`; add `release-checklist.md` unless SAFE, and `migration.rs` / `migration.ts` / `regression.test.ts` when MIGRATE.

## Exit codes

- `0` — SAFE, COORDINATE, or REFUSE.
- `1` — MIGRATE (an in-place upgrade would corrupt data). Use this to gate a PR in CI.
- `2` — bad input (report the error, not a verdict).

## Proposed-change mode

No `after.json` yet? Describe the edit ("add a `bump` field to `Vault`", "change `balance` to u128") and the skill synthesizes the `after` IDL, runs the ladders, and rewrites an unsafe change into a safe one.
