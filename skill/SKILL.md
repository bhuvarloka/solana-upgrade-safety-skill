---
name: upgrade-safety
description: Tells you whether an Anchor program upgrade will corrupt already-deployed on-chain accounts. Compares two IDL versions (or evaluates a proposed change before it lands) and returns a verdict; generates the migration (migration.rs, migration.ts, regression test, report, checklist) only when asked. Use when the user asks "is this Anchor upgrade safe", "will this corrupt accounts", "can I add/remove/reorder/retype a field in this account", "diff these IDLs", "account layout compatibility", "schema/account migration", "Borsh layout change", or mentions versioning an Anchor account struct before deploying.
user-invocable: true
---

# upgrade-safety

> don't brick the mainnet

Solana keeps account data as raw Borsh bytes in a fixed field order, and deployed accounts keep those bytes forever. Reorder or insert a field mid-struct and the new code reads old bytes at the wrong offsets — silently corrupting stored values. Rust compiles it; Anchor doesn't flag it. This skill catches it and generates the fix.

> **Extends** `solana-dev` (Anchor/Borsh/IDL basics): https://github.com/solanabr/solana-dev-skill

## When to use this

- "Is it safe to add / change / remove / reorder a field in this account?"
- "Diff these two IDL versions — does an in-place upgrade corrupt accounts?"
- "Generate the migration for this layout change."
- Gating a PR that touches an Anchor account struct.

## Procedure

Run the bundled engine — it's the source of truth. Never hand-classify.

**Never pass `--out` until the developer asks for the migration.** A question ("is it safe?", "diff these") is answered from the verdict alone — writing files they didn't request is the #1 way this skill annoys people.

**1. Diagnose (no files).** Run without `--out` to get just the verdict:

```
pnpm -C <skill-dir>/engine run check-upgrade <before.json> <after.json> [--assume <model>]
```

`<skill-dir>` is this file's directory (e.g. `~/.claude/skills/upgrade-safety`); use absolute paths for the IDLs. Exit code: **1 = MIGRATE** (CI-gateable), **0** = SAFE/COORDINATE/REFUSE, **2** = bad input (report the error, not a verdict).

**2. Report in chat** (see below), ending by asking what they want done. Stop and wait.

**3a. "Rewrite it safe"** → don't generate migration files. Propose the safe edit (see [propose-mode.md](propose-mode.md): keep the type, append instead of insert, version the struct) and, if they want, apply it to their source. No migration needed when the change itself becomes storage-safe.

**3b. "Write the migration"** → re-run with `--json` (not `--out`) to get the artifacts on stdout:

```
pnpm -C <skill-dir>/engine run check-upgrade <before.json> <after.json> --json
```

It prints one JSON line, `{ "verdict": ..., "artifacts": { "migration.rs": "...", ... } }`, and writes nothing. (`pnpm run` adds a `$ tsx …` banner line first — parse the line that starts with `{`.) **You** then write each artifact with your Write tool into the developer's project (e.g. `<cwd>/migration/migration.rs`). See [generate-migration.md](generate-migration.md).

**End by printing the absolute path to the folder you wrote**, as a clickable link (e.g. `/Users/.../project/migration/`) — not a relative `migration/`. A skill writes to disk; it cannot repaint the editor's file tree (only the editor can), so the developer may not see a new folder appear. A clickable absolute path lets them open it in one click without hunting or refreshing. Never claim files "appear immediately" — they're on disk, but the sidebar repaint is the editor's job, not yours.

(CI uses `--out <dir>` to write directly; that path is for pipelines, not the chat flow.)

No `after` yet? See [propose-mode.md](propose-mode.md): synthesize it from the proposed edit, run the ladders, rewrite an unsafe change into a safe one.

The ladders are [detect-model.md](detect-model.md) (the serialization-model gate — refuse manual/unknown) and [classify.md](classify.md) (five categories → SAFE / MIGRATE / COORDINATE / REFUSE). They mirror `engine/src/detect-model.ts` and `engine/src/diff.ts`; change one, change both.

**No pnpm?** It's only needed to install. Once `engine/node_modules` exists, run the engine with npx instead — same args:

```
cd <skill-dir>/engine && npx tsx src/cli.ts <before.json> <after.json> [--out <dir>] [--assume <model>]
```

If `engine/node_modules` is missing, install deps once (`pnpm install`, or `npm install` if pnpm is unavailable) in `<skill-dir>/engine`. If the engine is absent, tell the user to reinstall and stop.

## Reporting

Terse. The developer wants the answer, not a write-up. Hard rules:

- **SAFE** → exactly one line: `✅ Safe — in-place upgrade won't corrupt accounts.` Nothing else.
- **Otherwise** → the verdict line, then **one bullet per breaking change** (`Account.field: u32→u64 — corrupts every existing account`). Cap at 5 bullets; if more, show the worst 5 and `…and N more`.
- Then **the fix, in one line** — the safe alternative or the migration path (`Fix: keep trade_fee_rate as u32, or version the struct and migrate existing accounts.`). This is the deliverable; the developer can act on it without any files.
- End by **asking what they want done**, not by announcing files or a path: `Want me to make this upgrade safe — rewrite the change so it can't corrupt anything, or write the migration files to fix it the hard way?` Wait for their answer. Only when they say yes do you generate (step 3); only then do files exist or get mentioned.
- Never paste `report.md`, never recite the checklist or rollout steps, never list generated files, never explain byte offsets or open `migration.rs` unless asked. No preamble ("I'll analyze…"), no recap of what you ran.

Output ceiling: verdict + the breaking changes + one fix line + the offer. ~8 lines max. More than that is touring.

## Command

- [check-upgrade](../commands/check-upgrade.md)
