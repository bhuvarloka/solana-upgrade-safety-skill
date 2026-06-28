import { type Address, type TransactionSigner } from "@solana/kit";

export async function migrateAmmConfig(params: {
  account: Address;
  payer: TransactionSigner;
}): Promise<void> {
  // TODO: build and send the `migrate` instruction for AmmConfig.
  throw new Error("migrateAmmConfig: fill in the program client call");
}
