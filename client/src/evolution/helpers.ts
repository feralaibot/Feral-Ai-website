import { ALLOWED_TIERS, CATEGORY_RULES, TIER_SUFFIXES } from "./config";
import type { NftAttribute } from "./types";

function buildTierSuffixRegex() {
  return new RegExp(`\\s(?:${TIER_SUFFIXES.join("|")})$`);
}

function hasTrait(attributes: NftAttribute[], trait_type: string, value: string) {
  return attributes.some(
    (attr) => attr.trait_type === trait_type && String(attr.value) === value,
  );
}

export function parseTier(rawTier: unknown): number | null {
  if (
    typeof rawTier === "number" &&
    ALLOWED_TIERS.includes(rawTier as (typeof ALLOWED_TIERS)[number])
  ) {
    return rawTier;
  }
  if (typeof rawTier === "string") {
    const parsed = Number.parseInt(rawTier, 10);
    if (ALLOWED_TIERS.includes(parsed as (typeof ALLOWED_TIERS)[number])) return parsed;
  }
  return null;
}

export function normalizeAndAppendTier(value: string, tier: number): string {
  const cleaned = String(value).replace(buildTierSuffixRegex(), "");
  return `${cleaned} T${tier}`;
}

export function deriveCategory(attributes: NftAttribute[]): string {
  for (const rule of CATEGORY_RULES) {
    const allOfMatch = rule.allOf
      ? rule.allOf.every((entry) => hasTrait(attributes, entry.trait_type, entry.value))
      : true;
    const anyOfMatch = rule.anyOf
      ? rule.anyOf.some((entry) => hasTrait(attributes, entry.trait_type, entry.value))
      : true;

    if (allOfMatch && anyOfMatch) {
      return rule.label;
    }
  }

  return "Uncategorized";
}
