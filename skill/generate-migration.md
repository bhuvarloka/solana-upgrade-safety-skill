# Step 2 — Generate the fix

Driven by the [classify.md](classify.md) result, emitted by `engine/src/codegen.ts`.

## What gets emitted

Always:
- **`report.md`** — the verdict + the classification table (category · rung · where · why).

When the verdict is **not SAFE** (there's release work to do):
- **`release-checklist.md`** — devnet → run migration → verify a sample decodes → mainnet. SAFE emits no checklist.

Only when the verdict is **MIGRATE** (stored-account data is at risk):
- **`migration.rs`** — a versioned struct pair (`AccountV1` → `AccountV2`) plus a `realloc`-based `migrate` instruction scaffold. The field copy is left as a `TODO` with placeholders — review before mainnet.
- **`migration.ts`** — the client-side migration call (targets `@solana/kit`).
- **`regression.test.ts`** — writes an account at the OLD layout, applies the migration, asserts the NEW layout decodes it without corruption (via `BorshAccountsCoder`).

A COORDINATE or REFUSE verdict emits the report and checklist (no migration code). A SAFE verdict emits only the report.

## Run it

```
pnpm -C <skill-dir>/engine run check-upgrade <before.json> <after.json> --out <dir> [--assume <model>]
```

`--out` writes the artifacts to `<dir>`; omit it for verdict-only. Exit code **1 on MIGRATE** (so CI can gate on it), **0** otherwise. See a worked example in [examples/](../examples/).

## Finish the scaffold

The generated `migrate` fn and regression test carry `TODO`s on purpose — the tool can't know intended values for new or changed fields. Fill in:
1. the field-by-field copy from `V1` to `V2` (matching fields copy across; new/changed fields set explicitly),
2. realistic field values in the regression test,
3. a per-field assertion that the migrated account reads back correctly.
