# Golden set

The benchmark scores against the fixture pairs in [`../../fixtures/pairs/`](../../fixtures/pairs/) —
each carries an `expected.json` with the ground-truth verdict. They are the oracle for
the unit tests too, so there is one source of truth, not a divergent copy.

To add a case: add a pair under `fixtures/pairs/<name>/` with `before.json`,
`after.json`, and `expected.json`. `benchmark/run.ts` picks it up automatically.
