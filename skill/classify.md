# LADDER 1 — Classify compatibility

Runs only when [LADDER 0](detect-model.md) returned an analyzable model. Walk top to bottom per change, **stop at the first rung that matches**. Mirrors `engine/src/diff.ts`; keep them identical.

```
Per field, per analyzable account struct — stop at the first match:

  R6  Discriminator / account name changed        → UNSAFE
        existing accounts become unfindable
  R5  Field removed / struct shrunk               → MIGRATION-REQUIRED
        old data misreads
  R3  Field moved to a different position          → MIGRATION-REQUIRED
        offsets shift
  R4  Same position, type changed (u64→u128, …)    → MIGRATION-REQUIRED
        size / layout change
  R1  New field appended at the very end           → STORAGE-SAFE
        (a field inserted in the MIDDLE is R3 — it shifts every following offset)
  R2  Existing field: same name, type, position    → STORAGE-SAFE (unchanged; not reported)

Across the whole IDL:

  R7  Instruction args added / reordered / retyped / removed   → CLIENT-BREAKING
        old clients fail; not account corruption
  R8  Error enum variants reordered / removed                  → ABI-BREAKING
        error codes shift
```

**Reorder detection.** A removal or mid-insertion shifts every following field, but that cascade is *one* root cause, not many breakages. The engine reports the structural cause once (R5 removal / R3 insertion) and flags a field as a genuine reorder only when its **rank among surviving fields** changed — so a `bump`↔`index` swap flags both, while "remove field 3, everything after shifts" reports just the removal. The same rank rule applies to error variants (R8).

## Roll-up verdict (highest severity wins)

```
  any MIGRATION-REQUIRED or UNSAFE on stored accounts
        → MIGRATE      "in-place upgrade will corrupt data; migrate or ship a new program ID"
  only CLIENT-BREAKING / ABI-BREAKING
        → COORDINATE   "data is safe; existing clients break — coordinate a release"
  all STORAGE-SAFE
        → SAFE         "in-place upgrade is safe"
  model refused at LADDER 0
        → REFUSE       "not analyzable — see the gate; needs manual review"
```

The verdict is provable in bytes — see `engine/test/roundtrip.test.ts`. When MIGRATE → [generate-migration.md](generate-migration.md).
