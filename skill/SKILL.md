---
name: upgrade-safety
description: Tells you whether an Anchor program upgrade will corrupt already-deployed on-chain accounts. Compares two IDL versions (or evaluates a proposed change before it lands) and returns a verdict; generates the migration (migration.rs, migration.ts, regression test, report, checklist) only when asked. Use when the user asks "is this Anchor upgrade safe", "will this corrupt accounts", "can I add/remove/reorder/retype a field in this account", "diff these IDLs", "account layout compatibility", "schema/account migration", "Borsh layout change", or mentions versioning an Anchor account struct before deploying.
user-invocable: true
---

# upgrade-safety

> don't brick the mainnet

Solana keeps account data as raw Borsh bytes in a fixed field order, and deployed accounts keep those bytes forever. Reorder or insert a field mid-struct and the new code reads old bytes at the wrong offsets — silently corrupting stored values. Rust compiles it; Anchor doesn't flag it. This skill catches it and generates the fix.

> **Extends** `solana-dev` (Anchor/Borsh/IDL basics): https://github.com/solanabr/solana-dev-skill

## Procedure

Run the bundled engine — it's the source of truth. Never hand-classify. Do not pass `--out` unless the developer explicitly asks to generate the migration.

`<skill-dir>` is this file's directory (e.g. `~/.claude/skills/upgrade-safety`); use absolute paths for the IDLs. Exit code: **1 = MIGRATE** (CI-gateable), **0** = SAFE/COORDINATE/REFUSE, **2** = bad input (report the error, not a verdict).

**1. Diagnose (no files).** Run the engine with `--json`:

```
pnpm -C <skill-dir>/engine run check-upgrade <before.json> <after.json> --json [--assume <model>]
```

It prints a single JSON line — `{ "verdict": ..., "artifacts": { "report.md": "..." } }` — and writes nothing. Parse it for the verdict and pull the breaking-change bullets from `artifacts["report.md"]`.

No `after.json`? Synthesize the hypothetical IDL from the developer's described edit, save it to a temp file in the workspace, and run the command against it.

No pnpm? Once `engine/node_modules` exists, run `cd <skill-dir>/engine && npx tsx src/cli.ts <before.json> <after.json> --json [--assume <model>]`. If `node_modules` is missing, install once with `pnpm install` (or `npm install`). If the engine is absent, tell the user to reinstall and stop.

**2. Report in chat** (see below), ending by asking what they want done. Stop and wait.

**3a. "Rewrite it safe"** → don't generate migration files. Propose the storage-safe edit: keep the type, append instead of insert, version the struct. Apply it to their source if they want.

**3b. "Write the migration"** → re-run with `--json` to get `{ "verdict": ..., "artifacts": { "migration.rs": "...", ... } }` on stdout. (`pnpm run` adds a `$ tsx …` banner first — parse the line starting with `{`.) Write each artifact to the developer's project with your file-writing tool (e.g. `<cwd>/migration/migration.rs`) — actually execute the write, don't just print the contents. The generated code and tests contain `TODO` placeholders for new/changed fields the developer must fill in; tell them. End by printing the absolute path to the folder as a clickable link.

## Reporting

Terse. The developer wants the answer, not a write-up. Hard rules:

- **SAFE** → exactly one line: `✅ Safe — in-place upgrade won't corrupt accounts.` Nothing else.
- **Otherwise** → the verdict line, then **one bullet per breaking change** (`Account.field: u32→u64 — corrupts every existing account`). Cap at 5; if more, show the worst 5 and `…and N more`.
- Then **the fix, in one line** — the safe alternative or the migration path (`Fix: keep trade_fee_rate as u32, or version the struct and migrate existing accounts.`).
- End by **asking what they want done**: `Want me to make this upgrade safe — rewrite the change so it can't corrupt anything, or write the migration files to fix it?` Wait for their answer.
- Never paste `report.md`, recite the checklist, list generated files, or explain byte offsets unless asked. No preamble, no recap of what you ran.

Output ceiling: verdict + breaking changes + one fix line + the offer. ~8 lines max.

## Command

- [check-upgrade](../commands/check-upgrade.md)
