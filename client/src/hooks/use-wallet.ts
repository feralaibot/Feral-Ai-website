import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import bs58 from "bs58";
import { api } from "@shared/routes";
import { buildApiUrl } from "@/lib/api";
import { clearSession, setSession } from "@/lib/session";

type Holdings = {
  hasNft: boolean;
  hasToken: boolean;
};

type AccessTier = "none" | "standard" | "legendary";

type VerificationStatus = "idle" | "verifying" | "verified" | "failed";

type CachedVerification = {
  publicKey: string;
  timestamp: number;
  holdings: Holdings;
  accessTier: AccessTier;
  isEligible: boolean;
  session: {
    token: string;
    expiresAt: number;
  };
};

const VERIFY_CACHE_KEY = "feral_wallet_verification";
const VERIFY_CACHE_TTL_MS = 5 * 60 * 1000;

let inFlightKey: string | null = null;
let inFlightVerification: Promise<CachedVerification> | null = null;
let cachedVerification: CachedVerification | null = null;

function readVerificationCache(publicKey: string) {
  if (
    cachedVerification &&
    cachedVerification.publicKey === publicKey &&
    Date.now() - cachedVerification.timestamp < VERIFY_CACHE_TTL_MS &&
    cachedVerification.session.expiresAt > Date.now()
  ) {
    return cachedVerification;
  }

  try {
    const raw = sessionStorage.getItem(VERIFY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedVerification;
    if (
      parsed?.publicKey === publicKey &&
      typeof parsed.timestamp === "number" &&
      Date.now() - parsed.timestamp < VERIFY_CACHE_TTL_MS &&
      parsed.session?.expiresAt > Date.now()
    ) {
      cachedVerification = parsed;
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function writeVerificationCache(payload: CachedVerification) {
  cachedVerification = payload;
  try {
    sessionStorage.setItem(VERIFY_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures; in-memory cache still helps.
  }
}

export function useWallet() {
  const { publicKey, connected, disconnect, signMessage } = useSolanaWallet();
  const { setVisible } = useWalletModal();

  const [holdings, setHoldings] = useState<Holdings>({ hasNft: false, hasToken: false });
  const [accessTier, setAccessTier] = useState<AccessTier>("none");
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("idle");
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isEligible, setIsEligible] = useState(false);
  const [lastVerifiedKey, setLastVerifiedKey] = useState<string | null>(null);

  const walletAddress = useMemo(() => (publicKey ? publicKey.toBase58() : null), [publicKey]);

  const fetchNonce = useCallback(async (publicKeyBase58: string) => {
    const url = new URL(buildApiUrl(api.wallet.nonce.path));
    url.searchParams.set("publicKey", publicKeyBase58);
    const res = await fetch(url.toString());
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || "Nonce request failed");
    }
    return api.wallet.nonce.responses[200].parse(await res.json());
  }, []);

  const verify = useCallback(async () => {
    if (!publicKey) return;
    const publicKeyBase58 = publicKey.toBase58();

    const cached = readVerificationCache(publicKeyBase58);
    if (cached) {
      setHoldings(cached.holdings);
      setIsEligible(cached.isEligible);
      setAccessTier(cached.accessTier);
      setVerificationStatus("verified");
      setVerificationError(null);
      setLastVerifiedKey(cached.publicKey);
      setSession(cached.session);
      return;
    }

    if (!signMessage) {
      setVerificationStatus("failed");
      setVerificationError("Connected wallet does not support message signing.");
      setHoldings({ hasNft: false, hasToken: false });
      setAccessTier("none");
      setIsEligible(false);
      return;
    }

    setVerificationStatus("verifying");
    setVerificationError(null);

    try {
      if (inFlightVerification && inFlightKey === publicKeyBase58) {
        const payload = await inFlightVerification;
        setHoldings(payload.holdings);
        setIsEligible(payload.isEligible);
        setAccessTier(payload.accessTier);
        setVerificationStatus("verified");
        setLastVerifiedKey(payload.publicKey);
        return;
      }

      inFlightKey = publicKeyBase58;
      inFlightVerification = (async () => {
        const noncePayload = await fetchNonce(publicKeyBase58);
        const nonce = noncePayload.nonce;
        const message = [
          "FERAL Wallet Verification",
          `Address: ${publicKeyBase58}`,
          `Nonce: ${nonce}`,
          `Issued At: ${new Date().toISOString()}`,
        ].join("\n");

        const encoded = new TextEncoder().encode(message);
        const signature = await signMessage(encoded);

        const res = await fetch(buildApiUrl(api.wallet.verify.path), {
          method: api.wallet.verify.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey: publicKeyBase58,
            message,
            signature: bs58.encode(signature),
          }),
        });

        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.message || "Verification failed");
        }

        const payload = api.wallet.verify.responses[200].parse(await res.json());
        setSession(payload.session);
        const cachedPayload: CachedVerification = {
          publicKey: publicKeyBase58,
          timestamp: Date.now(),
          holdings: payload.holdings,
          accessTier: payload.accessTier,
          isEligible: payload.isEligible,
          session: payload.session,
        };
        writeVerificationCache(cachedPayload);
        return cachedPayload;
      })();

      const payload = await inFlightVerification;
      setHoldings(payload.holdings);
      setIsEligible(payload.isEligible);
      setAccessTier(payload.accessTier);
      setVerificationStatus("verified");
      setLastVerifiedKey(payload.publicKey);
    } catch (error) {
      setVerificationStatus("failed");
      setVerificationError(error instanceof Error ? error.message : "Verification failed");
      setHoldings({ hasNft: false, hasToken: false });
      setAccessTier("none");
      setIsEligible(false);
    } finally {
      if (inFlightKey === publicKeyBase58) {
        inFlightKey = null;
        inFlightVerification = null;
      }
    }
  }, [publicKey, signMessage]);

  useEffect(() => {
    if (!connected) {
      setHoldings({ hasNft: false, hasToken: false });
      setAccessTier("none");
      setVerificationStatus("idle");
      setVerificationError(null);
      setIsEligible(false);
      setLastVerifiedKey(null);
      clearSession();
      return;
    }

    if (publicKey && lastVerifiedKey !== publicKey.toBase58()) {
      void verify();
    }
  }, [connected, publicKey, lastVerifiedKey, verify]);

  const connect = useCallback(() => setVisible(true), [setVisible]);

  return {
    isConnected: connected,
    walletAddress,
    holdings,
    accessTier,
    isVerified: verificationStatus === "verified",
    isEligible,
    verificationStatus,
    verificationError,
    connect,
    disconnect,
    verify,
  };
}
