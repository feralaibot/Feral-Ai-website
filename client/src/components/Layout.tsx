import React, { useEffect, useState } from 'react';
import { Link, useLocation } from "wouter";
import { 
  Home, 
  Wrench, 
  Zap, 
  BookOpen, 
  Lock, 
  Menu, 
  Settings, 
  X,
} from "lucide-react";
import { useWallet } from '@/hooks/use-wallet';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { WalletConnectButton } from '@/components/WalletConnectButton';

// --- Sidebar/Nav Components ---

const NavItem = ({ href, icon: Icon, label, active, onClick }: any) => {
  return (
    <Link 
      href={href} 
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-none border-l-2 transition-all duration-300 group",
        active 
          ? "border-primary bg-primary/5 text-primary" 
          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5"
      )}
      onClick={onClick}
    >
      <Icon className={cn("w-5 h-5", active && "drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]")} />
      <span className={cn("font-tech tracking-wider uppercase text-sm", active && "font-bold")}>{label}</span>
    </Link>
  );
};

// --- Settings Drawer ---
const SettingsDrawer = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const {
    isConnected,
    disconnect,
    walletAddress,
    verificationStatus,
    verificationError,
    isEligible,
    accessTier,
    verify,
  } = useWallet();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 md:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            className="fixed right-0 top-0 bottom-0 w-80 bg-card border-l border-white/10 p-6 z-50 shadow-2xl shadow-primary/10"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-display text-primary">SYSTEM_CONFIG</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-8">
              <section>
                <h3 className="text-sm font-tech text-muted-foreground mb-4 uppercase tracking-widest">Connection Status</h3>
                {isConnected ? (
                  <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
                    <div className="flex items-center gap-2 text-primary mb-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span className="font-bold">CONNECTED</span>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground break-all">ADDR: {walletAddress}</p>
                    <div className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {verificationStatus === "verifying" && "Verifying..."}
                      {verificationStatus === "verified" && (
                        isEligible
                          ? accessTier === "legendary"
                            ? "Verified: Legendary Access"
                            : "Verified: Access Granted"
                          : "Verified: Holdings Missing"
                      )}
                      {verificationStatus === "failed" && "Verification Failed"}
                      {verificationStatus === "idle" && "Verification Required"}
                    </div>
                    {verificationError && (
                      <div className="mt-2 text-xs text-red-400 font-mono">
                        {verificationError}
                      </div>
                    )}
                    <button
                      onClick={verify}
                      disabled={verificationStatus === "verifying"}
                      className="mt-4 w-full py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider border border-white/20 transition-colors disabled:opacity-60"
                    >
                      {verificationStatus === "verifying" ? "Verifying..." : "Verify Access"}
                    </button>
                    <button 
                      onClick={disconnect}
                      className="mt-4 w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold uppercase tracking-wider border border-red-500/30 transition-colors"
                    >
                      Disconnect Signal
                    </button>
                  </div>
                ) : (
                  <WalletConnectButton className="w-full py-3 bg-primary text-black font-bold uppercase tracking-wider hover:bg-primary/90 transition-all clip-corner" />
                )}
              </section>

              <section>
                <h3 className="text-sm font-tech text-muted-foreground mb-4 uppercase tracking-widest">Access Notes</h3>
                <div className="text-xs text-muted-foreground font-tech leading-relaxed border border-white/5 bg-black/20 p-3">
                  Verification requires a signed message. Access is granted if your wallet meets the required NFT or token rules.
                </div>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};


export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsUnlocked, setIsSettingsUnlocked] = useState(false);
  const { isConnected } = useWallet();

  const navItems = [
    { href: "/", icon: Home, label: "Dashboard" },
    { href: "/tools", icon: Wrench, label: "Tools" },
    { href: "/evolve", icon: Zap, label: "Evolve" },
    { href: "/portal", icon: Lock, label: "VIP Portal" },
    { href: "/lore", icon: BookOpen, label: "Archives" },
  ];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setIsSettingsUnlocked((prev) => {
          const next = !prev;
          setIsSettingsOpen(next);
          return next;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/5 bg-card/30 backdrop-blur-sm z-40 h-screen sticky top-0">
        <div className="p-6 border-b border-white/5">
          <h1 className="text-2xl font-display font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
            FERAL<span className="text-primary">CORE</span>
          </h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] mt-1 pl-1">Protocol v1.0.4</p>
        </div>

        <nav className="flex-1 py-6 space-y-1">
          {navItems.map((item) => (
            <NavItem 
              key={item.href} 
              {...item} 
              active={location === item.href} 
            />
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-primary shadow-[0_0_8px_cyan]" : "bg-red-500 shadow-[0_0_8px_red]")} />
              <span className="text-xs font-tech uppercase text-muted-foreground">
                {isConnected ? "System Online" : "Offline"}
              </span>
            </div>
            {isSettingsUnlocked && (
              <button onClick={() => setIsSettingsOpen(true)} className="text-muted-foreground hover:text-white transition-colors">
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {!isConnected && isSettingsUnlocked && (
            <WalletConnectButton className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold py-2 uppercase tracking-wider transition-all" />
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-display font-bold text-white">FERAL</h1>
        </div>
        <div className="flex items-center gap-4">
          {isSettingsUnlocked && (
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-muted-foreground hover:text-white border border-white/10 rounded-sm"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative h-[calc(100vh-64px)] md:h-screen">
        <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-12 pb-24 md:pb-12">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-white/10 z-50 flex justify-around items-center px-2 py-3 safe-area-pb">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 p-2 w-full">
              <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-primary drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]" : "text-muted-foreground")} />
              <span className={cn("text-[10px] uppercase font-tech tracking-wider", isActive ? "text-white" : "text-muted-foreground/50")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Settings Drawer */}
      <SettingsDrawer isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
