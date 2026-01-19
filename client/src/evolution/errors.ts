export type EvolutionErrorCode =
  | "missing-assets"
  | "invalid-tier"
  | "transaction-failure"
  | "malformed-metadata"
  | "ownership-failed";

const ERROR_MESSAGES: Record<EvolutionErrorCode, string> = {
  "missing-assets": "Missing required assets for evolution.",
  "invalid-tier": "Catalyst tier is invalid. Expected 1, 2, or 3.",
  "transaction-failure": "Evolution transaction failed. Please try again.",
  "malformed-metadata": "Metadata is malformed or missing attributes.",
  "ownership-failed": "Wallet does not own the required asset.",
};

export class EvolutionError extends Error {
  code: EvolutionErrorCode;

  constructor(code: EvolutionErrorCode, detail?: string) {
    super(detail ? `${ERROR_MESSAGES[code]} ${detail}` : ERROR_MESSAGES[code]);
    this.code = code;
  }
}
