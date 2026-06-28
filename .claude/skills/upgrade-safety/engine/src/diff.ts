// LADDER 1 — classify how an upgrade breaks compatibility.
// Walked top to bottom, stopping at the first matching rung per change. This control
// flow mirrors skill/classify.md verbatim; keep the two in sync.

import { typeLabel, type Idl, type IdlField, type IdlType } from "./layout.ts";
import { detectModel, type DetectOptions, type ModelResult } from "./detect-model.ts";

export type Category =
  | "STORAGE-SAFE"
  | "MIGRATION-REQUIRED"
  | "UNSAFE"
  | "CLIENT-BREAKING"
  | "ABI-BREAKING";

export type Verdict = "SAFE" | "MIGRATE" | "COORDINATE" | "REFUSE";

export interface Change {
  category: Category;
  rung: string;
  reason: string;
  account?: string;
  field?: string | null;
  instruction?: string;
  arg?: string;
  error?: string;
}

export interface DiffResult {
  changes: Change[];
  verdict: Verdict;
}

function typeKey(t: IdlType | undefined): string {
  // Normalize via typeLabel so spec differences across Anchor versions
  // (e.g. { defined: "X" } vs { defined: { name: "X" } }) compare equal.
  return t === undefined ? "" : typeLabel(t);
}

function structFields(idl: Idl, name: string): IdlField[] {
  const def = idl.types?.find((d) => d.name === name);
  return def && def.type.kind === "struct" ? def.type.fields ?? [] : [];
}

function discriminator(idl: Idl, name: string): string {
  const a = idl.accounts?.find((x) => x.name === name);
  return JSON.stringify(a?.discriminator ?? []);
}

// --- Per-account field walk: rungs R1–R6 ---
function classifyAccount(before: Idl, after: Idl, account: string): Change[] {
  const changes: Change[] = [];

  const inBefore = before.accounts?.some((a) => a.name === account) ?? false;
  const inAfter = after.accounts?.some((a) => a.name === account) ?? false;

  // Adding a new account is storage-safe: no existing data to corrupt.
  if (!inBefore) return changes;

  // Removing an account orphans its on-chain data — existing accounts become unreadable.
  if (!inAfter) {
    changes.push({
      category: "UNSAFE",
      rung: "R6",
      account,
      field: null,
      reason: "account removed — existing accounts become unreadable",
    });
    return changes;
  }

  // R6 at the account level: discriminator / account identity change is UNSAFE.
  if (discriminator(before, account) !== discriminator(after, account)) {
    changes.push({
      category: "UNSAFE",
      rung: "R6",
      account,
      field: null,
      reason: "discriminator changed — existing accounts become unfindable",
    });
    return changes; // identity broke; per-field analysis is moot
  }

  const oldFields = structFields(before, account);
  const newFields = structFields(after, account);
  const newByName = new Map(newFields.map((f, i) => [f.name, { f, i }]));
  const oldNames = new Set(oldFields.map((f) => f.name));

  // A removal or mid-insertion shifts every following field. To report a genuine reorder
  // (not that side-effect cascade), compare each survivor's actual new index to its
  // *expected* one — its rank among surviving fields in each version. A pure swap flags
  // both swapped fields; a removal's downstream shifts cancel out and aren't reported.
  const oldRank = new Map(
    oldFields.filter((f) => newByName.has(f.name)).map((f, i) => [f.name, i]),
  );
  const newRank = new Map(
    newFields.filter((f) => oldNames.has(f.name)).map((f, i) => [f.name, i]),
  );

  oldFields.forEach((of, oldIdx) => {
    const hit = newByName.get(of.name);

    // R5: field removed / struct shrunk.
    if (!hit) {
      changes.push({
        category: "MIGRATION-REQUIRED",
        rung: "R5",
        account,
        field: of.name,
        reason: "field removed — old data misreads",
      });
      return;
    }

    // R3: genuine reorder — rank among survivors changed.
    if (oldRank.get(of.name) !== newRank.get(of.name)) {
      changes.push({
        category: "MIGRATION-REQUIRED",
        rung: "R3",
        account,
        field: of.name,
        reason: `field moved (position ${oldIdx} → ${hit.i}) — offsets shift`,
      });
      return;
    }

    // R4: same position, type changed (size/layout change).
    if (typeKey(of.type) !== typeKey(hit.f.type)) {
      changes.push({
        category: "MIGRATION-REQUIRED",
        rung: "R4",
        account,
        field: of.name,
        reason: `type changed (${typeKey(of.type)} → ${typeKey(hit.f.type)})`,
      });
      return;
    }

    // R2: same name, type, position → STORAGE-SAFE (unchanged). Not reported as a change.
  });

  // R1: new field appended at the very end → STORAGE-SAFE.
  newFields.forEach((nf, newIdx) => {
    if (oldNames.has(nf.name)) return;
    const appendedAtEnd = newIdx >= oldFields.length;
    changes.push(
      appendedAtEnd
        ? {
            category: "STORAGE-SAFE",
            rung: "R1",
            account,
            field: nf.name,
            reason: "new field appended at end",
          }
        : {
            // Inserted in the middle: same hazard as a move for everything after it.
            category: "MIGRATION-REQUIRED",
            rung: "R3",
            account,
            field: nf.name,
            reason: `new field inserted at position ${newIdx} — shifts following offsets`,
          },
    );
  });

  return changes;
}

