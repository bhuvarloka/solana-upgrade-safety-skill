# LADDER 0 — Detect the serialization model (the gate)

Run this **before** any compatibility verdict — the IDL doesn't fully encode layout, so refuse where analysis would be unsound. Walk top to bottom, **stop at the first match**. Order matters: most restrictive model wins, because a real IDL (e.g. Raydium's) mixes Borsh and zero-copy.

```
Detect serialization model — stop at the first match:

  0.3  Manual / custom (de)serialization              → REFUSE confidently.
       (a serialization marker that isn't anchor's       The IDL may not reflect the true on-chain
        own borsh / bytemuck*)                           layout — point to manual review.

  0.2  Zero-copy / repr(C) / repr(packed) / bytemuck   → analyze WITH an explicit caveat.
       (serialization starts "bytemuck", or              Field order and size still matter, but
        repr.kind is "c" / "transparent")                alignment & padding differ from Borsh —
                                                          never claim certainty.

  0.1  Standard Anchor #[account] (Borsh)              → fully analyzable, continue to LADDER 1.
       (a recognizable Anchor IDL: spec marker, or
        plain account structs with no zero-copy/manual
        signal)

  0.4  Unrecognized / nothing to go on                 → REFUSE; ask the user to confirm the model
                                                          (or pass it explicitly).
```

> **Order note:** check **manual (0.3) before zero-copy (0.2)** so the most restrictive model wins on a mixed IDL. Mirrors `engine/src/detect-model.ts`; keep them identical.

**Override.** A user who knows the model can assert it (`--assume anchor-borsh | zero-copy | manual`), which forces the rung and skips detection.

**Outcomes**

| Model | Analyze? | What to say |
|---|---|---|
| `anchor-borsh` | yes | proceed to LADDER 1, no caveat |
| `zero-copy` | yes, with caveat | "field order/size analyzed; alignment & padding may differ — indicative, not certain" |
| `manual` | no — REFUSE | "manual serialization; the IDL may not reflect true layout — needs manual review" |
| `unknown` | no — REFUSE | "unrecognized model; confirm whether this is Anchor Borsh, zero-copy, or manual" |

Next: only if the model is analyzable → [classify.md](classify.md).
