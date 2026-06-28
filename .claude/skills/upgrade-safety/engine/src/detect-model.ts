// LADDER 0 — detect the serialization model before any compatibility verdict.
// Walked top to bottom, stopping at the first matching rung. The IDL does not fully
// encode layout for every account type, so we gate first and refuse confidently where
// analysis would be unsound. This mirrors skill/detect-model.md verbatim.

import type { Idl, IdlTypeDef } from "./layout.ts";

export type Model = "anchor-borsh" | "zero-copy" | "manual" | "unknown";

export interface ModelResult {
  model: Model;
  analyze: boolean; // run LADDER 1?
  refuse: boolean; // stop and tell the user we can't verify
  assumed?: boolean; // model came from an explicit override, not detection
  caveat?: string; // analyze, but never claim certainty
  reason?: string; // why we refused / what to do
}

export interface DetectOptions {
  assumeModel?: Model;
}

// Anchor writes these on zero-copy type defs (repr(C)/repr(packed), bytemuck).
function isZeroCopy(t: IdlTypeDef & { serialization?: string; repr?: { kind?: string } }): boolean {
  const ser = t.serialization;
  if (ser && ser.startsWith("bytemuck")) return true;
  const repr = t.repr?.kind;
  return repr === "c" || repr === "transparent";
}

// A serialization marker that isn't Anchor's own (borsh / bytemuck*) → hand-rolled.
function isManualSerialization(t: { serialization?: string }): boolean {
  const ser = t.serialization;
  return ser !== undefined && ser !== "borsh" && !ser.startsWith("bytemuck");
}

export function detectModel(idl: Idl, opts: DetectOptions = {}): ModelResult {
  if (opts.assumeModel) {
    return finalize(opts.assumeModel, true);
  }

  const types = (idl.types ?? []) as (IdlTypeDef & {
    serialization?: string;
    repr?: { kind?: string };
  })[];

  // Rung 0.3 (checked before 0.2): any custom/manual serialization → IDL may not reflect
  // true layout → REFUSE. Most restrictive, so it wins over a mixed-model IDL.
  if (types.some(isManualSerialization)) {
    return finalize("manual", false);
  }

  // Rung 0.2: zero-copy / repr(C) present → partially analyzable, caveat alignment/padding.
  if (types.some(isZeroCopy)) {
    return finalize("zero-copy", false);
  }

  // Rung 0.1: a recognizable Anchor IDL (spec marker or plain Borsh types) → analyzable.
  if (idl.metadata?.spec || (idl.accounts?.length ?? 0) > 0) {
    return finalize("anchor-borsh", false);
  }

  // Rung 0.4: nothing to go on → REFUSE, ask the user to confirm the model.
  return finalize("unknown", false);
}

function finalize(model: Model, assumed: boolean): ModelResult {
  const base = { model, assumed: assumed || undefined };
  switch (model) {
    case "anchor-borsh":
      return { ...base, analyze: true, refuse: false };
    case "zero-copy":
      return {
        ...base,
        analyze: true,
        refuse: false,
        caveat:
          "zero-copy / repr(C): field order and size are analyzed, but alignment and " +
          "padding differ from Borsh — treat the verdict as indicative, not certain.",
      };
    case "manual":
      return {
        ...base,
        analyze: false,
        refuse: true,
        reason:
          "manual / custom (de)serialization: the IDL may not reflect the true on-chain " +
          "layout — this needs manual review, not automated analysis.",
      };
    case "unknown":
      return {
        ...base,
        analyze: false,
        refuse: true,
        reason:
          "unrecognized serialization model — please confirm whether this program uses " +
          "standard Anchor Borsh, zero-copy, or manual serialization (assumeModel).",
      };
  }
}
