---
description: Analyze an Anchor IDL upgrade for account-layout compatibility and generate the migration.
---

# /check-upgrade

Run the upgrade-safety analysis on a pair of Anchor IDLs (or a proposed change) and emit the migration artifacts.

## Usage

```
pnpm -C <skill-dir>/engine run check-upgrade <before.json> <after.json> --out <dir> [--assume <model>]
```

`<skill-dir>` is the installed skill directory (e.g. `~/.claude/skills/upgrade-safety`). Use absolute paths for the IDLs and `--out` so it runs from any working directory.

- `<before.json>` — the currently-deployed IDL (or `anchor idl fetch <program-id>`).
- `<after.json>` — the new/proposed IDL.
- `--out <dir>` — where to write artifacts (default: current dir).
- `--assume <model>` — force the serialization model: `anchor-borsh` | `zero-copy` | `manual`. Skips detection.

## What it does

1. **Gate** — detect the serialization model ([detect-model.md](../skill/detect-model.md)). Refuses confidently on manual/unknown layouts.
2. **Classify** — walk the five compatibility categories ([classify.md](../skill/classify.md)) and roll up to SAFE / MIGRATE / COORDINATE / REFUSE.
3. **Generate** — write `report.md` + `release-checklist.md` always; add `migration.rs`, `migration.ts`, and `regression.test.ts` when the verdict is MIGRATE ([generate-migration.md](../skill/generate-migration.md)).

## Exit codes

- `0` — SAFE, COORDINATE, or REFUSE.
- `1` — MIGRATE (an in-place upgrade would corrupt data). Use this to gate a PR in CI.

## Proposed-change mode

No `after.json` yet? Describe the edit ("add a `bump` field to `Vault`", "change `balance` to u128") and the skill synthesizes the `after` IDL, runs the ladders, and rewrites an unsafe change into a safe one. See [propose-mode.md](../skill/propose-mode.md).
