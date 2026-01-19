import { useWallet } from "@/hooks/use-wallet";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { Lock, Download, Star, ShieldCheck, Crown } from "lucide-react";

export default function Portal() {
  const { isConnected, isVerified, verificationStatus, verify, accessTier, holdings } = useWallet();
  const hasAccess = isConnected && isVerified && holdings.hasNft && holdings.hasToken;

  return (
    <div className="h-full relative min-h-[600px]">
      
      {/* Background Video/Effect Placeholder */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-950/20 via-black to-black -z-20" />
      
      {!hasAccess ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-4">
          <div className="max-w-md w-full bg-black/80 backdrop-blur-xl border border-red-500/30 p-8 text-center relative overflow-hidden clip-corner">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
            
            <Lock className="w-16 h-16 text-red-500 mx-auto mb-6 animate-pulse" />
            
            <h1 className="text-3xl font-display font-black text-red-500 mb-2 tracking-widest animate-glitch-skew">
              ACCESS DENIED
            </h1>
            
            <p className="text-muted-foreground font-tech mb-8 leading-relaxed">
              This sector is restricted to FERAL holders. Connect a wallet holding both the required NFT and token to bypass security.
            </p>

            {!isConnected ? (
              <WalletConnectButton className="w-full py-4 bg-red-500 text-black font-bold uppercase tracking-widest hover:bg-red-400 transition-colors clip-corner" />
            ) : !isVerified ? (
              <button
                onClick={verify}
                disabled={verificationStatus === "verifying"}
                className="w-full py-4 bg-white/10 text-white font-bold uppercase tracking-widest hover:bg-white/20 transition-colors clip-corner disabled:opacity-60"
              >
                {verificationStatus === "verifying" ? "Verifying..." : "Verify Access"}
              </button>
            ) : (
              <div className="p-4 border border-red-500/20 bg-red-500/5 text-red-500/80 font-mono text-xs">
                ERROR: NO_ASSET_DETECTED
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-700">
          <header className="border-b border-white/10 pb-6">
            <h1 className="text-4xl font-display uppercase tracking-widest text-white flex items-center gap-3">
              VIP <span className="text-accent">Portal</span> <Crown className="w-8 h-8 text-accent" />
            </h1>
            {accessTier === "legendary" && (
              <div className="mt-3 inline-flex items-center gap-2 border border-accent/60 bg-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.4em] text-accent">
                Legendary Status
              </div>
            )}
            <p className="text-muted-foreground font-tech">
              Welcome back, Holder. Your tier grants you the following privileges.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {/* Perk Card 1 */}
             <div className="bg-card border border-white/10 p-6 group hover:border-accent/50 transition-colors">
               <div className="w-12 h-12 bg-accent/10 flex items-center justify-center mb-4">
                 <Download className="w-6 h-6 text-accent" />
               </div>
               <h3 className="text-xl font-display mb-2">High-Res Assets</h3>
               <p className="text-sm text-muted-foreground mb-6">Download original 4K renders and 3D models of your Feral.</p>
               <button className="w-full py-2 border border-white/20 hover:bg-white/5 text-xs font-bold uppercase tracking-widest transition-colors">
                 Access Library
               </button>
             </div>

             {/* Perk Card 2 */}
             <div className="bg-card border border-white/10 p-6 group hover:border-accent/50 transition-colors">
               <div className="w-12 h-12 bg-accent/10 flex items-center justify-center mb-4">
                 <ShieldCheck className="w-6 h-6 text-accent" />
               </div>
               <h3 className="text-xl font-display mb-2">Alpha Access</h3>
               <p className="text-sm text-muted-foreground mb-6">Priority testing for upcoming protocol upgrades and games.</p>
               <button className="w-full py-2 border border-white/20 hover:bg-white/5 text-xs font-bold uppercase tracking-widest transition-colors">
                 View Schedule
               </button>
             </div>

             {/* Perk Card 3 */}
             <div className="bg-card border border-white/10 p-6 group hover:border-accent/50 transition-colors">
               <div className="w-12 h-12 bg-accent/10 flex items-center justify-center mb-4">
                 <Star className="w-6 h-6 text-accent" />
               </div>
               <h3 className="text-xl font-display mb-2">Allowlist Spots</h3>
               <p className="text-sm text-muted-foreground mb-6">Guaranteed mint spots for partner projects.</p>
               <button className="w-full py-2 border border-white/20 hover:bg-white/5 text-xs font-bold uppercase tracking-widest transition-colors">
                 Claim Spots
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
