// Scoring: compare each arm's predicted verdict to ground truth, per case and aggregate.
// "Corrupting" = the upgrade would damage stored accounts (verdict MIGRATE). Precision/
// recall are computed on that positive class, since a missed corruption is the costly error.
import type { Verdict } from "../engine/src/diff.ts";

export interface Case {
  name: string;
  truth: Verdict;
  predicted: Verdict;
}

export interface ArmScore {
  arm: string;
  total: number;
  correct: number;
  accuracy: number;
  precision: number; // of cases flagged corrupting, how many truly were
  recall: number; // of truly corrupting cases, how many were flagged
  falsePositives: number;
  falseNegatives: number; // a missed corruption — the dangerous miss
}

const CORRUPTING: Verdict = "MIGRATE";

export function scoreArm(arm: string, cases: Case[]): ArmScore {
  let correct = 0;
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const c of cases) {
    if (c.predicted === c.truth) correct++;
    const truthPos = c.truth === CORRUPTING;
    const predPos = c.predicted === CORRUPTING;
    if (predPos && truthPos) tp++;
    else if (predPos && !truthPos) fp++;
    else if (!predPos && truthPos) fn++;
  }
  const total = cases.length;
  return {
    arm,
    total,
    correct,
    accuracy: total ? correct / total : 0,
    precision: tp + fp ? tp / (tp + fp) : 1,
    recall: tp + fn ? tp / (tp + fn) : 1,
    falsePositives: fp,
    falseNegatives: fn,
  };
}

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

export function renderTable(scores: ArmScore[]): string {
  const head =
    "| Arm | Accuracy | Precision (corruption) | Recall (corruption) | False positives | False negatives (missed corruption) |\n" +
    "| --- | --- | --- | --- | --- | --- |";
  const rows = scores.map(
    (s) =>
      `| ${s.arm} | ${pct(s.accuracy)} (${s.correct}/${s.total}) | ${pct(s.precision)} | ${pct(
        s.recall,
      )} | ${s.falsePositives} | ${s.falseNegatives} |`,
  );
  return [head, ...rows].join("\n");
}

export function renderPerCase(arms: Record<string, Case[]>): string {
  const names = Object.keys(arms);
  const first = names[0] ? arms[names[0]] ?? [] : [];
  const head =
    `| Case | Truth | ${names.join(" | ")} |\n` +
    `| --- | --- | ${names.map(() => "---").join(" | ")} |`;
  const rows = first.map((base, i) => {
    const cells = names.map((n) => {
      const c = (arms[n] ?? [])[i];
      if (!c) return "—";
      return c.predicted === c.truth ? `${c.predicted} ✓` : `${c.predicted} ✗`;
    });
    return `| ${base.name} | ${base.truth} | ${cells.join(" | ")} |`;
  });
  return [head, ...rows].join("\n");
}
