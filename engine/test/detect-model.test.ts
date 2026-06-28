import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { detectModel } from "../src/detect-model.ts";
import { analyzeUpgrade } from "../src/diff.ts";
import type { Idl } from "../src/layout.ts";

function fixture(name: string): Idl {
  const path = fileURLToPath(new URL(`../../fixtures/models/${name}/idl.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as Idl;
}

describe("detectModel (LADDER 0)", () => {
  it("standard Anchor Borsh → analyzable, no caveat", () => {
    const r = detectModel(fixture("borsh"));
    expect(r.model).toBe("anchor-borsh");
    expect(r.analyze).toBe(true);
    expect(r.refuse).toBe(false);
    expect(r.caveat).toBeUndefined();
  });

  it("zero-copy (bytemuck / repr(C)) → analyze WITH a caveat, never certain", () => {
    const r = detectModel(fixture("zero-copy"));
    expect(r.model).toBe("zero-copy");
    expect(r.analyze).toBe(true);
    expect(r.refuse).toBe(false);
    expect(r.caveat).toMatch(/align|padding/i);
  });

  it("manual / custom serialization → REFUSE confidently", () => {
    const r = detectModel(fixture("manual"));
    expect(r.model).toBe("manual");
    expect(r.analyze).toBe(false);
    expect(r.refuse).toBe(true);
    expect(r.reason).toMatch(/manual|custom|layout/i);
  });

  it("unrecognized (no spec, no signals) → REFUSE and ask the user", () => {
    const r = detectModel({ metadata: { name: "mystery" } } as Idl);
    expect(r.model).toBe("unknown");
    expect(r.refuse).toBe(true);
    expect(r.reason).toMatch(/confirm|unrecognized|unknown/i);
  });

  it("assumeModel override forces a model and is honored", () => {
    // user asserts the manual fixture is actually standard borsh
    const r = detectModel(fixture("manual"), { assumeModel: "anchor-borsh" });
    expect(r.model).toBe("anchor-borsh");
    expect(r.analyze).toBe(true);
    expect(r.assumed).toBe(true);
  });
});

describe("analyzeUpgrade — gate before analyze", () => {
  it("refuses (no classification) when the model is manual", () => {
    const idl = fixture("manual");
    const r = analyzeUpgrade(idl, idl);
    expect(r.verdict).toBe("REFUSE");
    expect(r.changes).toEqual([]);
    expect(r.model.refuse).toBe(true);
  });

  it("runs the classifier when the model is analyzable", () => {
    const before = fixture("borsh");
    const after = JSON.parse(JSON.stringify(before)) as Idl;
    // append a safe field
    const t = after.types!.find((x) => x.name === "AmmConfig")!;
    (t.type as { fields: { name: string; type: string }[] }).fields.push({ name: "x", type: "u8" });
    const r = analyzeUpgrade(before, after);
    expect(r.model.model).toBe("anchor-borsh");
    expect(r.verdict).toBe("SAFE");
    expect(r.changes).toHaveLength(1);
  });
});
