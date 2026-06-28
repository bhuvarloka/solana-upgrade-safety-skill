---
name: upgrade-safety
description: Analyzes whether an Anchor program upgrade will corrupt already-deployed on-chain accounts, then generates the migration. Compares two IDL versions (or evaluates a proposed change before it lands), classifies each change into five compatibility categories behind a serialization-model gate, and emits migration.rs, migration.ts, a regression test, a compatibility report, and a release checklist. Use when the user asks "is this Anchor upgrade safe", "will this corrupt accounts", "can I add/remove/reorder/retype a field in this account", "diff these IDLs", "account layout compatibility", "schema/account migration", "Borsh layout change", or mentions versioning an Anchor account struct before deploying.
user-invocable: true
---

# upgrade-safety-skill

> don't brick the mainnet

> **Extends**: `solana-dev` skill — Core Solana development (Anchor, Borsh, IDL, testing). Borsh/Anchor/IDL basics live there; this skill assumes them. Install it from https://github.com/solanabr/solana-dev-skill (the kit vendors it under `.claude/skills/ext/solana-dev`).

Solana stores account data as raw Borsh bytes in a fixed field order, and existing on-chain accounts keep those bytes forever. During a refactor it is easy to reorder a field or insert one mid-struct without realizing the new code now reads old bytes at the wrong offsets — corrupting stored values. Rust compiles it; Anchor does not flag it. This skill compares two program versions, says precisely what breaks and how badly, and generates the migration and the safety net.

The honest scope: neither Rust nor Anchor automatically warns that an account-layout change is incompatible with already-deployed data. Anchor ships migration *primitives* (`Migration`, `realloc`, `idl fetch-historical`) but no workflow that *detects* an incompatible change for you. That gap is this skill.

## When to use this

- "I'm about to add / change / remove a field in this account — is it safe?" (propose mode)
- "Diff these two IDL versions and tell me if an in-place upgrade corrupts accounts."
- "Generate the migration for this account-layout change."
- Gating a PR that touches an Anchor account struct.

## Operating procedure (the Ladder)

Walk these in order. Each is a deterministic decision ladder — ordered conditions, stop at the first match — so the same input always yields the same verdict.

1. **Gate first — [detect-model.md](detect-model.md) (LADDER 0).** Detect the serialization model. Only standard Anchor Borsh is fully analyzable; zero-copy is analyzed *with a caveat*; manual/unknown is **refused confidently**. Never analyze past a refusal.
2. **Classify — [classify.md](classify.md) (LADDER 1).** Walk each field, then the whole IDL, into five categories (STORAGE-SAFE, MIGRATION-REQUIRED, UNSAFE, CLIENT-BREAKING, ABI-BREAKING) and roll up to SAFE / MIGRATE / COORDINATE / REFUSE.
3. **Generate — [generate-migration.md](generate-migration.md) (Step 2).** Emit the report and checklist always; emit migration.rs / migration.ts / regression test when the verdict is MIGRATE.
4. **Proposed change? — [propose-mode.md](propose-mode.md).** When there is no `after` yet, synthesize it from the proposed edit, run the ladders, and rewrite an unsafe change into a safe one.

## The engine

Diagnosis and generation are mechanical, not vibes — they run in TypeScript under `engine/`, and the round-trip proof uses `@coral-xyz/anchor`'s `BorshAccountsCoder` to prove the verdict in real bytes. The ladders above are identical to `engine/src/detect-model.ts` and `engine/src/diff.ts`; if you change one, change both.

```
pnpm run check-upgrade <before.json> <after.json> --out <dir> [--assume <model>]
```

Exit 1 on MIGRATE (CI-gateable), 0 otherwise.

## Command

- [check-upgrade](../commands/check-upgrade.md) — run the full analysis on an IDL pair and emit artifacts.
