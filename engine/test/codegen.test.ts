import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { diff } from "../src/diff.ts";
import { generateArtifacts } from "../src/codegen.ts";
import type { Idl } from "../src/layout.ts";

const pairsDir = fileURLToPath(new URL("../../fixtures/pairs", import.meta.url));
function load(pair: string, file: string): Idl {
  return JSON.parse(readFileSync(`${pairsDir}/${pair}/${file}`, "utf8")) as Idl;
}
function artifacts(pair: string) {
  const before = load(pair, "before.json");
  const after = load(pair, "after.json");
  return generateArtifacts(before, after, diff(before, after));
}

describe("generateArtifacts", () => {
  it("always emits a report and a release checklist", () => {
    const a = artifacts("append-safe");
    expect(a["report.md"]).toBeDefined();
    expect(a["release-checklist.md"]).toBeDefined();
  });

  it("report names the verdict and lists each change with its category", () => {
    const a = artifacts("moved-migration");
    expect(a["report.md"]).toContain("MIGRATE");
    expect(a["report.md"]).toContain("MIGRATION-REQUIRED");
    expect(a["report.md"]).toContain("bump"); // a moved field
  });

  it("STORAGE-SAFE upgrade emits NO migration code (nothing to migrate)", () => {
    const a = artifacts("append-safe");
    expect(a["migration.rs"]).toBeUndefined();
    expect(a["migration.ts"]).toBeUndefined();
    expect(a["regression.test.ts"]).toBeUndefined();
    expect(a["report.md"]).toContain("SAFE");
  });

  it("MIGRATION-REQUIRED upgrade emits migration.rs / .ts / regression test", () => {
    const a = artifacts("retyped-migration");
    expect(a["migration.rs"]).toBeDefined();
    expect(a["migration.ts"]).toBeDefined();
    expect(a["regression.test.ts"]).toBeDefined();
  });

  it("migration.rs scaffolds a versioned struct and a realloc-based migrate fn", () => {
    const a = artifacts("retyped-migration");
    const rs = a["migration.rs"]!;
    expect(rs).toMatch(/AmmConfigV1/); // versioned old struct
    expect(rs).toMatch(/AmmConfigV2/); // versioned new struct
    expect(rs).toMatch(/realloc/i);
    expect(rs).toMatch(/pub fn migrate/);
  });

  it("regression test follows write-old → migrate → assert-new shape", () => {
    const ts = artifacts("retyped-migration")["regression.test.ts"]!;
    expect(ts).toMatch(/BorshAccountsCoder/);
    expect(ts).toMatch(/encode/);
    expect(ts).toMatch(/decode/);
  });

  it("REFUSE / unanalyzable still produces a report (no crash, no migration code)", () => {
    // a manual-model IDL run through diff() directly yields no changes; codegen must cope
    const idl = load("identical-safe", "before.json");
    const a = generateArtifacts(idl, idl, { changes: [], verdict: "REFUSE" });
    expect(a["report.md"]).toContain("REFUSE");
    expect(a["migration.rs"]).toBeUndefined();
  });
});
