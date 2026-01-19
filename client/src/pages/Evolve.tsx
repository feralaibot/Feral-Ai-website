import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/hooks/use-wallet";
import { useAssets } from "@/hooks/use-assets";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { cn } from "@/lib/utils";
import { ChevronRight, Dna, Zap, CheckCircle2, AlertTriangle } from "lucide-react";
import { ELIGIBLE_COLLECTION_FILTERS } from "@/evolution/config";
import { evolve } from "@/evolution/evolve";
import { EvolutionError } from "@/evolution/errors";
import { getStubAssetMetadata, getStubCatalystMetadata } from "@/evolution/stubs";
import type { EvolutionResult } from "@/evolution/types";

// Step Constants
const STEPS = [
  { id: 1, label: "Select Host" },
  { id: 2, label: "Inject Serum" },
  { id: 3, label: "Diagnostics" },
  { id: 4, label: "Execute" },
];

export default function Evolve() {
  const { isConnected, isVerified, isEligible, verificationStatus, verify, walletAddress } = useWallet();
  const { data: assets, isLoading: isAssetsLoading, error: assetsError } = useAssets(walletAddress);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFeralId, setSelectedFeralId] = useState<string | null>(null);
  const [selectedMilkId, setSelectedMilkId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [evolutionResult, setEvolutionResult] = useState<EvolutionResult | null>(null);
  const [evolutionError, setEvolutionError] = useState<string | null>(null);

  const ferals = assets?.ferals ?? [];
  const milk = assets?.milk ?? [];

  const filteredFerals = useMemo(() => {
    if (ELIGIBLE_COLLECTION_FILTERS.assetACollections.length === 0) return ferals;
    return ferals.filter((asset) =>
      ELIGIBLE_COLLECTION_FILTERS.assetACollections.includes(asset.collection ?? ""),
    );
  }, [ferals]);

  const filteredMilk = useMemo(() => {
    if (ELIGIBLE_COLLECTION_FILTERS.catalystCollections.length === 0) return milk;
    return milk.filter((asset) =>
      ELIGIBLE_COLLECTION_FILTERS.catalystCollections.includes(asset.collection ?? ""),
    );
  }, [milk]);

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep(c => c + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(c => c - 1);
  };

  const executeEvolution = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    setEvolutionError(null);

    try {
      if (!walletAddress) {
        throw new EvolutionError("missing-assets", "Wallet is not connected.");
      }

      const assetA = filteredFerals.find((asset) => asset.id === selectedFeralId);
      const catalystB = filteredMilk.find((asset) => asset.id === selectedMilkId);

      if (!assetA || !catalystB) {
        throw new EvolutionError("missing-assets");
      }

      const assetAMetadata = getStubAssetMetadata(assetA.name);
      const catalystMetadata = getStubCatalystMetadata(catalystB.name);

      const result = await evolve({
        assetA_mint: assetA.id,
        assetA_metadata: assetAMetadata,
        catalystB_mint: catalystB.id,
        catalystB_metadata: catalystMetadata,
        walletPublicKey: walletAddress,
      });

      setEvolutionResult(result);
    } catch (error) {
      if (error instanceof Error) {
        setEvolutionError(error.message);
      } else {
        setEvolutionError("Unexpected error during evolution.");
      }
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <Dna className="w-16 h-16 text-muted-foreground mb-6 opacity-20" />
        <h2 className="text-2xl font-display uppercase tracking-widest mb-2">Evolution Offline</h2>
        <p className="text-muted-foreground font-tech mb-8">Establish neural link (Connect Wallet) to proceed.</p>
        <WalletConnectButton className="px-6 py-3 bg-primary text-black font-bold uppercase tracking-widest hover:bg-white transition-all clip-corner" />
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <Dna className="w-16 h-16 text-muted-foreground mb-6 opacity-20" />
        <h2 className="text-2xl font-display uppercase tracking-widest mb-2">Verification Required</h2>
        <p className="text-muted-foreground font-tech mb-8">
          Sign the access request to unlock the Evolution Machine.
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
        <Dna className="w-16 h-16 text-muted-foreground mb-6 opacity-20" />
        <h2 className="text-2xl font-display uppercase tracking-widest mb-2">Access Restricted</h2>
        <p className="text-muted-foreground font-tech mb-8">
          Required NFT or token holdings not detected in this wallet.
        </p>
      </div>
    );
  }

  if (evolutionResult) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-8 border border-primary animate-pulse">
          <CheckCircle2 className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-4xl font-display text-primary mb-2 text-glow">EVOLUTION COMPLETE</h1>
        <p className="text-sm font-mono text-white mb-2">
          TX: {evolutionResult.txSignature}
        </p>
        <p className="text-sm font-mono text-white mb-8">
          NEW MINT: {evolutionResult.mutatedMint}
        </p>
        <button 
          onClick={() => {
            setEvolutionResult(null);
            setCurrentStep(1);
            setSelectedFeralId(null);
            setSelectedMilkId(null);
          }}
          className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold uppercase tracking-widest clip-corner transition-all"
        >
          Initialize New Sequence
        </button>
      </div>
    );
  }

  if (evolutionError) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center mb-8 border border-red-500/40">
          <AlertTriangle className="w-12 h-12 text-red-400" />
        </div>
        <h1 className="text-3xl font-display text-red-400 mb-2">EVOLUTION FAILED</h1>
        <p className="text-sm font-mono text-white/80 mb-8">{evolutionError}</p>
        <button
          onClick={() => setEvolutionError(null)}
          className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold uppercase tracking-widest clip-corner transition-all"
        >
          Return to Sequence
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <header className="border-b border-white/10 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display uppercase tracking-widest text-white flex items-center gap-3">
            Evolution <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Machine</span>
          </h1>
        </div>
        <div className="font-mono text-xs text-primary animate-pulse">
          SYSTEM_READY
        </div>
      </header>

      {/* Stepper Progress */}
      <div className="flex justify-between relative mb-12">
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/10 -z-10" />
        {STEPS.map((step) => {
          const isActive = step.id === currentStep;
          const isComplete = step.id < currentStep;
          return (
            <div key={step.id} className="flex flex-col items-center gap-2 bg-background px-2">
              <div className={cn(
                "w-8 h-8 rounded-none border flex items-center justify-center text-xs font-bold transition-all duration-500",
                isActive ? "border-primary bg-primary text-black scale-110 shadow-[0_0_15px_cyan]" : 
                isComplete ? "border-primary/50 bg-primary/20 text-primary" : "border-white/20 text-muted-foreground bg-black"
              )}>
                {isComplete ? <CheckCircle2 className="w-4 h-4" /> : step.id}
              </div>
              <span className={cn(
                "text-[10px] uppercase font-tech tracking-wider",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Main UI Area */}
      <div className="bg-card/50 border border-white/5 min-h-[400px] p-6 md:p-8 relative overflow-hidden backdrop-blur-md">
        {/* Background Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] -z-10" />

        <AnimatePresence mode="wait">
          {/* STEP 1: SELECT HOST */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-display text-white mb-6">Select Host Entity</h2>
              {isAssetsLoading ? (
                <div className="text-sm font-tech text-muted-foreground uppercase tracking-widest">Loading eligible assets...</div>
              ) : assetsError ? (
                <div className="text-sm font-tech text-red-400 uppercase tracking-widest">Failed to load assets.</div>
              ) : filteredFerals.length === 0 ? (
                <div className="text-sm font-tech text-muted-foreground uppercase tracking-widest">
                  No eligible FERAL assets found. Update the allowed collection list.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredFerals.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => setSelectedFeralId(asset.id)}
                      className={cn(
                        "aspect-[3/4] border transition-all duration-300 relative group overflow-hidden flex flex-col",
                        selectedFeralId === asset.id
                          ? "border-primary bg-primary/10 shadow-[0_0_20px_rgba(0,240,255,0.1)]" 
                          : "border-white/10 bg-black/40 hover:border-white/30"
                      )}
                    >
                      {asset.image ? (
                        <img src={asset.image} alt={asset.name} className="w-full h-full object-cover opacity-80" />
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground font-tech opacity-30 text-3xl font-bold">
                          FERAL
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-[10px] font-tech uppercase tracking-widest text-white/80">
                        {asset.name}
                      </div>
                      {selectedFeralId === asset.id && (
                        <div className="absolute top-0 left-0 right-0 bg-primary text-black text-[10px] font-bold py-1 text-center uppercase tracking-widest">
                          Selected
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 2: SELECT SERUM */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-display text-white mb-6">Select Catalytic Agent</h2>
              {ELIGIBLE_COLLECTION_FILTERS.catalystCollections.length === 0 && (
                <div className="text-xs font-tech uppercase tracking-widest text-yellow-400">
                  Catalyst collection not configured yet.
                </div>
              )}
              {isAssetsLoading ? (
                <div className="text-sm font-tech text-muted-foreground uppercase tracking-widest">Loading catalysts...</div>
              ) : assetsError ? (
                <div className="text-sm font-tech text-red-400 uppercase tracking-widest">Failed to load catalysts.</div>
              ) : filteredMilk.length === 0 ? (
                <div className="text-sm font-tech text-muted-foreground uppercase tracking-widest">
                  No eligible catalyst NFTs found. Update the allowed collection list.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {filteredMilk.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => setSelectedMilkId(asset.id)}
                      className={cn(
                        "h-40 border transition-all duration-300 relative group overflow-hidden flex flex-col items-center justify-center gap-2",
                        selectedMilkId === asset.id
                          ? "border-accent bg-accent/10 shadow-[0_0_20px_rgba(188,19,254,0.1)]" 
                          : "border-white/10 bg-black/40 hover:border-white/30"
                      )}
                    >
                      {asset.image ? (
                        <img src={asset.image} alt={asset.name} className="absolute inset-0 w-full h-full object-cover opacity-40" />
                      ) : null}
                      <div className={cn(
                        "w-12 h-12 rounded-full border-2 flex items-center justify-center relative z-10",
                        selectedMilkId === asset.id ? "border-accent text-accent" : "border-white/20 text-muted-foreground"
                      )}>
                        <Dna className="w-6 h-6" />
                      </div>
                      <span className={cn(
                        "font-display uppercase tracking-widest text-xs relative z-10 text-center px-2",
                        selectedMilkId === asset.id ? "text-accent" : "text-muted-foreground"
                      )}>{asset.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 3: DIAGNOSTICS */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-display text-white mb-6">Pre-Evolution Diagnostics</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-tech uppercase tracking-wider text-muted-foreground">
                      <span>Genetic Compatibility</span>
                      <span className="text-primary">98.4%</span>
                    </div>
                    <div className="h-1 bg-white/10 w-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }} animate={{ width: "98.4%" }} transition={{ duration: 1.5, ease: "circOut" }}
                        className="h-full bg-primary shadow-[0_0_10px_cyan]" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-tech uppercase tracking-wider text-muted-foreground">
                      <span>Mutation Volatility</span>
                      <span className="text-accent">High</span>
                    </div>
                    <div className="h-1 bg-white/10 w-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }} animate={{ width: "75%" }} transition={{ duration: 1.5, delay: 0.2, ease: "circOut" }}
                        className="h-full bg-accent shadow-[0_0_10px_purple]" 
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-tech uppercase tracking-wider text-muted-foreground">
                      <span>Neural Sync</span>
                      <span className="text-green-500">Stable</span>
                    </div>
                    <div className="h-1 bg-white/10 w-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 1, delay: 0.4 }}
                        className="h-full bg-green-500" 
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-primary/20 bg-primary/5 text-xs font-mono text-primary/80 leading-relaxed">
                  <p>{`> ANALYZING HOST ${selectedFeralId ? selectedFeralId.slice(0, 6) : "UNKNOWN"}... OK`}</p>
                  <p>{`> VERIFYING SERUM SIGNATURE... OK`}</p>
                  <p>{`> SIMULATING OUTCOME...`}</p>
                  <p className="mt-2 text-white">{`> PREDICTION: TIER 2 [AWAKENED] TRAITS LIKELY.`}</p>
                  <div className="mt-4 flex items-center gap-2 text-yellow-500">
                    <AlertTriangle className="w-3 h-3" />
                    <span>WARNING: PROCESS IS IRREVERSIBLE</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 4: EXECUTE */}
          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full py-12"
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                <button
                  onClick={executeEvolution}
                  disabled={isExecuting}
                  className="relative w-48 h-48 rounded-full border-4 border-primary/30 flex flex-col items-center justify-center bg-black hover:border-primary transition-all duration-300 group-hover:scale-105"
                >
                   {isExecuting ? (
                     <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent animate-spin" />
                   ) : (
                     <>
                      <Zap className="w-12 h-12 text-primary mb-2 group-hover:text-white transition-colors" />
                      <span className="font-display font-bold text-xl text-primary tracking-widest group-hover:text-white transition-colors">
                        INITIATE
                      </span>
                     </>
                   )}
                </button>
              </div>
              
              <div className="mt-8 text-center space-y-2">
                <p className="font-tech text-sm text-muted-foreground uppercase tracking-widest">
                  {isExecuting ? "REWRITING GENETIC CODE..." : "READY TO EVOLVE"}
                </p>
                {isExecuting && (
                  <div className="w-64 h-1 bg-white/10 mx-auto overflow-hidden">
                    <div className="h-full bg-primary animate-progress-indeterminate" />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4">
        <button
          onClick={handleBack}
          disabled={currentStep === 1 || isExecuting}
          className="px-6 py-3 border border-white/10 text-muted-foreground font-bold uppercase tracking-widest hover:bg-white/5 disabled:opacity-0 transition-all clip-corner"
        >
          Back
        </button>

        {currentStep < 4 && (
          <button
            onClick={handleNext}
            disabled={
              (currentStep === 1 && !selectedFeralId) ||
              (currentStep === 2 && !selectedMilkId)
            }
            className="px-8 py-3 bg-white text-black font-bold uppercase tracking-widest hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all clip-corner flex items-center gap-2"
          >
            Next Phase <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
