export type NftAttribute = {
  trait_type: string;
  value: string;
};

export type MutationMetadata = {
  parent_v1_mint: string;
  catalyst_mint: string;
  catalyst_tier: number;
  mutation_version: string;
  category: string;
};

export type NftMetadata = {
  name: string;
  symbol?: string;
  description?: string;
  image?: string;
  attributes: NftAttribute[];
  mutation?: MutationMetadata;
};

export type CatalystMetadata = {
  tier: number | string;
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
  attributes?: NftAttribute[];
};

export type EvolutionInputs = {
  assetA_mint: string;
  assetA_metadata: NftMetadata;
  catalystB_mint: string;
  catalystB_metadata: CatalystMetadata;
  walletPublicKey: string;
};

export type EvolutionResult = {
  txSignature: string;
  mutatedMint: string;
  mutatedMetadata: NftMetadata;
};
