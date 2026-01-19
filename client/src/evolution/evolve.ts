import { MUTATION_SYMBOL, MUTATION_VERSION } from "./config";
import { EvolutionError } from "./errors";
import { deriveCategory, normalizeAndAppendTier, parseTier } from "./helpers";
import { burnCatalystAndMintMutated, verifyOwnership } from "./interface";
import type { EvolutionInputs, EvolutionResult, NftMetadata } from "./types";

function buildMutatedMetadata(
  assetA_mint: string,
  assetA_metadata: NftMetadata,
  catalystB_mint: string,
  tier: number,
): NftMetadata {
  const mutatedAttributes = assetA_metadata.attributes.map((attr) => ({
    trait_type: attr.trait_type,
    value: normalizeAndAppendTier(attr.value, tier),
  }));

  return {
    name: `Mutated ${assetA_metadata.name}`,
    symbol: MUTATION_SYMBOL,
    description: assetA_metadata.description || "Mutated FERAL asset.",
    image: assetA_metadata.image,
    attributes: mutatedAttributes,
    mutation: {
      parent_v1_mint: assetA_mint,
      catalyst_mint: catalystB_mint,
      catalyst_tier: tier,
      mutation_version: MUTATION_VERSION,
      category: deriveCategory(assetA_metadata.attributes),
    },
  };
}

export async function evolve(inputs: EvolutionInputs): Promise<EvolutionResult> {
  const {
    assetA_mint,
    assetA_metadata,
    catalystB_mint,
    catalystB_metadata,
    walletPublicKey,
  } = inputs;

  if (!assetA_mint || !catalystB_mint) {
    throw new EvolutionError("missing-assets");
  }
  if (!assetA_metadata?.attributes?.length) {
    throw new EvolutionError("malformed-metadata");
  }

  const ownsAssetA = await verifyOwnership(walletPublicKey, assetA_mint);
  if (!ownsAssetA) {
    throw new EvolutionError("ownership-failed", "Asset A is not owned.");
  }

  const ownsCatalystB = await verifyOwnership(walletPublicKey, catalystB_mint);
  if (!ownsCatalystB) {
    throw new EvolutionError("ownership-failed", "Catalyst B is not owned.");
  }

  const tier = parseTier(catalystB_metadata?.tier);
  if (!tier) {
    throw new EvolutionError("invalid-tier");
  }

  const mutatedMetadata = buildMutatedMetadata(
    assetA_mint,
    assetA_metadata,
    catalystB_mint,
    tier,
  );

  try {
    const result = await burnCatalystAndMintMutated(
      walletPublicKey,
      catalystB_mint,
      mutatedMetadata,
    );
    return {
      txSignature: result.txSignature,
      mutatedMint: result.mutatedMint,
      mutatedMetadata,
    };
  } catch (error) {
    if (error instanceof EvolutionError) throw error;
    throw new EvolutionError("transaction-failure");
  }
}
