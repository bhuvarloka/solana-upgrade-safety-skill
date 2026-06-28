# Step 2 — Generate the fix

The pivot from reviewer to engineer. A reviewer tells you something breaks; this hands you the migration, the safety net, and the release ritual. Driven by the classification result from [classify.md](classify.md) and emitted by `engine/src/codegen.ts`.

## What gets emitted

Always:
- **`report.md`** — the verdict + the classification table (category · rung · where · why).
- **`release-checklist.md`** — deploy to devnet → run migration → verify a sample of real accounts decode → promote to mainnet. An automated version of the manual ritual teams already follow.

Only when the verdict is **MIGRATE** (stored-account data is at risk):
- **`migration.rs`** — a versioned struct pair (`AccountV1` → `AccountV2`) plus a `realloc`-based `migrate` instruction scaffold. The field copy is left as a `TODO` with placeholders — review before mainnet.
- **`migration.ts`** — the client-side migration call (targets `@solana/kit`).
- **`regression.test.ts`** — writes an account at the OLD layout, applies the migration, asserts the NEW layout decodes it without corruption (via `BorshAccountsCoder`).

A SAFE, COORDINATE, or REFUSE verdict emits only the report and checklist — there is nothing to migrate, so no migration code is generated.

## Run it

```
pnpm run check-upgrade <before.json> <after.json> --out <dir> [--assume <model>]
```

Writes the artifacts to `<dir>`. Exit code **1 on MIGRATE** (so CI can gate on it), **0** otherwise. See a worked example in [examples/](../examples/).

## Finish the scaffold

The generated `migrate` fn and regression test carry `TODO`s on purpose — the tool can't know intended values for new or changed fields. Fill in:
1. the field-by-field copy from `V1` to `V2` (matching fields copy across; new/changed fields set explicitly),
2. realistic field values in the regression test,
3. a per-field assertion that the migrated account reads back correctly.