// --- Whole-IDL walk: rungs R7–R8 ---
function classifyInstructions(before: Idl, after: Idl): Change[] {
  const changes: Change[] = [];
  const afterIx = new Map((after.instructions ?? []).map((i) => [i.name, i]));

  for (const bi of before.instructions ?? []) {
    const ai = afterIx.get(bi.name);
    if (!ai) {
      // Removed instruction: old clients calling it fail — a breaking client change.
      changes.push({
        category: "CLIENT-BREAKING",
        rung: "R7",
        instruction: bi.name,
        reason: "instruction removed",
      });
      continue;
    }
    const bArgs = bi.args ?? [];
    const aArgs = ai.args ?? [];

    aArgs.forEach((aa, idx) => {
      const ba = bArgs[idx];
      const added = ba === undefined;
      const reordered = ba !== undefined && ba.name !== aa.name;
      const retyped = ba !== undefined && ba.name === aa.name && typeKey(ba.type) !== typeKey(aa.type);
      if (added || reordered || retyped) {
        changes.push({
          category: "CLIENT-BREAKING",
          rung: "R7",
          instruction: bi.name,
          arg: (ba ?? aa).name,
          reason: added
            ? "instruction arg added"
            : reordered
              ? "instruction args reordered"
              : "instruction arg retyped",
        });
      }
    });

    // Removed args: present before, absent after (old clients fail to deserialize).
    const aArgNames = new Set(aArgs.map((a) => a.name));
    for (const ba of bArgs) {
      if (!aArgNames.has(ba.name)) {
        changes.push({
          category: "CLIENT-BREAKING",
          rung: "R7",
          instruction: bi.name,
          arg: ba.name,
          reason: "instruction arg removed",
        });
      }
    }
  }
  return changes;
}

function classifyErrors(before: Idl, after: Idl): Change[] {
  const changes: Change[] = [];
  const bErrors = before.errors ?? [];
  const aErrors = after.errors ?? [];
  const aNames = new Set(aErrors.map((e) => e.name));
  // Same expected-rank rule as fields: report each removed variant once, and flag a
  // genuine reorder by comparing rank among surviving variants in each version.
  const bRank = new Map(bErrors.filter((e) => aNames.has(e.name)).map((e, i) => [e.name, i]));
  const bNames = new Set(bErrors.map((e) => e.name));
  const aRank = new Map(aErrors.filter((e) => bNames.has(e.name)).map((e, i) => [e.name, i]));
  bErrors.forEach((be) => {
    if (!aNames.has(be.name)) {
      changes.push({
        category: "ABI-BREAKING",
        rung: "R8",
        error: be.name,
        reason: "error variant removed — codes shift",
      });
      return;
    }
    if (bRank.get(be.name) !== aRank.get(be.name)) {
      changes.push({
        category: "ABI-BREAKING",
        rung: "R8",
        error: be.name,
        reason: "error variants reordered — codes shift",
      });
    }
  });
  // Added variants: appending at the end is safe, but inserting before any
  // existing variant shifts every subsequent code. Flag inserts, not appends.
  const lastSurvivorIdx = aErrors.reduce((acc, e, i) => (bNames.has(e.name) ? i : acc), -1);
  aErrors.forEach((ae, i) => {
    if (!bNames.has(ae.name) && i < lastSurvivorIdx) {
      changes.push({
        category: "ABI-BREAKING",
        rung: "R8",
        error: ae.name,
        reason: "error variant inserted before existing variants — codes shift",
      });
    }
  });
  return changes;
}

function rollUp(changes: Change[]): Verdict {
  const corrupts = changes.some(
    (c) => c.category === "MIGRATION-REQUIRED" || c.category === "UNSAFE",
  );
  if (corrupts) return "MIGRATE";
  const breaksClients = changes.some(
    (c) => c.category === "CLIENT-BREAKING" || c.category === "ABI-BREAKING",
  );
  return breaksClients ? "COORDINATE" : "SAFE";
}

export function diff(before: Idl, after: Idl): DiffResult {
  const changes: Change[] = [];

  const accountNames = new Set(
    [...(before.accounts ?? []), ...(after.accounts ?? [])]
      .filter((a): a is NonNullable<typeof a> => a != null)
      .map((a) => a.name),
  );
  for (const name of accountNames) {
    changes.push(...classifyAccount(before, after, name));
  }

  changes.push(...classifyInstructions(before, after));
  changes.push(...classifyErrors(before, after));

  return { changes, verdict: rollUp(changes) };
}

export interface AnalysisResult extends DiffResult {
  model: ModelResult;
}

// Gate before analyze: LADDER 0 decides whether LADDER 1 even runs. A refused model
// returns no changes and a "REFUSE" verdict; an analyzable one runs the classifier.
export function analyzeUpgrade(
  before: Idl,
  after: Idl,
  opts: DetectOptions = {},
): AnalysisResult {
  const model = detectModel(after, opts);
  if (!model.analyze) {
    return { changes: [], verdict: "REFUSE", model };
  }
  return { ...diff(before, after), model };
}
