import { useState } from "react";
import { Loader2, Scan, ShieldCheck, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useWallet } from "@/hooks/use-wallet";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { cn } from "@/lib/utils";
import { api } from "@shared/routes";
import { buildApiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/session";

type TokenInfo = {
  mint: string;
  amount: number;
  decimals: number;
};

type Snapshot = {
  address: string;
  tokens: TokenInfo[];
  nfts: Array<{ mint: string }>;
  solBalance?: number;
  totalTokenAccounts: number;
  distinctTokenMints: number;
  nftCount: number;
};

type Reputation = {
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

export default function WalletScan() {
  const { isConnected, isVerified, isEligible, verificationStatus, verify, walletAddress } = useWallet();
  const [walletInput, setWalletInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [reputation, setReputation] = useState<Reputation | null>(null);

  const resetResults = () => {
    setSnapshot(null);
    setReputation(null);
  };

  const handleAnalyze = async () => {
    setError(null);
    resetResults();

    const address = walletInput.trim();
    if (!address) {
      setError("Enter a valid Solana address.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const url = buildApiUrl(api.wallet.scan.path);
      const res = await fetch(`${url}?publicKey=${encodeURIComponent(address)}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || `Request failed (${res.status})`);
      }
      const payload = api.wallet.scan.responses[200].parse(await res.json());
      setSnapshot(payload.snapshot as Snapshot);
      setReputation(payload.reputation as Reputation);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error.";
      setError(`Failed to fetch wallet data. ${msg}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <Scan className="w-16 h-16 text-muted-foreground mb-6 opacity-20" />
        <h2 className="text-2xl font-display uppercase tracking-widest mb-2">Wallet Scan Offline</h2>
        <p className="text-muted-foreground font-tech mb-8">
          Establish neural link (Connect Wallet) to run the scan.
        </p>
        <WalletConnectButton className="px-6 py-3 bg-primary text-black font-bold uppercase tracking-widest hover:bg-white transition-all clip-corner" />
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <Scan className="w-16 h-16 text-muted-foreground mb-6 opacity-20" />
        <h2 className="text-2xl font-display uppercase tracking-widest mb-2">Verification Required</h2>
        <p className="text-muted-foreground font-tech mb-8">
          Sign the access request to unlock Wallet Scan.
        </p>
        <button
          onClick={verify}
          disabled={verificationStatus === "verifying"}
          className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold uppercase tracking-widest transition-all clip-corner disabled:opacity-60"
        >
          {verificationStatus === "verifying" ? "Verifying..." : "Verify Access"}
        </button>
      </div>
    );
  }

  if (!isEligible) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <Scan className="w-16 h-16 text-muted-foreground mb-6 opacity-20" />
        <h2 className="text-2xl font-display uppercase tracking-widest mb-2">Access Restricted</h2>
        <p className="text-muted-foreground font-tech mb-8">
          Required NFT or token holdings not detected in this wallet.
        </p>
      </div>
    );
  }

  const isEmpty = snapshot && snapshot.totalTokenAccounts === 0 && snapshot.nftCount === 0;
  const scoreBar = reputation
    ? Math.min(100, Math.max(0, ((reputation.score + 60) / 85) * 100))
    : 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 border-b border-white/10 pb-6">
        <div className="flex items-center gap-3 text-primary font-tech uppercase tracking-[0.3em] text-[10px]">
          <ShieldCheck className="w-4 h-4" /> Off-chain Wallet Recognition Protocol
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <h1 className="text-3xl md:text-4xl font-display uppercase tracking-widest text-white">
            Wallet <span className="text-primary">Scan</span>
          </h1>
        </div>
        <p className="text-muted-foreground font-tech max-w-2xl">
          Snapshot SPL + NFT holdings and generate a quick FERAL Score for any wallet.
        </p>
      </header>

      <section className="glass-panel p-6 md:p-8 space-y-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,240,255,0.08),transparent_60%)] pointer-events-none" />
        <div className="relative space-y-3">
          <label className="text-xs font-tech uppercase tracking-[0.3em] text-muted-foreground">
            Wallet Address
          </label>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              value={walletInput}
              onChange={(event) => setWalletInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleAnalyze();
                }
              }}
              placeholder="Paste a Solana wallet address"
              className="flex-1 bg-black/40 border border-white/10 px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-primary/60"
            />
            <div className="flex gap-3">
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className={cn(
                  "px-6 py-3 bg-primary text-black font-bold uppercase tracking-widest clip-corner transition-all",
                  "hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed",
                )}
              >
                {isAnalyzing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analyzing
                  </span>
                ) : (
                  "Analyze Wallet"
                )}
              </button>
              {walletAddress && (
                <button
                  onClick={() => setWalletInput(walletAddress)}
                  className="px-4 py-3 bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest text-white hover:bg-white/10 transition-all"
                >
                  Use Connected
                </button>
              )}
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-400 font-tech uppercase tracking-widest">
              {error}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-6">
        {!snapshot && !isAnalyzing && (
          <div className="glass-panel p-8 text-center text-muted-foreground font-tech">
            Run a scan to generate a wallet snapshot and rating.
          </div>
        )}

        {isAnalyzing && (
          <div className="glass-panel p-8 text-center text-primary font-tech uppercase tracking-widest">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            Reading token accounts...
          </div>
        )}

        {isEmpty && (
          <div className="glass-panel p-8 text-center text-muted-foreground font-tech">
            No SPL tokens or NFTs detected for this wallet.
          </div>
        )}

        {snapshot && reputation && !isEmpty && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6"
          >
            <div className="glass-panel p-6 md:p-7 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-tech uppercase tracking-[0.2em] text-muted-foreground">
                    Reputation Score
                  </p>
                  <div className="text-4xl font-display text-white">
                    {reputation.score.toFixed(1)}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs font-tech uppercase tracking-[0.2em] text-muted-foreground">Label</p>
                  <div className="text-3xl font-display text-primary">{reputation.label.label}</div>
                </div>
              </div>
              <div className="h-2 bg-white/10">
                <div
                  className="h-2 bg-gradient-to-r from-primary to-accent"
                  style={{ width: `${scoreBar}%` }}
                />
              </div>
              <div className="text-sm font-tech uppercase tracking-widest text-white">
                {reputation.label.meaning}
              </div>
              <div className="text-xs font-mono text-muted-foreground break-all">
                Wallet: {snapshot.address}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "SOL Balance", value: (snapshot.solBalance ?? 0).toFixed(4) },
                { label: "Token Accounts", value: snapshot.totalTokenAccounts },
                { label: "Distinct Mints", value: snapshot.distinctTokenMints },
                { label: "NFT Count", value: snapshot.nftCount },
                { label: "Wallet Age (days)", value: reputation.metrics.walletAgeDays.toFixed(1) },
                { label: "Active Weeks", value: reputation.metrics.activeWeeks },
                { label: "Activity Consistency", value: reputation.metrics.activityConsistency.toFixed(2) },
                { label: "Median Hold (days)", value: reputation.metrics.medianHoldDays?.toFixed(1) ?? "n/a" },
                { label: "Flip Rate", value: reputation.metrics.flipRate !== null ? reputation.metrics.flipRate.toFixed(2) : "n/a" },
                { label: "Legit App Touches", value: reputation.metrics.allowlistedSourceCount },
                { label: "Unique Legit Apps", value: reputation.metrics.uniqueAllowlistedSources },
                { label: "Mint & Dump Count", value: reputation.metrics.mintAndDumpCount },
                { label: "Outbound Ratio", value: reputation.metrics.outboundRatio !== null ? reputation.metrics.outboundRatio.toFixed(2) : "n/a" },
              ].map((metric) => (
                <div key={metric.label} className="glass-panel p-4">
                  <p className="text-[10px] font-tech uppercase tracking-[0.2em] text-muted-foreground">
                    {metric.label}
                  </p>
                  <div className="text-xl font-display text-white">{metric.value}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </section>
    </div>
  );
}
