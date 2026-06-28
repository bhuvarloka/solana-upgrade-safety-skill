// Step 2 — generate the fix. Turn a classification result into artifacts: the
// human-readable report and release checklist (always), plus migration.rs / migration.ts
// and a regression test when the upgrade actually needs a migration.

import type { Idl, IdlField, IdlType } from "./layout.ts";
import type { Change, DiffResult, Verdict } from "./diff.ts";

export type Artifacts = Record<string, string>;

const VERDICT_LINE: Record<Verdict, string> = {
  SAFE: "✅ in-place upgrade is safe — all changes are storage-safe.",
  MIGRATE: "❌ in-place upgrade will corrupt data — migrate, or ship a new program ID.",
  COORDINATE: "⚠️ data is safe, but existing clients break — coordinate a release.",
  REFUSE: "🚫 not analyzable — see the serialization-model gate; needs manual review.",
};

export function generateArtifacts(before: Idl, after: Idl, result: DiffResult): Artifacts {
  const out: Artifacts = {
    "report.md": report(result),
    "release-checklist.md": checklist(result.verdict),
  };

  // Only emit migration code when stored-account data is at risk.
  if (result.verdict === "MIGRATE") {
    const account = migratedAccount(result);
    if (account) {
      out["migration.rs"] = migrationRs(account, before, after);
      out["migration.ts"] = migrationTs(account);
      out["regression.test.ts"] = regressionTest(account, before, after);
    }
  }
  return out;
}

function report(result: DiffResult): string {
  const rows =
    result.changes.length === 0
      ? "| _none_ | | | |"
      : result.changes
          .map((c) => `| ${c.category} | ${c.rung} | ${locus(c)} | ${c.reason} |`)
          .join("\n");
  return `# Upgrade compatibility report

**Verdict: ${result.verdict}** — ${VERDICT_LINE[result.verdict]}

| Category | Rung | Where | Why |
|---|---|---|---|
${rows}
`;
}

function locus(c: Change): string {
  if (c.account) return c.field ? `${c.account}.${c.field}` : c.account;
  if (c.instruction) return c.arg ? `${c.instruction}(${c.arg})` : c.instruction;
  if (c.error) return `error ${c.error}`;
  return "";
}

function checklist(verdict: Verdict): string {
  const migrate = verdict === "MIGRATE";
  return `# Release checklist

- [ ] Review the compatibility report above.
- [ ] Deploy the new program to **devnet**.
${migrate ? "- [ ] Run the generated migration against a copy of real accounts on devnet.\n" : ""}- [ ] Run the regression test / integration suite against devnet.
- [ ] Verify a sample of existing accounts decode correctly post-upgrade.
${migrate ? "- [ ] Confirm every affected account type has been migrated before mainnet.\n" : ""}- [ ] Promote to **mainnet** only after devnet verification passes.
${verdict === "COORDINATE" ? "- [ ] Notify client/SDK consumers of the breaking change and ship updated clients.\n" : ""}`;
}

function migratedAccount(result: DiffResult): string | undefined {
  const c = result.changes.find(
    (x) => x.account && (x.category === "MIGRATION-REQUIRED" || x.category === "UNSAFE"),
  );
  return c?.account ?? undefined;
}

// --- Rust type mapping (subset; unknown types pass through as the IDL label) ---
function rustType(t: IdlType): string {
  if (typeof t === "string") {
    const map: Record<string, string> = {
      bool: "bool",
      u8: "u8",
      i8: "i8",
      u16: "u16",
      i16: "i16",
      u32: "u32",
      i32: "i32",
      u64: "u64",
      i64: "i64",
      u128: "u128",
      i128: "i128",
      pubkey: "Pubkey",
      publicKey: "Pubkey",
      string: "String",
      bytes: "Vec<u8>",
    };
    return map[t] ?? t;
  }
  if ("option" in t) return `Option<${rustType(t.option)}>`;
  if ("vec" in t) return `Vec<${rustType(t.vec)}>`;
  if ("array" in t) return `[${rustType(t.array[0])}; ${t.array[1]}]`;
  if ("defined" in t) return typeof t.defined === "string" ? t.defined : t.defined.name;
  return "/* unknown */ ()";
}

function fieldsOf(idl: Idl, account: string): IdlField[] {
  const def = idl.types?.find((d) => d.name === account);
  return def && def.type.kind === "struct" ? def.type.fields ?? [] : [];
}

function rustStruct(name: string, fields: IdlField[]): string {
  const body = fields.map((f) => `    pub ${f.name}: ${rustType(f.type)},`).join("\n");
  // Bare Borsh derives — NOT #[account] — so these helpers don't add/check their own
  // discriminator. The on-chain account keeps the original program's discriminator,
  // which we preserve manually in `migrate`.
  return `#[derive(AnchorSerialize, AnchorDeserialize, Default)]\npub struct ${name} {\n${body}\n}`;
}

