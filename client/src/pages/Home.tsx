import { useWallet } from "@/hooks/use-wallet";
import { Link } from "wouter";
import { ArrowRight, Box, Zap, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { WalletConnectButton } from "@/components/WalletConnectButton";

export default function Home() {
  const { isConnected } = useWallet();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <motion.section 
        variants={container}
        initial="hidden"
        animate="show"
        className="relative py-12 md:py-20 overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] -z-10" />
        
        <motion.div variants={item} className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-tech text-primary uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            System Status: Nominal
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display font-black leading-[0.9] tracking-tight">
            TOOLS.<br />
            ACCESS.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">EVOLUTION.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground font-light max-w-lg leading-relaxed">
            The FERAL protocol is live. Connect your wallet to access holder-only utilities, lore archives, and the evolution machine.
          </p>

          <div className="pt-6 flex flex-wrap gap-4">
            {!isConnected ? (
              <WalletConnectButton
                className="px-8 py-4 bg-primary text-black font-bold uppercase tracking-widest hover:bg-white transition-all clip-corner shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] flex items-center gap-2 group"
              />
            ) : (
               <Link href="/evolve" className="px-8 py-4 bg-white/10 text-white border border-white/20 font-bold uppercase tracking-widest hover:bg-white/20 transition-all clip-corner flex items-center gap-2">
                 Enter Evolution <Zap className="w-5 h-5" />
               </Link>
            )}
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            <a
              href="https://pump.fun/coin/DfVvoJxWjcGjh13rhRCrHZSFEoMUL1zMgfX1dabgpump"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 bg-white/5 text-white border border-white/10 font-bold uppercase tracking-widest hover:bg-white/15 transition-all clip-corner text-xs"
            >
              Buy $FANG
            </a>
            <a
              href="https://x.com/Feralaiback"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 bg-white/5 text-white border border-white/10 font-bold uppercase tracking-widest hover:bg-white/15 transition-all clip-corner text-xs"
            >
              Follow on X
            </a>
            <a
              href="https://discord.gg/M2b8xwpS"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 bg-white/5 text-white border border-white/10 font-bold uppercase tracking-widest hover:bg-white/15 transition-all clip-corner text-xs"
            >
              Join Discord
            </a>
          </div>
        </motion.div>
      </motion.section>

      {/* Features Grid */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <Link href="/tools" className="group block">
          <div className="h-full bg-card border border-white/5 p-8 relative overflow-hidden transition-all duration-300 hover:border-primary/50 group-hover:bg-card/80">
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity duration-300">
              <Box className="w-16 h-16 text-primary" />
            </div>
            <h3 className="text-2xl font-display mb-2 group-hover:text-primary transition-colors">Tools</h3>
            <p className="text-muted-foreground text-sm font-tech">
              Utility suite for holders. Image generators, analytics, and asset management.
            </p>
            <div className="mt-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50 group-hover:text-white transition-colors">
              Access Terminal <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </Link>

        <Link href="/evolve" className="group block">
          <div className="h-full bg-card border border-white/5 p-8 relative overflow-hidden transition-all duration-300 hover:border-accent/50 group-hover:bg-card/80">
             <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity duration-300">
              <Zap className="w-16 h-16 text-accent" />
            </div>
            <h3 className="text-2xl font-display mb-2 group-hover:text-accent transition-colors">Evolve</h3>
            <p className="text-muted-foreground text-sm font-tech">
              The Evolution Machine is active. Combine assets to awaken next-gen traits.
            </p>
            <div className="mt-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50 group-hover:text-white transition-colors">
              Start Sequence <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </Link>

        <Link href="/portal" className="group block">
          <div className="h-full bg-card border border-white/5 p-8 relative overflow-hidden transition-all duration-300 hover:border-red-500/50 group-hover:bg-card/80">
             <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity duration-300">
              <Lock className="w-16 h-16 text-red-500" />
            </div>
            <h3 className="text-2xl font-display mb-2 group-hover:text-red-500 transition-colors">VIP</h3>
            <p className="text-muted-foreground text-sm font-tech">
              Restricted area. High-value asset holders only. Enter at own risk.
            </p>
            <div className="mt-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50 group-hover:text-white transition-colors">
              Verify Credentials <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </Link>
      </motion.section>
    </div>
  );
}
