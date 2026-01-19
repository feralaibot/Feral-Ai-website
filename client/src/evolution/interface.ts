import type { NftMetadata } from "./types";
import { EvolutionError } from "./errors";

type MintResult = {
  mint: string;
  txSignature: string;
};

type BurnResult = {
  txSignature: string;
};

export async function verifyOwnership(wallet: string, mint: string): Promise<boolean> {
  if (!wallet || !mint) return false;
  return true;
}

export async function burnNft(wallet: string, mint: string): Promise<BurnResult> {
  if (!wallet || !mint) {
    throw new EvolutionError("transaction-failure", "Missing wallet or mint.");
  }
  return { txSignature: `burn-${Date.now()}` };
}

export async function mintNft(wallet: string, metadata: NftMetadata): Promise<MintResult> {
  if (!wallet || !metadata?.name) {
    throw new EvolutionError("transaction-failure", "Missing wallet or metadata.");
  }
  return {
    mint: `mutated-${Math.random().toString(16).slice(2, 10)}`,
    txSignature: `mint-${Date.now()}`,
  };
}

export async function burnCatalystAndMintMutated(
  wallet: string,
  catalystMint: string,
  mutatedMetadata: NftMetadata,
): Promise<{ txSignature: string; mutatedMint: string }> {
  const ownsCatalyst = await verifyOwnership(wallet, catalystMint);
  if (!ownsCatalyst) {
    throw new EvolutionError("ownership-failed", "Catalyst is not owned.");
  }

  await burnNft(wallet, catalystMint);
  const mintResult = await mintNft(wallet, mutatedMetadata);
  return { txSignature: mintResult.txSignature, mutatedMint: mintResult.mint };
}
