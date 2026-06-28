// Proves a `AmmConfig` account at the old layout survives migration.
import { describe, it, expect } from "vitest";
import anchor from "@coral-xyz/anchor";

const { BorshAccountsCoder } = anchor;

const OLD_IDL = {
  "metadata": {
    "name": "amm_v3",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Anchor client and source for Raydium concentrated liquidity AMM"
  },
  "instructions": [],
  "accounts": [
    {
      "name": "AmmConfig",
      "discriminator": [
        218,
        244,
        33,
        104,
        203,
        203,
        43,
        111
      ]
    }
  ],
  "types": [
    {
      "name": "AmmConfig",
      "docs": [
        "Holds the current owner of the factory"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "docs": [
              "Bump to identify PDA"
            ],
            "type": "u8"
          },
          {
            "name": "index",
            "type": "u16"
          },
          {
            "name": "owner",
            "docs": [
              "Address of the protocol owner"
            ],
            "type": "pubkey"
          },
          {
            "name": "protocol_fee_rate",
            "docs": [
              "The protocol fee"
            ],
            "type": "u32"
          },
          {
            "name": "trade_fee_rate",
            "docs": [
              "The trade fee, denominated in hundredths of a bip (10^-6)"
            ],
            "type": "u32"
          },
          {
            "name": "tick_spacing",
            "docs": [
              "The tick spacing"
            ],
            "type": "u16"
          },
          {
            "name": "fund_fee_rate",
            "docs": [
              "The fund fee, denominated in hundredths of a bip (10^-6)"
            ],
            "type": "u32"
          },
          {
            "name": "padding_u32",
            "type": "u32"
          },
          {
            "name": "fund_owner",
            "type": "pubkey"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u64",
                3
              ]
            }
          }
        ]
      }
    }
  ]
} as const;
const NEW_IDL = {
  "metadata": {
    "name": "amm_v3",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Anchor client and source for Raydium concentrated liquidity AMM"
  },
  "instructions": [],
  "accounts": [
    {
      "name": "AmmConfig",
      "discriminator": [
        218,
        244,
        33,
        104,
        203,
        203,
        43,
        111
      ]
    }
  ],
  "types": [
    {
      "name": "AmmConfig",
      "docs": [
        "Holds the current owner of the factory"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "docs": [
              "Bump to identify PDA"
            ],
            "type": "u8"
          },
          {
            "name": "index",
            "type": "u16"
          },
          {
            "name": "owner",
            "docs": [
              "Address of the protocol owner"
            ],
            "type": "pubkey"
          },
          {
            "name": "protocol_fee_rate",
            "docs": [
              "The protocol fee"
            ],
            "type": "u32"
          },
          {
            "name": "trade_fee_rate",
            "docs": [
              "The trade fee, denominated in hundredths of a bip (10^-6)"
            ],
            "type": "u64"
          },
          {
            "name": "tick_spacing",
            "docs": [
              "The tick spacing"
            ],
            "type": "u16"
          },
          {
            "name": "fund_fee_rate",
            "docs": [
              "The fund fee, denominated in hundredths of a bip (10^-6)"
            ],
            "type": "u32"
          },
          {
            "name": "padding_u32",
            "type": "u32"
          },
          {
            "name": "fund_owner",
            "type": "pubkey"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u64",
                3
              ]
            }
          }
        ]
      }
    }
  ]
} as const;

describe("AmmConfig migration", () => {
  it("an account written at the old layout reads correctly after migration", async () => {
    const oldCoder = new BorshAccountsCoder(OLD_IDL as never);
    const newCoder = new BorshAccountsCoder(NEW_IDL as never);

    const value = { /* TODO: fill realistic field values */ };
    const oldBytes = await oldCoder.encode("AmmConfig", value);

    const migrated = oldBytes; // TODO: replace with post-migration account bytes

    const decoded = newCoder.decodeUnchecked("AmmConfig", migrated);
    expect(decoded).toBeDefined();
    // TODO: assert each field equals the expected migrated value
  });
});
