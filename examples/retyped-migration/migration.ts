// Generated client-side migration call for `AmmConfig`.
// Targets @solana/kit; wire in your program client and signer.
import { type Address, type TransactionSigner } from "@solana/kit";

export async function migrateAmmConfig(params: {
  account: Address;
  payer: TransactionSigner;
  // ..program client / rpc..
}): Promise<void> {
  // TODO: build and send the `migrate` instruction for AmmConfig.
  // 1. fetch the account at the V1 layout
  // 2. call the program's migrate instruction (reallocs + rewrites as V2)
  // 3. confirm and re-fetch at the V2 layout to verify
  throw new Error("migrateAmmConfig: fill in the program client call");
}
