# Agent instructions

This repo ships an account-corruption checker for Anchor program upgrades. Read by any
agent that honors `AGENTS.md` (Codex, Cursor, Gemini CLI, Zed, and others).

## Before approving or committing an Anchor IDL change

A Solana account is a fixed byte layout. Reordering, inserting, removing, or widening a
field in an account struct silently corrupts already-deployed accounts — it still compiles
and tests still pass. Do not eyeball this. Run the checker — no install needed:

```bash
npx github:bhuvarloka/solana-upgrade-safety-skill <old-idl.json> <new-idl.json>
```

Get the old IDL from the last release (e.g. `git show <tag>:path/to/idl.json > /tmp/old.json`)
and compare it to the new one in the working tree. Inside this repo you can instead run
`./check-upgrade.sh path/to/idl.json`, which diffs the working tree against the latest git tag.

Exit codes — the entire contract:

- `0` — safe to upgrade in place. Proceed.
- `1` — **MIGRATE**: this corrupts deployed accounts. Stop. Do not ship without a migration
  or a new program ID. Add `--out ./out` to the same command to generate the migration
  scaffolding (`migration.rs`, `migration.ts`, regression test, report).
- `2` — bad input or internal error, **not** a verdict. Fix the IDL/paths; never treat as corruption.

First commit of an IDL (nothing to compare against) exits `0` — there's nothing to corrupt yet.

## Notes

- The engine in `engine/` is a standalone Node CLI; it does not require any specific agent.
- Manual or zero-copy serialization can't be verified from the IDL — the tool says so and
  refuses rather than guessing. Trust that refusal.
