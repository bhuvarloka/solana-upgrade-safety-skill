import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { accountLayout } from "../src/layout.ts";
import type { Idl } from "../src/layout.ts";

function fixture(name: string): Idl {
  const path = fileURLToPath(new URL(`../../fixtures/anchor-real/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as Idl;
}

describe("accountLayout", () => {
  // Offsets hand-checked against Raydium AmmConfig (Borsh: positional, little-endian,
  // 8-byte discriminator prefix, no struct padding).
  it("computes Borsh field offsets for AmmConfig (real Raydium IDL)", () => {
    const idl = fixture("raydium-amm-v3.json");
    const layout = accountLayout(idl, "AmmConfig");

    expect(layout.fields).toEqual([
      { name: "bump", type: "u8", offset: 8, size: 1 },
      { name: "index", type: "u16", offset: 9, size: 2 },
      { name: "owner", type: "pubkey", offset: 11, size: 32 },
      { name: "protocol_fee_rate", type: "u32", offset: 43, size: 4 },
      { name: "trade_fee_rate", type: "u32", offset: 47, size: 4 },
      { name: "tick_spacing", type: "u16", offset: 51, size: 2 },
      { name: "fund_fee_rate", type: "u32", offset: 53, size: 4 },
      { name: "padding_u32", type: "u32", offset: 57, size: 4 },
      { name: "fund_owner", type: "pubkey", offset: 61, size: 32 },
      { name: "padding", type: "[u64;3]", offset: 93, size: 24 },
    ]);
    expect(layout.discriminatorLen).toBe(8);
    expect(layout.fixedSize).toBe(117);
  });

  it("stops fixed sizing at the first variable-length field", () => {
    // mpl Metadata: key (enum, 1) → update_authority (pubkey) → mint (pubkey) → name (string, dynamic).
    const idl = fixture("mpl-token-metadata.json");
    const layout = accountLayout(idl, "Metadata");

    expect(layout.fields.slice(0, 3)).toEqual([
      { name: "key", type: "AccountKey", offset: 8, size: 1 },
      { name: "update_authority", type: "pubkey", offset: 9, size: 32 },
      { name: "mint", type: "pubkey", offset: 41, size: 32 },
    ]);
    // first dynamic field has a known offset but no size; total size is unknown
    const name = layout.fields.find((f) => f.name === "name")!;
    expect(name.offset).toBe(73);
    expect(name.size).toBeUndefined();
    expect(layout.fixedSize).toBeUndefined();
  });

  it("throws for an unknown account name", () => {
    const idl = fixture("relations.json");
    expect(() => accountLayout(idl, "NoSuchAccount")).toThrow(/account .*not found/i);
  });

  // Regression: two fields of the SAME defined type must both resolve. The `seen` set
  // guards recursion but must be backtracked, or the second field reads as variable-length
  // and corrupts every offset after it. (sizeOf backtrack fix.)
  it("sizes repeated occurrences of one defined type independently", () => {
    const idl = {
      accounts: [{ name: "Acct", discriminator: [1, 2, 3, 4, 5, 6, 7, 8] }],
      types: [
        {
          name: "Acct",
          type: {
            kind: "struct",
            fields: [
              { name: "a", type: { defined: "Pair" } },
              { name: "b", type: { defined: "Pair" } },
              { name: "c", type: "u64" },
            ],
          },
        },
        {
          name: "Pair",
          type: {
            kind: "struct",
            fields: [
              { name: "x", type: "u32" },
              { name: "y", type: "u32" },
            ],
          },
        },
      ],
    } as unknown as Idl;

    const layout = accountLayout(idl, "Acct");
    expect(layout.fields).toEqual([
      { name: "a", type: "Pair", offset: 8, size: 8 },
      { name: "b", type: "Pair", offset: 16, size: 8 }, // would be variable-length pre-fix
      { name: "c", type: "u64", offset: 24, size: 8 }, // would be NaN pre-fix
    ]);
    expect(layout.fixedSize).toBe(32); // 8 discriminator + 8 + 8 + 8
  });

  // Regression: a field whose type is a `kind: "type"` alias of a fixed-size type must
  // resolve to that size, not fall through to variable-length. (sizeOfTypeDef alias fix.)
  it("resolves type-alias definitions to the aliased size", () => {
    const idl = {
      accounts: [{ name: "A", discriminator: [1, 2, 3, 4, 5, 6, 7, 8] }],
      types: [
        {
          name: "A",
          type: {
            kind: "struct",
            fields: [
              { name: "k", type: { defined: "Lamports" } },
              { name: "n", type: "u8" },
            ],
          },
        },
        { name: "Lamports", type: { kind: "type", alias: "u64" } },
      ],
    } as unknown as Idl;

    const layout = accountLayout(idl, "A");
    expect(layout.fields).toEqual([
      { name: "k", type: "Lamports", offset: 8, size: 8 },
      { name: "n", type: "u8", offset: 16, size: 1 }, // would be NaN pre-fix
    ]);
    expect(layout.fixedSize).toBe(17); // 8 discriminator + 8 + 1
  });
});