function migrationRs(account: string, before: Idl, after: Idl): string {
  const v1 = rustStruct(`${account}V1`, fieldsOf(before, account));
  const v2 = rustStruct(`${account}V2`, fieldsOf(after, account));
  return `// Generated migration scaffold for \`${account}\`.
// Review and complete the field copy before running on mainnet.
use anchor_lang::prelude::*;

// Old layout (already on chain).
${v1}

// New layout (target).
${v2}

#[derive(Accounts)]
pub struct Migrate<'info> {
    // No compile-time realloc: with variable-length fields (String/Vec) the final size
    // isn't known until serialization. We realloc by hand in migrate() from the actual
    // Borsh length. realloc::zero is irrelevant here for the same reason.
    #[account(mut)]
    /// CHECK: deserialized manually as ${account}V1, rewritten as ${account}V2.
    pub account: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn migrate(ctx: Context<Migrate>) -> Result<()> {
    let info = &ctx.accounts.account;

    // Preserve the original 8-byte Anchor discriminator; the main program still reads
    // this account as \`${account}\`, so the discriminator must not change.
    let disc: [u8; 8] = info.try_borrow_data()?[..8].try_into().unwrap();
    let old = ${account}V1::deserialize(&mut &info.try_borrow_data()?[8..])?;

    // TODO: map every old field into the new layout. Defaults are placeholders.
    let new = ${account}V2 {
        // ..copy matching fields from \`old\`, set new/changed fields explicitly..
        ..Default::default()
    };

    // Size from the actual serialized bytes (Borsh has no padding), then resize +
    // top up rent before writing.
    let body = new.try_to_vec()?;
    let needed = 8 + body.len();
    if needed != info.data_len() {
        let rent = Rent::get()?;
        let min = rent.minimum_balance(needed);
        let cur = info.lamports();
        if min > cur {
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: info.to_account_info(),
                    },
                ),
                min - cur,
            )?;
        }
        info.realloc(needed, false)?;
    }

    let mut data = info.try_borrow_mut_data()?;
    data[..8].copy_from_slice(&disc);
    data[8..needed].copy_from_slice(&body);
    let _ = old;
    Ok(())
}
`;
}

function migrationTs(account: string): string {
  return `// Generated client-side migration call for \`${account}\`.
// Targets @solana/kit; wire in your program client and signer.
import { type Address, type TransactionSigner } from "@solana/kit";

export async function migrate${account}(params: {
  account: Address;
  payer: TransactionSigner;
  // ..program client / rpc..
}): Promise<void> {
  // TODO: build and send the \`migrate\` instruction for ${account}.
  // 1. fetch the account at the V1 layout
  // 2. call the program's migrate instruction (reallocs + rewrites as V2)
  // 3. confirm and re-fetch at the V2 layout to verify
  throw new Error("migrate${account}: fill in the program client call");
}
`;
}

// --- regression test (write old → migrate → assert new reads) ---
function regressionTest(account: string, before: Idl, after: Idl): string {
  return `// Generated regression test for the \`${account}\` migration.
// Proves an account written at the OLD layout reads correctly after migration.
import { describe, it, expect } from "vitest";
import anchor from "@coral-xyz/anchor";

const { BorshAccountsCoder } = anchor;

const OLD_IDL = ${JSON.stringify(minimalIdl(before, account), null, 2)} as const;
const NEW_IDL = ${JSON.stringify(minimalIdl(after, account), null, 2)} as const;

describe("${account} migration", () => {
  it("an account written at the old layout reads correctly after migration", async () => {
    const oldCoder = new BorshAccountsCoder(OLD_IDL as never);
    const newCoder = new BorshAccountsCoder(NEW_IDL as never);

    // 1. write a value at the OLD layout
    const value = { /* TODO: fill realistic field values */ };
    const oldBytes = await oldCoder.encode("${account}", value);

    // 2. apply the migration (run your on-chain migrate, or transform bytes here)
    const migrated = oldBytes; // TODO: replace with post-migration account bytes

    // 3. assert the NEW layout decodes the migrated account without corruption
    const decoded = newCoder.decodeUnchecked("${account}", migrated);
    expect(decoded).toBeDefined();
    // TODO: assert each field equals the expected migrated value
  });
});
`;
}

// Trim an IDL down to a single account for the generated test fixture.
function minimalIdl(idl: Idl, account: string): Idl {
  return {
    metadata: idl.metadata,
    instructions: [],
    accounts: idl.accounts?.filter((a) => a.name === account),
    // Keep the full type table: the account's fields may reference other defined
    // types, which BorshAccountsCoder must resolve.
    types: idl.types,
  } as Idl;
}
