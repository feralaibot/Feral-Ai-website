import { clusterApiUrl } from "@solana/web3.js";

export function getSolanaRpcUrl() {
  const explicit = import.meta.env.VITE_SOLANA_RPC_URL?.trim();
  if (explicit) return explicit;

  const helius = import.meta.env.VITE_HELIUS_RPC_URL?.trim();
  if (helius) return helius;

  const heliusKey = import.meta.env.VITE_HELIUS_API_KEY?.trim();
  if (heliusKey) return `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;

  return clusterApiUrl("mainnet-beta");
}
