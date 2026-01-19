export const TIER_SUFFIXES = ["T1", "T2", "T3"] as const;
export const ALLOWED_TIERS = [1, 2, 3] as const;

export const MUTATION_VERSION = "v2";
export const MUTATION_SYMBOL = "FERALM";

export type CategoryRule = {
  id: string;
  label: string;
  allOf?: Array<{ trait_type: string; value: string }>;
  anyOf?: Array<{ trait_type: string; value: string }>;
};

// Placeholder rules; update with your real trait mapping.
export const CATEGORY_RULES: CategoryRule[] = [
  {
    id: "prototype",
    label: "Prototype",
    allOf: [{ trait_type: "Origin", value: "Genesis" }],
  },
];

export const ELIGIBLE_COLLECTION_FILTERS = {
  assetACollections: [
    "H8YVhZz6Pt81k2j4DKDbGHHT6ikwHpHhQ24SBhQWrota",
  ] as string[],
  // TODO: Add catalyst collection IDs when minted.
  catalystCollections: [] as string[],
};
