import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import nacl from "tweetnacl";
import fs from "fs/promises";
import path from "path";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY?.trim();
const HELIUS_API_BASE = (process.env.HELIUS_API_BASE?.trim() || "https://api-mainnet.helius-rpc.com").replace(/\/+$/, "");
const RPC_URL =
  (HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
    : process.env.SOLANA_RPC_URL) || "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

const requiredNftMints = (process.env.REQUIRED_NFT_MINTS || "")
  .split(",")
  .map((mint) => mint.trim())
  .filter(Boolean);

const requiredTokenMint = process.env.REQUIRED_TOKEN_MINT?.trim() || "";
const requiredTokenMin = Number.parseFloat(process.env.REQUIRED_TOKEN_MIN || "1");

type Holdings = {
  hasNft: boolean;
  hasToken: boolean;
};

type AccessTier = "none" | "standard" | "legendary";

type Requirements = {
  requiresNft: boolean;
  requiresToken: boolean;
};

type AllowedAssetsConfig = {
  feralCollections: string[];
  milkCollections: string[];
};

type WalletReputationConfig = {
  allowlist: {
    marketplaces: string[];
    defi_programs_or_apps: string[];
    infra_tooling: string[];
    reputable_collections_tier_A: string[];
    reputable_collections_tier_B: string[];
  };
  denylist: {
    source_terms: string[];
    program_ids: string[];
    hard_negative_terms: string[];
    behavioral_rules: {
      fresh_wallet_under_days: number;
      mint_and_dump_under_minutes: number;
      high_outbound_rate_threshold: number;
    };
  };
  labels: Array<{
    id: string;
    label: string;
    meaning: string;
  }>;
  label_thresholds: Array<{
    min_score: number;
    label_id: string;
  }>;
};

export type AllowedAsset = {
  id: string;
  name: string;
  image: string | null;
  collection: string | null;
};

const ALLOWED_ASSETS_PATH = path.resolve(
  import.meta.dirname,
  "config",
  "allowed-assets.json",
);
const WALLET_REPUTATION_PATH = path.resolve(
  import.meta.dirname,
  "config",
  "wallet-reputation.json",
);

async function loadAllowedAssetsConfig(): Promise<AllowedAssetsConfig> {
  try {
    const raw = await fs.readFile(ALLOWED_ASSETS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as AllowedAssetsConfig;
    return {
      feralCollections: Array.isArray(parsed.feralCollections) ? parsed.feralCollections : [],
      milkCollections: Array.isArray(parsed.milkCollections) ? parsed.milkCollections : [],
    };
  } catch {
    return { feralCollections: [], milkCollections: [] };
  }
}

async function loadWalletReputationConfig(): Promise<WalletReputationConfig> {
  try {
    const raw = await fs.readFile(WALLET_REPUTATION_PATH, "utf-8");
    return JSON.parse(raw) as WalletReputationConfig;
  } catch {
    return {
      allowlist: {
        marketplaces: [],
        defi_programs_or_apps: [],
        infra_tooling: [],
        reputable_collections_tier_A: [],
        reputable_collections_tier_B: [],
      },
      denylist: {
        source_terms: [],
        program_ids: [],
        hard_negative_terms: [],
        behavioral_rules: {
          fresh_wallet_under_days: 7,
          mint_and_dump_under_minutes: 60,
          high_outbound_rate_threshold: 0.7,
        },
      },
      labels: [],
      label_thresholds: [],
    };
  }
}

async function fetchHeliusAssetsRpc(publicKey: string) {
  const body = {
    jsonrpc: "2.0",
    id: "helius-assets",
    method: "getAssetsByOwner",
    params: {
      ownerAddress: publicKey,
      page: 1,
      limit: 1000,
    },
  };
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Helius RPC assets fetch failed: ${res.status}`);
  }

  const json = await res.json();
  if (json?.error) {
    const message = json.error?.message || json.error?.code || "Unknown error";
    throw new Error(`Helius RPC assets fetch failed: ${message}`);
  }

  return { items: Array.isArray(json?.result?.items) ? json.result.items : [] };
}

async function fetchHeliusAssets(publicKey: string) {
  if (!HELIUS_API_KEY) {
    throw new Error("HELIUS_API_KEY is not configured");
  }

  const url = new URL(`${HELIUS_API_BASE}/v0/addresses/${publicKey}/assets`);
  url.searchParams.set("api-key", HELIUS_API_KEY);
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", "1000");

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Helius assets fetch failed: ${res.status}`);
    }
    return (await res.json()) as Promise<{ items: any[] }>;
  } catch (error) {
    return fetchHeliusAssetsRpc(publicKey);
  }
}

