# Propose mode — evaluate a change before it lands

The other input mode. Claude is usually asked *before* the edit exists: "I'm about to add this field / change this type to my account — is that safe?" There is no `after.json` yet, so synthesize one and run the same ladders.

## Flow

1. **Start from the current IDL** (`before.json`, a git ref, or `anchor idl fetch`).
2. **Apply the proposed change to a copy** to produce the hypothetical `after`. Examples:
   - "add a `bump: u8` field to `Vault`" → append it to the struct.
   - "change `balance` from `u64` to `u128`" → retype it in place.
   - "insert `authority` before `balance`" → insert it.
3. **Run [LADDER 0](detect-model.md) then [LADDER 1](classify.md)** on `before` vs the synthesized `after`.
4. **If the verdict is MIGRATE or COORDINATE, rewrite the change into a safe one** and explain the trade-off:
   - field added in the middle → **move it to the end** (append is storage-safe).
   - type widened in place → **add a new field** instead of changing the old one, or **version the struct** (`V1`→`V2`) and migrate.
   - field removed → keep it (mark deprecated) or migrate.
5. **If SAFE**, say so plainly and confirm it's append-only.

This is what turns the skill from a linter into an assistant: it doesn't just flag the unsafe edit, it proposes the safe implementation.

## Safe-by-construction rules to suggest

- **Append-only.** New fields go at the end of the struct, never inserted or reordered.
- **Never retype in place.** Add a new field; migrate if the old one must change meaning.
- **Version the struct** when a real layout change is unavoidable, and ship the migration from [generate-migration.md](generate-migration.md).
- **Discriminator / account name is forever.** Changing it orphans every existing account.
