import { useLore } from "@/hooks/use-lore";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2, Calendar } from "lucide-react";

const CATEGORIES = ['ALL', 'FERAL Prime', 'FANG', 'NULL'];

export default function Lore() {
  const { data: lore, isLoading } = useLore();
  const [activeCategory, setActiveCategory] = useState('ALL');

  const filteredLore = activeCategory === 'ALL' 
    ? lore 
    : lore?.filter(item => item.category === activeCategory);

  if (isLoading) {
    return (
      <div className="h-[50vh] flex flex-col items-center justify-center gap-4 text-accent">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="font-tech text-sm uppercase tracking-widest animate-pulse">Decrypting Archives...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <header className="flex flex-col gap-2 border-b border-white/10 pb-6 text-center">
        <h1 className="text-4xl md:text-5xl font-display uppercase tracking-widest text-white">
          Data <span className="text-accent">Archives</span>
        </h1>
        <p className="text-muted-foreground font-tech">
          Recovered fragments of the old world and the new awakening.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap justify-center gap-2 md:gap-4">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-4 py-2 text-xs md:text-sm font-bold uppercase tracking-widest border transition-all duration-300 clip-corner min-w-[80px]",
              activeCategory === cat
                ? "bg-accent/20 border-accent text-accent shadow-[0_0_15px_rgba(188,19,254,0.2)]"
                : "bg-transparent border-white/10 text-muted-foreground hover:border-white/30 hover:text-white"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="relative min-h-[400px]">
        <div className="absolute left-4 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-accent/30 to-transparent hidden md:block" />
        
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-8 md:pl-12"
          >
            {filteredLore?.map((item) => (
              <article key={item.id} className="relative group">
                {/* Timeline dot */}
                <div className="absolute -left-[37px] top-6 w-3 h-3 bg-card border border-accent rounded-full z-10 hidden md:block group-hover:bg-accent group-hover:shadow-[0_0_10px_rgba(188,19,254,0.6)] transition-all" />
                
                <div className="bg-card border border-white/5 p-6 md:p-8 hover:border-accent/30 transition-colors group-hover:bg-white/[0.02]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-tech text-accent uppercase tracking-widest border border-accent/20 px-2 py-1 bg-accent/5">
                      {item.category}
                    </span>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono">
                      <Calendar className="w-3 h-3" />
                      {item.date}
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-display text-white mb-4 group-hover:text-glow-accent transition-all">
                    {item.title}
                  </h3>
                  
                  <div className="prose prose-invert prose-sm max-w-none font-body text-muted-foreground/80 leading-relaxed">
                    {item.content.split('\n').map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              </article>
            ))}
            
            {filteredLore?.length === 0 && (
              <div className="text-center py-20 text-muted-foreground font-tech uppercase tracking-widest">
                No records found in this sector.
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