async function fetchHeliusTransactions(publicKey: string, before?: string, limit = 100) {
  if (!HELIUS_API_KEY) {
    throw new Error("HELIUS_API_KEY is not configured");
  }

  const url = new URL(`${HELIUS_API_BASE}/v0/addresses/${publicKey}/transactions`);
  url.searchParams.set("api-key", HELIUS_API_KEY);
  url.searchParams.set("limit", String(limit));
  if (before) {
    url.searchParams.set("before", before);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Helius transactions fetch failed: ${res.status}`);
  }
  const json = await res.json();
  if (!Array.isArray(json)) {
    throw new Error("Helius transactions response invalid");
  }
  return json as any[];
}

async function fetchAllTransactions(publicKey: string) {
  const transactions: any[] = [];
  let before: string | undefined;
  const maxPages = 20;

  for (let page = 0; page < maxPages; page += 1) {
    const batch = await fetchHeliusTransactions(publicKey, before);
    if (batch.length === 0) break;
    transactions.push(...batch);
    before = batch[batch.length - 1]?.signature;
    if (!before) break;
  }

  return transactions;
}

function normalizeMatchKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function matchesTerms(value: string, terms: string[]) {
  if (!value) return false;
  const normalizedValue = normalizeMatchKey(value);
  return terms.some((term) => normalizedValue.includes(normalizeMatchKey(term)));
}

function getTransactionTimestamp(tx: any): number | null {
  if (typeof tx?.timestamp === "number") {
    return tx.timestamp * 1000;
  }
  if (typeof tx?.blockTime === "number") {
    return tx.blockTime * 1000;
  }
  return null;
}

function getWeekKey(timestampMs: number) {
  const date = new Date(timestampMs);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((timestampMs - yearStart.getTime()) / 86400000);
  const week = Math.floor(dayOfYear / 7) + 1;
  return `${date.getUTCFullYear()}-W${week}`;
}

function extractCollectionAddress(asset: any): string | null {
  const grouping = Array.isArray(asset?.grouping) ? asset.grouping : [];
  const collection = grouping.find((group: any) => group?.group_key === "collection");
  return typeof collection?.group_value === "string" ? collection.group_value : null;
}

function extractImageUrl(asset: any): string | null {
  const content = asset?.content;
  const linksImage = typeof content?.links?.image === "string" ? content.links.image : null;
  if (linksImage) return linksImage;

  const files = Array.isArray(content?.files) ? content.files : [];
  const firstFile = files.find((file: any) => typeof file?.uri === "string");
  return firstFile?.uri ?? null;
}

function normalizeCollectionSet(values: string[]) {
  return new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function isNftAsset(asset: any): boolean {
  const interfaceType = typeof asset?.interface === "string" ? asset.interface.toLowerCase() : "";
  if (interfaceType.includes("nft") || interfaceType.includes("compressed")) {
    return true;
  }
  if (asset?.compression?.compressed === true) {
    return true;
  }
  return false;
}

export async function fetchAllowedAssets(publicKey: string): Promise<{
  ferals: AllowedAsset[];
  milk: AllowedAsset[];
}> {
  const config = await loadAllowedAssetsConfig();
  const feralSet = normalizeCollectionSet(config.feralCollections);
  const milkSet = normalizeCollectionSet(config.milkCollections);

  if (feralSet.size === 0 && milkSet.size === 0) {
    return { ferals: [], milk: [] };
  }

  const { items } = await fetchHeliusAssets(publicKey);

  const mapped = (items || []).map((asset: any): AllowedAsset => ({
    id: String(asset?.id ?? ""),
    name: String(asset?.content?.metadata?.name ?? "Unknown Asset"),
    image: extractImageUrl(asset),
    collection: extractCollectionAddress(asset),
  }));

  const ferals = mapped.filter((asset) =>
    asset.collection && feralSet.has(asset.collection.toLowerCase()),
  );
  const milk = mapped.filter((asset) =>
    asset.collection && milkSet.has(asset.collection.toLowerCase()),
  );

  return { ferals, milk };
}

type WalletSnapshot = {
  address: string;
  tokens: Array<{ mint: string; amount: number; decimals: number }>;
  nfts: Array<{ mint: string }>;
  solBalance: number;
  totalTokenAccounts: number;
  distinctTokenMints: number;
  nftCount: number;
};

export async function fetchWalletSnapshot(publicKey: string): Promise<WalletSnapshot> {
  const owner = new PublicKey(publicKey);
  const [tokenAccounts, token2022Accounts, balanceLamports] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    }),
    connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    connection.getBalance(owner),
  ]);

  const accounts = [...tokenAccounts.value, ...token2022Accounts.value];
  const tokens: Array<{ mint: string; amount: number; decimals: number }> = [];
  const nfts: Array<{ mint: string }> = [];
  const nftMints = new Set<string>();

  for (const { account } of accounts) {
    const info = account?.data?.parsed?.info;
    const tokenAmount = info?.tokenAmount;
    if (!tokenAmount) continue;

    const decimals = Number(tokenAmount.decimals);
    const uiAmount = Number(tokenAmount.uiAmountString ?? tokenAmount.uiAmount ?? 0);
    const mint = String(info.mint);

    if (decimals === 0 && uiAmount === 1) {
      nfts.push({ mint });
      nftMints.add(mint.toLowerCase());
    } else if (decimals >= 0 && uiAmount > 0) {
      tokens.push({ mint, amount: uiAmount, decimals });
    }
  }

  if (HELIUS_API_KEY) {
    try {
      const { items } = await fetchHeliusAssets(publicKey);
      for (const asset of items || []) {
        if (!isNftAsset(asset)) continue;
        const assetId = String(asset?.id ?? asset?.mint ?? "").trim();
        if (!assetId) continue;
        const normalized = assetId.toLowerCase();
        if (nftMints.has(normalized)) continue;
        nfts.push({ mint: assetId });
        nftMints.add(normalized);
      }
    } catch (error) {
      console.warn("Helius assets scan failed", error);
    }
  }

  return {
    address: owner.toBase58(),
    tokens,
    nfts,
    solBalance: balanceLamports / 1_000_000_000,
    totalTokenAccounts: accounts.length,
    distinctTokenMints: new Set(tokens.map((token) => token.mint)).size,
    nftCount: nfts.length,
  };
}

type WalletReputation = {
  score: number;
  label: {
    id: string;
    label: string;
    meaning: string;
  };
  metrics: {
    walletAgeDays: number;
    totalTxCount: number;
    activeWeeks: number;
    activityConsistency: number;
    medianHoldDays: number | null;
    flipRate: number | null;
    allowlistedSourceCount: number;
    uniqueAllowlistedSources: number;
    mintAndDumpCount: number;
    outboundRatio: number | null;
  };
};

export async function fetchWalletReputation(publicKey: string): Promise<{
  snapshot: WalletSnapshot;
  reputation: WalletReputation;
}> {
  const [snapshot, config, transactions] = await Promise.all([
    fetchWalletSnapshot(publicKey),
    loadWalletReputationConfig(),
    fetchAllTransactions(publicKey),
  ]);

  const allowlistTerms = [
    ...config.allowlist.marketplaces,
    ...config.allowlist.defi_programs_or_apps,
    ...config.allowlist.infra_tooling,
  ];
  const denylistTerms = config.denylist.source_terms;
  const hardNegativeTerms = config.denylist.hard_negative_terms;

  const nowMs = Date.now();
  const walletKey = publicKey.toLowerCase();
  const timestamps = transactions
    .map(getTransactionTimestamp)
    .filter((value): value is number => typeof value === "number");

  const totalTxCount = transactions.length;
  const oldestTimestamp = timestamps.length ? Math.min(...timestamps) : null;
  const walletAgeDays = oldestTimestamp ? (nowMs - oldestTimestamp) / 86400000 : 0;

  const activeWeeks = new Set(timestamps.map(getWeekKey)).size;
  const totalWeeks = Math.max(1, Math.ceil(walletAgeDays / 7));
  const activityConsistency = totalWeeks ? Math.min(1, activeWeeks / totalWeeks) : 0;

  const allowlistedMatches = new Set<string>();
  let allowlistedSourceCount = 0;
  let denylistHit = false;
  let hardNegativeHit = false;
  let outboundTransfers = 0;
  let inboundTransfers = 0;

  const nftHoldMap = new Map<string, { firstIn?: number; firstOutAfterIn?: number }>();
  let mintAndDumpCount = 0;

  const mintDumpThresholdMs =
    config.denylist.behavioral_rules.mint_and_dump_under_minutes * 60 * 1000;

  for (const tx of transactions) {
    const source = String(tx?.source ?? "");
    const description = String(tx?.description ?? "");
    const matchedAllowlist = matchesTerms(source, allowlistTerms) || matchesTerms(description, allowlistTerms);
    if (matchedAllowlist) {
      allowlistedSourceCount += 1;
      const matchTerm =
        allowlistTerms.find((term) => matchesTerms(source, [term]) || matchesTerms(description, [term])) ?? source;
      allowlistedMatches.add(matchTerm);
    }

    if (matchesTerms(source, denylistTerms) || matchesTerms(description, denylistTerms)) {
      denylistHit = true;
    }
    if (matchesTerms(source, hardNegativeTerms) || matchesTerms(description, hardNegativeTerms)) {
      hardNegativeHit = true;
    }

    const txTimestamp = getTransactionTimestamp(tx);
    if (!txTimestamp) continue;

    const transfers = Array.isArray(tx?.tokenTransfers) ? tx.tokenTransfers : [];
    for (const transfer of transfers) {
      const mint = String(transfer?.mint ?? "");
      if (!mint) continue;

      const from = String(transfer?.fromUserAccount ?? "").toLowerCase();
      const to = String(transfer?.toUserAccount ?? "").toLowerCase();

      const rawAmount = transfer?.tokenAmount ?? transfer?.amount ?? transfer?.tokenAmount?.amount;
      const rawDecimals = transfer?.decimals ?? transfer?.tokenAmount?.decimals;
      const amount = Number(rawAmount ?? 0);
      const decimals = Number(rawDecimals ?? 0);
      const isNft = Number.isFinite(decimals) && decimals === 0 && amount === 1;

      if (from === walletKey) outboundTransfers += 1;
      if (to === walletKey) inboundTransfers += 1;

      if (!isNft) continue;

      const record = nftHoldMap.get(mint) ?? {};
      if (to === walletKey) {
        record.firstIn = record.firstIn ? Math.min(record.firstIn, txTimestamp) : txTimestamp;
      }
      if (from === walletKey && record.firstIn) {
        record.firstOutAfterIn = record.firstOutAfterIn
          ? Math.min(record.firstOutAfterIn, txTimestamp)
          : txTimestamp;
      }
      nftHoldMap.set(mint, record);
    }
  }

  const holdDurations: number[] = [];
  for (const record of nftHoldMap.values()) {
    if (!record.firstIn) continue;
    const end = record.firstOutAfterIn ?? nowMs;
    const durationMs = Math.max(0, end - record.firstIn);
    if (record.firstOutAfterIn && durationMs <= mintDumpThresholdMs) {
      mintAndDumpCount += 1;
    }
    holdDurations.push(durationMs / 86400000);
  }

  holdDurations.sort((a, b) => a - b);
  const medianHoldDays =
    holdDurations.length === 0
      ? null
      : holdDurations[Math.floor(holdDurations.length / 2)];
  const flipRate =
    holdDurations.length === 0
      ? null
      : holdDurations.filter((value) => value < 1).length / holdDurations.length;

  const totalTransfers = inboundTransfers + outboundTransfers;
  const outboundRatio = totalTransfers > 0 ? outboundTransfers / totalTransfers : null;

  let score = 0;
  if (walletAgeDays >= 365) score += 8;
  else if (walletAgeDays >= 180) score += 6;
  else if (walletAgeDays >= 90) score += 4;
  else if (walletAgeDays >= 30) score += 2;
  else if (walletAgeDays > 0) score -= 6;

  if (walletAgeDays > 0 && walletAgeDays < config.denylist.behavioral_rules.fresh_wallet_under_days) {
    score -= 4;
  }

  if (activityConsistency >= 0.5) score += 6;
  else if (activityConsistency >= 0.25) score += 3;
  else if (activityConsistency >= 0.1) score += 1;
  else if (walletAgeDays >= 30) score -= 2;

  if (medianHoldDays !== null) {
    if (medianHoldDays >= 30) score += 6;
    else if (medianHoldDays >= 14) score += 4;
    else if (medianHoldDays >= 7) score += 2;
    else if (medianHoldDays < 1) score -= 6;
  }

  if (flipRate !== null) {
    if (flipRate >= 0.5) score -= 8;
    else if (flipRate >= 0.25) score -= 4;
  }

  if (allowlistedMatches.size >= 5) score += 6;
  else if (allowlistedMatches.size >= 2) score += 4;
  else if (allowlistedMatches.size >= 1) score += 2;

  if (mintAndDumpCount > 0) score -= 6;

  if (
    outboundRatio !== null &&
    outboundRatio > config.denylist.behavioral_rules.high_outbound_rate_threshold &&
    allowlistedMatches.size < 2
  ) {
    score -= 6;
  }

  if (denylistHit) score -= 8;

  if (hardNegativeHit) {
    score = -9999;
  }

  const labelMap = new Map(config.labels.map((label) => [label.id, label]));
  const thresholds = [...config.label_thresholds].sort((a, b) => b.min_score - a.min_score);
  const pickedThreshold = thresholds.find((threshold) => score >= threshold.min_score);
  const label =
    (pickedThreshold && labelMap.get(pickedThreshold.label_id)) ||
    labelMap.get("NEUTRAL_FERAL") || { id: "NEUTRAL_FERAL", label: "Neutral Feral", meaning: "Not enough signal either way." };

  return {
    snapshot,
    reputation: {
      score,
      label,
      metrics: {
        walletAgeDays: Number(walletAgeDays.toFixed(2)),
        totalTxCount,
        activeWeeks,
        activityConsistency: Number(activityConsistency.toFixed(2)),
        medianHoldDays: medianHoldDays ? Number(medianHoldDays.toFixed(2)) : null,
        flipRate: flipRate !== null ? Number(flipRate.toFixed(2)) : null,
        allowlistedSourceCount,
        uniqueAllowlistedSources: allowlistedMatches.size,
        mintAndDumpCount,
        outboundRatio: outboundRatio !== null ? Number(outboundRatio.toFixed(2)) : null,
      },
    },
  };
}

export function verifySignature(publicKey: string, message: string, signature: string): boolean {
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = bs58.decode(signature);
  const key = new PublicKey(publicKey);
  return nacl.sign.detached.verify(messageBytes, signatureBytes, key.toBytes());
}

export async function checkHoldings(publicKey: string): Promise<{
  holdings: Holdings;
  requirements: Requirements;
  isEligible: boolean;
  accessTier: AccessTier;
}> {
  const owner = new PublicKey(publicKey);
  const [tokenAccounts, token2022Accounts] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    }),
    connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_2022_PROGRAM_ID,
    }),
  ]);

  const balances = new Map<string, number>();
  for (const account of [...tokenAccounts.value, ...token2022Accounts.value]) {
    const info = account.account.data.parsed.info;
    const mint = String(info.mint);
    const amount = Number(info.tokenAmount.amount);
    const decimals = Number(info.tokenAmount.decimals);
    const uiAmount = decimals > 0 ? amount / Math.pow(10, decimals) : amount;
    balances.set(mint, (balances.get(mint) || 0) + uiAmount);
  }

  const requiresNft = requiredNftMints.length > 0;
  const requiresToken = Boolean(requiredTokenMint);

  const requiredNftSet = new Set(requiredNftMints.map((mint) => mint.toLowerCase()));
  const hasNftFromTokenAccounts = requiresNft
    ? requiredNftMints.some((mint) => (balances.get(mint) || 0) >= 1)
    : true;
  const hasToken = requiresToken
    ? (balances.get(requiredTokenMint) || 0) >= requiredTokenMin
    : true;

  let hasNft = hasNftFromTokenAccounts;
  if (requiresNft && !hasNft && HELIUS_API_KEY) {
    try {
      const { items } = await fetchHeliusAssets(publicKey);
      hasNft = (items || []).some((asset: any) => {
        const assetId = String(asset?.id ?? "").toLowerCase();
        const collection = extractCollectionAddress(asset)?.toLowerCase() ?? "";
        return requiredNftSet.has(assetId) || requiredNftSet.has(collection);
      });
    } catch (error) {
      console.warn("Helius NFT check failed", error);
    }
  }

  const isEligible = requiresNft && requiresToken
    ? hasNft || hasToken
    : requiresNft
      ? hasNft
      : requiresToken
        ? hasToken
        : true;

  const accessTier: AccessTier = hasNft && hasToken ? "legendary" : hasNft || hasToken ? "standard" : "none";

  return {
    holdings: { hasNft, hasToken },
    requirements: { requiresNft, requiresToken },
    isEligible,
    accessTier,
  };
}
