import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import anchor from "@coral-xyz/anchor";
import { diff } from "../src/diff.ts";
import { accountLayout, type Idl, type IdlField } from "../src/layout.ts";

const { BorshAccountsCoder, BN } = anchor;
const PUBKEY = "11111111111111111111111111111112";
const ACCOUNT = "MyAccount";

// Real base: relations.json's MyAccount { my_account: pubkey, bump: u8 } from the Anchor repo.
function realIdl(): Idl {
  const path = fileURLToPath(new URL("../../fixtures/anchor-real/relations.json", import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as Idl;
}

// Return a copy of the real IDL with MyAccount's fields replaced by `fields`.
function withFields(fields: IdlField[]): Idl {
  const idl = realIdl();
  const def = idl.types!.find((t) => t.name === ACCOUNT)!;
  (def.type as { fields: IdlField[] }).fields = fields;
  return idl;
}

const OLD = withFields([
  { name: "my_account", type: "pubkey" },
  { name: "bump", type: "u8" },
]);

// Zero-extend old bytes to the new fixed size — simulates an on-chain realloc.
function realloc(buf: Buffer, size: number): Buffer {
  const out = Buffer.alloc(Math.max(size, buf.length));
  buf.copy(out);
  return out;
}

function encode(idl: Idl, value: Record<string, unknown>): Promise<Buffer> {
  return new BorshAccountsCoder(idl as never).encode(ACCOUNT, value);
}

function decodeWith(idl: Idl, bytes: Buffer): Record<string, never> {
  const size = accountLayout(idl, ACCOUNT).fixedSize ?? bytes.length;
  return new BorshAccountsCoder(idl as never).decodeUnchecked(ACCOUNT, realloc(bytes, size));
}

describe("round-trip proof: the classifier verdict is provable in bytes (real IDL)", () => {
  it("STORAGE-SAFE (append): old data survives the new layout intact", async () => {
    const NEW = withFields([
      { name: "my_account", type: "pubkey" },
      { name: "bump", type: "u8" },
      { name: "version", type: "u8" }, // appended at end
    ]);

    expect(diff(OLD, NEW).verdict).toBe("SAFE");

    const bytes = await encode(OLD, {
      my_account: new anchor.web3.PublicKey(PUBKEY),
      bump: 5,
    });
    const acc = decodeWith(NEW, bytes);
    expect((acc.my_account as never as { toBase58(): string }).toBase58()).toBe(PUBKEY); // intact
    expect(acc.bump).toBe(5 as never); // intact
  });

  it("MIGRATION-REQUIRED (insert in middle): old data is misread", async () => {
    const NEW = withFields([
      { name: "my_account", type: "pubkey" },
      { name: "authority", type: "pubkey" }, // inserted before bump
      { name: "bump", type: "u8" },
    ]);

    expect(diff(OLD, NEW).verdict).toBe("MIGRATE");

    const bytes = await encode(OLD, {
      my_account: new anchor.web3.PublicKey(PUBKEY),
      bump: 5,
    });
    const acc = decodeWith(NEW, bytes);
    // bump now reads a byte of the inserted pubkey's region, not the original 5 → corrupt
    expect(acc.bump).not.toBe(5 as never);
  });

  it("MIGRATION-REQUIRED (retype u8→u64): a trailing field is misread", async () => {
    const OLD3 = withFields([
      { name: "my_account", type: "pubkey" },
      { name: "counter", type: "u8" },
      { name: "bump", type: "u8" },
    ]);
    const NEW3 = withFields([
      { name: "my_account", type: "pubkey" },
      { name: "counter", type: "u64" }, // widened in place
      { name: "bump", type: "u8" },
    ]);

    expect(diff(OLD3, NEW3).verdict).toBe("MIGRATE");

    const bytes = await encode(OLD3, {
      my_account: new anchor.web3.PublicKey(PUBKEY),
      counter: 1,
      bump: 7,
    });
    const acc = decodeWith(NEW3, bytes);
    // counter widened to 8 bytes consumed bump's byte; bump shifted → corrupt
    expect(acc.bump).not.toBe(7 as never);
  });
});
