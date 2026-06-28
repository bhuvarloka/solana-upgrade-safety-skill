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

**2. Report in chat** (see below). Stop here unless the developer wants the migration.

**3. Generate (only when asked).** Re-run with `--out <dir>`, where `<dir>` is an **absolute path inside the developer's project** (e.g. `<cwd>/migration`), not a bare relative name — the engine runs from its own directory, so a relative `--out` lands in the wrong place. Then **open the generated `migration.rs` with your file/Read tool** so it's visible in the editor; don't rely on the file tree refreshing. Tell the developer the absolute path you wrote to. See [generate-migration.md](generate-migration.md).

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
- End with a low-key offer of the scaffold as a fallback: `I can write the migration scaffold to a folder if you want it.` Don't push it. Stop there.
- Never paste `report.md`, never recite the checklist or rollout steps, never list generated files, never explain byte offsets or open `migration.rs` unless asked. No preamble ("I'll analyze…"), no recap of what you ran.

Output ceiling: verdict + the breaking changes + one fix line + the offer. ~8 lines max. More than that is touring.

## Command

- [check-upgrade](../commands/check-upgrade.md)
