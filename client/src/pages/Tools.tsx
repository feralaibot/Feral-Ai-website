import { useTools } from "@/hooks/use-tools";
import { useWallet } from "@/hooks/use-wallet";
import { Loader2, Lock, Terminal, Box, Image as ImageIcon, BarChart, Scan, Gift, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Map icon strings to components
const IconMap: Record<string, any> = {
  terminal: Terminal,
  box: Box,
  image: ImageIcon,
  chart: BarChart,
  barchart: BarChart,
  scan: Scan,
  gift: Gift,
  zap: Zap,
};

export default function Tools() {
  const { data: tools, isLoading } = useTools();
  const { isConnected, isVerified, isEligible } = useWallet();
  const baseUrl = import.meta.env.BASE_URL;

  const buildToolHref = (path: string) => {
    if (path.startsWith("http")) return path;
    if (path.startsWith("/generator/") || path === "/generator/index.html") {
      return `${baseUrl.replace(/\/$/, "")}${path}`;
    }
    return `${baseUrl}#${path}`;
  };

  if (isLoading) {
    return (
      <div className="h-[50vh] flex flex-col items-center justify-center gap-4 text-primary">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="font-tech text-sm uppercase tracking-widest animate-pulse">Initializing Toolset...</span>
      </div>
    );
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, scale: 0.95 },
    show: { opacity: 1, scale: 1 }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 border-b border-white/10 pb-6">
        <h1 className="text-4xl font-display uppercase tracking-wider text-white">
          Utility <span className="text-primary">Grid</span>
        </h1>
        <p className="text-muted-foreground font-tech">
          Access specialized tools for the FERAL ecosystem.
        </p>
      </header>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {tools?.map((tool) => {
          const iconKey = tool.icon?.toLowerCase?.() ?? "";
          const Icon = IconMap[iconKey] || Box;
          const requiresAccess = tool.isHolderOnly || tool.path === "/tools/scan" || tool.path === "/evolve";
          const isLocked = requiresAccess && (!isConnected || !isVerified || !isEligible);
          const isLive = tool.status === 'LIVE';
          const lockReason = !isConnected
            ? "Connect Wallet"
            : !isVerified
              ? "Verification Required"
              : "Insufficient Holdings";

          return (
            <motion.div
              key={tool.id}
              variants={item}
              className={cn(
                "relative group bg-card border p-6 flex flex-col gap-4 transition-all duration-300",
                isLocked ? "border-red-500/20 opacity-70" : "border-white/10 hover:border-primary/50"
              )}
            >
              {/* Status Pill */}
              <div className="flex justify-between items-start">
                <div className={cn(
                  "p-3 rounded-md bg-black/40 border border-white/5",
                  !isLocked && "group-hover:text-primary transition-colors"
                )}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className={cn(
                  "px-2 py-1 text-[10px] font-bold uppercase tracking-wider border",
                  isLive 
                    ? "border-primary/30 text-primary bg-primary/5" 
                    : "border-white/10 text-muted-foreground bg-white/5"
                )}>
                  {tool.status}
                </div>
              </div>

              <div>
                <h3 className="text-xl font-display mb-2 group-hover:text-white transition-colors">
                  {tool.name}
                </h3>
                <p className="text-sm text-muted-foreground font-tech leading-relaxed h-10 line-clamp-2">
                  {tool.description}
                </p>
              </div>

              <div className="mt-auto pt-4 border-t border-white/5">
                {isLocked ? (
                  <div className="flex items-center gap-2 text-red-500 text-xs font-bold uppercase tracking-widest">
                    <Lock className="w-3 h-3" /> {lockReason}
                  </div>
                ) : (
                  <a
                    href={isLive ? buildToolHref(tool.path) : undefined}
                    className={cn(
                      "w-full py-2 text-center text-xs font-bold uppercase tracking-widest transition-all",
                      isLive
                        ? "bg-white/5 hover:bg-white/10 text-white"
                        : "opacity-50 cursor-not-allowed text-muted-foreground pointer-events-none"
                    )}
                  >
                    {isLive ? "Launch Module" : "Pending Update"}
                  </a>
                )}
              </div>
              
              {isLocked && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="px-4 py-2 bg-red-950/90 border border-red-500 text-red-500 font-tech uppercase text-xs tracking-widest shadow-lg shadow-red-900/20">
                    Holder Access Only
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
