import type { CatalystMetadata, NftMetadata } from "./types";

export function getStubAssetMetadata(name: string): NftMetadata {
  return {
    name,
    symbol: "FERAL",
    description: "Stub metadata for evolution scaffolding.",
    image: "",
    attributes: [
      { trait_type: "Eyes", value: "Blue" },
      { trait_type: "Origin", value: "Genesis" },
    ],
  };
}

export function getStubCatalystMetadata(name: string): CatalystMetadata {
  return {
    tier: 2,
    name,
    symbol: "MILK",
    description: "Stub metadata for catalyst scaffolding.",
  };
}
