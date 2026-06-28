import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { diff } from "../src/diff.ts";
import type { Idl } from "../src/layout.ts";

const pairsDir = fileURLToPath(new URL("../../fixtures/pairs", import.meta.url));

function load(pair: string, file: string) {
  return JSON.parse(readFileSync(`${pairsDir}/${pair}/${file}`, "utf8"));
}

const pairs = readdirSync(pairsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

describe("diff (LADDER 1)", () => {
  // Each fixture pair isolates exactly one ladder rung; expected.json is the oracle.
  it.each(pairs)("classifies %s to match expected.json", (pair) => {
    const before = load(pair, "before.json") as Idl;
    const after = load(pair, "after.json") as Idl;
    const expected = load(pair, "expected.json");

    const result = diff(before, after);

    // Compare the salient fields (category/rung + locus), order-independent.
    // `reason` is prose, not part of the oracle — drop it before comparing.
    const norm = (c: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(c).filter(([k, v]) => v !== undefined && k !== "reason"),
      );
    const got = (result.changes as unknown as Record<string, unknown>[]).map(norm).sort(keyCmp);
    const want = (expected.changes as Record<string, unknown>[]).map(norm).sort(keyCmp);

    expect(got).toEqual(want);
    expect(result.verdict).toBe(expected.verdict);
  });
});

function keyCmp(a: Record<string, unknown>, b: Record<string, unknown>): number {
  return JSON.stringify(a).localeCompare(JSON.stringify(b));
}
