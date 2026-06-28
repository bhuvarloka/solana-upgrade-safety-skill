# Real IDL fixtures

Lifted verbatim from the Anchor repo's `tests/` — real programs, not toy structs.

- Source: `solana-foundation/anchor` @ commit `6945345b8f9e636860408316ef60a3e9c25bdc7b`
- IDL spec: `0.1.0` (current Anchor format — `accounts[]` carry the discriminator; field layout resolves by name into `types[]`)

| fixture | upstream path | what it is |
|---|---|---|
| `raydium-amm-v3.json` | `tests/declare-program/idls/amm_v3.json` | **Showpiece** — Raydium concentrated-liquidity AMM (9 accounts, 26 types) |
| `anchor-idl-kitchensink.json` | `tests/idl/idls/idl.json` | Anchor's own IDL test program (15 accounts, 27 types) — wide type coverage |
| `relations.json` | `tests/idl/idls/relations.json` | minimal single-account program |
| `generics.json` | `tests/idl/idls/generics.json` | generic-typed account |
| `external.json` | `tests/declare-program/idls/external.json` | external/packed accounts |
| `mpl-token-metadata.json` | `tests/auction-house/idls/mpl_token_metadata.json` | Metaplex Token Metadata `Metadata` account |
