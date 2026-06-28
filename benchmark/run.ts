// Benchmark: does the skill change the verdict an agent reaches? Run every golden pair
// through two arms and score both against ground truth. One command, no network, reproducible.
//
//   with-skill : the deterministic engine (analyzeUpgrade) — what the agent does WITH the skill.
//   baseline   : a stand-in for a bare agent reasoning from "it compiles" instead of the
//                append-only Borsh invariant. It is deliberately simple and documented below;
//                it is NOT a live LLM (that would be non-deterministic and need credentials —
//                the methodology, not a one-off score, is the deliverable). Swap in a real
//                agent here and the scorer is unchanged.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { analyzeUpgrade } from "../engine/src/diff.ts";
import type { Idl } from "../engine/src/layout.ts";
import type { Verdict } from "../engine/src/diff.ts";
import { scoreArm, renderTable, renderPerCase, type Case, type ArmScore } from "./score.ts";

const pairsDir = fileURLToPath(new URL("../fixtures/pairs", import.meta.url));
const resultsPath = fileURLToPath(new URL("./results.md", import.meta.url));

interface Pair {
  name: string;
  before: Idl;
  after: Idl;
  truth: Verdict;
}

function loadPairs(): Pair[] {
  return readdirSync(pairsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((name) => {
      const at = (f: string) => JSON.parse(readFileSync(`${pairsDir}/${name}/${f}`, "utf8"));
      return { name, before: at("before.json"), after: at("after.json"), truth: at("expected.json").verdict };
    });
}

function withSkill(p: Pair): Verdict {
  return analyzeUpgrade(p.before, p.after).verdict;
}

// Baseline: the failure mode the skill exists to fix. A bare agent that hasn't internalized
// the fixed-offset Borsh invariant reasons "Rust compiles it, so it's fine" and only worries
// when a field's *type* visibly changes. So: flag MIGRATE iff some field changed type at the
// same name; everything else (reorders, mid-insertions, removals, discriminator) reads as SAFE.
// This is the documented, defensible weak prior — not a strawman; it gets the easy case right.
function baseline(p: Pair): Verdict {
  const fieldsOf = (idl: Idl) =>
    new Map(
      (idl.types ?? []).flatMap((d) =>
        d.type.kind === "struct"
          ? (d.type.fields ?? []).map((f) => [`${d.name}.${f.name}`, JSON.stringify(f.type)])
          : [],
      ),
    );
  const before = fieldsOf(p.before);
  const after = fieldsOf(p.after);
  for (const [key, t] of before) {
    if (after.has(key) && after.get(key) !== t) return "MIGRATE";
  }
  return "SAFE";
}

function run(): number {
  const pairs = loadPairs();
  const withSkillCases: Case[] = [];
  const baselineCases: Case[] = [];
  let totalMs = 0;

  for (const p of pairs) {
    const t0 = performance.now();
    const ws = withSkill(p);
    totalMs += performance.now() - t0;
    withSkillCases.push({ name: p.name, truth: p.truth, predicted: ws });
    baselineCases.push({ name: p.name, truth: p.truth, predicted: baseline(p) });
  }

  const arms: Record<string, Case[]> = { "with-skill": withSkillCases, baseline: baselineCases };

  const scores: ArmScore[] = Object.entries(arms).map(([arm, cases]) => scoreArm(arm, cases));

  const md = [
    "# Benchmark results",
    "",
    `Golden set: **${pairs.length}** IDL pairs from \`fixtures/pairs/\`, each with a ground-truth verdict.`,
    "Question posed to each arm: _will this upgrade corrupt already-deployed accounts, and how?_",
    "",
    "## Arms",
    "",
    "- **with-skill** — the deterministic engine (`analyzeUpgrade`): LADDER 0 gate → LADDER 1 classify.",
    "- **baseline** — a bare agent reasoning from \"it compiles\" instead of the append-only Borsh",
    "  invariant: flags a change only when a field's type visibly changes, missing reorders,",
    "  mid-struct insertions, removals, and discriminator changes. Documented in `run.ts`.",
    "",
    "## Summary",
    "",
    renderTable(scores),
    "",
    "> The dangerous metric is **false negatives (missed corruption)** — an upgrade the arm calls",
    "> safe that would in fact corrupt stored accounts. That is the column the skill drives to zero.",
    "",
    "## Per-case",
    "",
    renderPerCase(arms),
    "",
    "## Notes",
    "",
    `- with-skill latency: ${totalMs.toFixed(1)} ms total over ${pairs.length} cases (no network; pure local classification).`,
    "- Reproduce: `pnpm -C engine run benchmark` (or `tsx benchmark/run.ts` from the repo root).",
    "- The baseline is a deterministic stand-in so the benchmark is reproducible offline. To score",
    "  a live agent instead, replace `baseline()` with a model call; the scorer and table are unchanged.",
    "- Beyond the verdict, with-skill also emits the migration, regression test, and checklist — value",
    "  no bare agent provides regardless of its score.",
    "",
  ].join("\n");

  writeFileSync(resultsPath, md);

  console.log(renderTable(scores));
  console.log(`\nwrote ${resultsPath}`);

  const skill = scores.find((s) => s.arm === "with-skill")!;
  // The benchmark itself is a regression guard: the skill must never miss a corruption.
  if (skill.falseNegatives > 0) {
    console.error(`FAIL: with-skill missed ${skill.falseNegatives} corrupting upgrade(s)`);
    return 1;
  }
  return 0;
}

process.exit(run());
