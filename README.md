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

You changed your program. This checks whether that change quietly breaks the data already saved for your users.

```bash
cd engine && pnpm run check-upgrade before.json after.json
```

It compares the before and after and tells you whether the saved accounts still line up.

```
verdict: MIGRATE
```

**MIGRATE** means the change scrambles existing accounts. It lists the ones affected so you can sort them out before you ship.

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

A verdict is just talk until you prove it. So the test does the mean thing: it saves an account the old way, opens it the new way, and watches what breaks.

```
✓ appended field   → old data survives, intact
✓ inserted field   → old data comes out wrong
✓ widened u8→u64   → the field after it gets eaten
```

It uses the same machinery your program does, on real data. When it says MIGRATE, the broken bytes are right there in the test.

The same change, run through the AI with the tool and without it:

|                | catches corruption | misses            |
| -------------- | ------------------ | ----------------- |
| with the skill | **5 / 5**          | **0**             |
| a bare agent   | 1 / 5              | **4 silent ones** |

On its own, the AI only catches the obvious changes. The quiet ones — a field moved, a field deleted, something renamed under the hood — go straight past it, and those are the ones that corrupt accounts. ([full table](benchmark/results.md))

## FAQ

**Does this work for every kind of program?**
For the common case it checks everything. For trickier setups it takes a careful look and flags what it can't be sure about. When it can't verify something, it says so rather than guess.

**Why four verdicts instead of just safe or unsafe?**
Because "your app needs an update" and "your users lost their money" are different problems, and you'll want to tell them apart.

**Does the migration it writes just work out of the box?**
Almost. It handles the setup and leaves one blank — where your new field's value comes from. That part depends on your program, so you fill it in.

## Run it

```bash
cd engine && pnpm install            # once
./check-upgrade.sh path/to/idl.json  # working tree vs latest git tag — what the CI gate runs
# exit 1 = corrupts data, 0 = safe, 2 = bad input
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
