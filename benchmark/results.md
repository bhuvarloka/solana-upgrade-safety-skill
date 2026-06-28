# Benchmark results

Golden set: **16** IDL pairs from `fixtures/pairs/`, each with a ground-truth verdict.
Question posed to each arm: _will this upgrade corrupt already-deployed accounts, and how?_

## Arms

- **with-skill** — the deterministic engine (`analyzeUpgrade`): LADDER 0 gate → LADDER 1 classify.
- **baseline** — a bare agent reasoning from "it compiles" instead of the append-only Borsh
  invariant: flags a change only when a field's type visibly changes, missing reorders,
  mid-struct insertions, removals, and discriminator changes. Documented in `run.ts`.

## Summary

| Arm | Accuracy | Precision (corruption) | Recall (corruption) | False positives | False negatives (missed corruption) |
| --- | --- | --- | --- | --- | --- |
| with-skill | 100% (16/16) | 100% | 100% | 0 | 0 |
| baseline | 25% (4/16) | 50% | 20% | 1 | 4 |

> The dangerous metric is **false negatives (missed corruption)** — an upgrade the arm calls
> safe that would in fact corrupt stored accounts. That is the column the skill drives to zero.

## Per-case

| Case | Truth | with-skill | baseline |
| --- | --- | --- | --- |
| account-added-safe | SAFE | SAFE ✓ | SAFE ✓ |
| account-removed-unsafe | MIGRATE | MIGRATE ✓ | SAFE ✗ |
| append-safe | SAFE | SAFE ✓ | SAFE ✓ |
| defined-spec-equiv-safe | SAFE | SAFE ✓ | MIGRATE ✗ |
| discriminator-unsafe | MIGRATE | MIGRATE ✓ | SAFE ✗ |
| error-inserted-abi | COORDINATE | COORDINATE ✓ | SAFE ✗ |
| error-removed-abi | COORDINATE | COORDINATE ✓ | SAFE ✗ |
| error-reordered-abi | COORDINATE | COORDINATE ✓ | SAFE ✗ |
| identical-safe | SAFE | SAFE ✓ | SAFE ✓ |
| ix-arg-added-client | COORDINATE | COORDINATE ✓ | SAFE ✗ |
| ix-arg-removed-client | COORDINATE | COORDINATE ✓ | SAFE ✗ |
| ix-arg-retyped-client | COORDINATE | COORDINATE ✓ | SAFE ✗ |
| ix-removed-client | COORDINATE | COORDINATE ✓ | SAFE ✗ |
| moved-migration | MIGRATE | MIGRATE ✓ | SAFE ✗ |
| removed-migration | MIGRATE | MIGRATE ✓ | SAFE ✗ |
| retyped-migration | MIGRATE | MIGRATE ✓ | MIGRATE ✓ |

## Notes

- with-skill latency: 1.0 ms total over 16 cases (no network; pure local classification).
- Reproduce: `pnpm -C engine run benchmark` (or `tsx benchmark/run.ts` from the repo root).
- The baseline is a deterministic stand-in so the benchmark is reproducible offline. To score
  a live agent instead, replace `baseline()` with a model call; the scorer and table are unchanged.
- Beyond the verdict, with-skill also emits the migration, regression test, and checklist — value
  no bare agent provides regardless of its score.
