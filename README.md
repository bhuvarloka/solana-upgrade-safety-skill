# upgrade-safety-skill

> don't brick the mainnet

You change a struct.

Not a big change. Just cleaning things up.

```rust
pub struct Account {
    pub owner: Pubkey,
    pub bump: u8,
    pub balance: u64,
}
```

Rust compiles. Tests pass. Anchor smiles politely.

You deploy.

A few minutes later, someone opens their wallet and discovers their balance is now `255`, because your program is reading yesterday's bytes using today's struct layout.

Welcome to Solana upgrades.

The chain never forgot the old layout. Your program did.

---

This tool exists because "looks harmless" and "silently corrupts user accounts" have often the same origin.

Give it two Anchor IDLs:

```bash
before.json
after.json
```

It will tell you:

- whether the upgrade is safe,
- exactly what broke,
- why it broke,
- and, if needed, generate the migration scaffolding before you learn about it from Twitter.

Because "we just reordered some fields" has probably destroyed more Solana accounts than most attackers.

## Why this happens

Solana keeps your account as a row of bytes, in field order, forever. The program that wrote them is gone after an upgrade. The bytes stay.

```
Old struct        You insert a field        Old bytes, read new way
  owner             owner                      owner          ✓
  balance           authority  ← new           authority      ← used to be balance
                    balance                    balance        ← leftover junk
```

Move a field, widen a `u64`, delete one — same story. Anchor ships tools to migrate _on purpose_ (`realloc`, `Migration`). Nothing tells you that you broke something _by accident_. That's the gap.

## What it does

One command. Two IDLs in, a verdict and the migration out.

```bash
cd engine && pnpm run check-upgrade before.json after.json --json
# exit 1 = this corrupts data. wire it into CI and sleep.
# add --out ./out to write the migration files instead of just the verdict.
```

Real output, on a moved field in Raydium's `AmmConfig`:

```
verdict: MIGRATE
```

The per-field breakdown rides along in the JSON (or lands in `./out/report.md` with `--out`):

```
| MIGRATION-REQUIRED | AmmConfig.bump  | moved (0 → 1) — offsets shift |
| MIGRATION-REQUIRED | AmmConfig.index | moved (1 → 0) — offsets shift |
```

## The Ladder

The whole skill is one trick: assume you're safe, then keep looking for reasons you're not. Stop at the first one it finds, and fix it.

```text
For every account change:

1. Did you only append a field at the very end?
   → yes: mark SAFE and stop.
     Old accounts still line up. Nobody notices. Go home.

2. Did an existing field move?
   → yes: require a migration and stop.
     Congratulations: someone's balance is now their bump seed.

3. Did a field change size (u64 → u128, etc.)?
   → yes: require a migration and stop.
     Every field after it just became interpretive art.

4. Did you remove a field?
   → yes: require a migration and stop.
     The bytes are still there. They just belong to nobody now.

5. Did the account name or discriminator change?
   → yes: mark UNSAFE and stop.
     Your program no longer recognizes its own children.

6. None of the above?
   → mark SAFE.
```

Then check everything around the account:

```text
instruction arguments changed?
→ mark COORDINATE.
  User funds survive. Your clients don't.

error variants reordered?
→ mark COORDINATE.
  Nothing broke, except everyone's debugging session.
```

Roll everything up to one word:

```text
SAFE         ship it
MIGRATE      write a migration
COORDINATE   warn the humans
REFUSE       absolutely not
```

The same bytes always produce the same answer. The code in [`engine/`](engine/) _is_ this list — no gap between the docs and what runs.

## Does it actually work

A verdict is just talk until the bytes agree. So the test does the cruel thing: writes an account the old way, reads it the new way, checks what falls out.

```
✓ appended field   → old data survives, intact
✓ inserted field   → old data comes out wrong
✓ widened u8→u64   → the field after it gets eaten
```

Real `BorshAccountsCoder`, real bytes, no mocks. When it says MIGRATE, the corruption is right there in the assertion.

And the agent-vs-agent score, because the whole point is changing what the AI does:

|                | catches corruption | misses            |
| -------------- | ------------------ | ----------------- |
| with the skill | **5 / 5**          | **0**             |
| a bare agent   | 1 / 5              | **4 silent ones** |

The bare agent only notices when a _type_ visibly changes. The reorder, the deletion, the renamed discriminator — it waves them all through. Those are the ones that hurt. ([full table](benchmark/results.md))

## FAQ

**Does the IDL even know about zero-copy or hand-rolled layouts?**
No, and pretending otherwise is how you get burned. So it checks the model _first_: plain Borsh, full analysis. Zero-copy, analyzed but flagged. Manual serialization, it refuses and says so. "I can't verify this" beats a confident wrong answer.

**Why five categories instead of safe / unsafe?**
Because "your clients need a redeploy" and "your users lost their funds" are not the same Tuesday.

**Will the generated migration just work?**
It's a scaffold with the field copy left to you, on purpose — it won't guess what your new field should hold. The boring part is done; the one decision only you can make is left as a `TODO`.

## Run it (no install)

Straight from GitHub — no clone, no setup. Any agent or shell that can run a command can run this:

```bash
npx github:bhuvarloka/solana-upgrade-safety-skill before.json after.json
# exit 1 = corrupts data, 0 = safe, 2 = bad input
```

First run takes ~15s while it fetches the Anchor dependency; after that it's cached.

## Install (optional)

Prefer it local — for repeated runs, or to diff against your last git tag automatically:

```bash
cd engine && pnpm install            # once
./check-upgrade.sh path/to/idl.json  # working tree vs latest git tag — what the CI gate runs
```

### Claude Code

```bash
./install.sh                     # → ~/.claude/skills/upgrade-safety
./install-custom.sh --project    # → ./.claude (this repo only); or --path <dir>
```

Adds the skill and the `/check-upgrade` command. Also offers the `solana-dev` core skill this one extends.

### Cursor

[`.cursor/rules/upgrade-safety.mdc`](.cursor/rules/upgrade-safety.mdc) is already in the repo — Cursor reads it and stops on a corrupting upgrade. Nothing to install.

### Codex

[`AGENTS.md`](AGENTS.md) is already in the repo — Codex reads it and runs the check before approving an IDL change. Nothing to install.

## Try it

```bash
cd engine
pnpm install
pnpm run test          # 38 tests, including the byte-level proof
pnpm run benchmark     # with-skill vs bare agent
pnpm run check-upgrade ../fixtures/pairs/moved-migration/before.json \
                       ../fixtures/pairs/moved-migration/after.json --out ./out
```

## Where things live

```
skill/      the ladders, in plain Markdown
engine/     the implementation (TypeScript + Vitest)
fixtures/   real IDL pairs with known answers
benchmark/  with-skill vs bare agent, scored
examples/   a real change and the migration it generated
.github/    the CI gate that fails a corrupting PR
```

MIT. Extends [`solana-dev-skill`](skill/SKILL.md).
