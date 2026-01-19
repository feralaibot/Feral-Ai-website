import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface GlitchTextProps {
  text: string;
  className?: string;
  as?: any;
  animate?: boolean;
}

export function GlitchText({ text, className, as: Component = "span", animate = false }: GlitchTextProps) {
  return (
    <Component className={cn("relative inline-block group", className)}>
      <span className="relative z-10">{text}</span>
      {(animate || true) && (
        <>
          <span 
            className="absolute top-0 left-0 -z-10 w-full h-full text-primary opacity-0 group-hover:opacity-70 group-hover:translate-x-[2px] transition-all duration-100"
            aria-hidden="true"
          >
            {text}
          </span>
          <span 
            className="absolute top-0 left-0 -z-10 w-full h-full text-red-500 opacity-0 group-hover:opacity-70 group-hover:-translate-x-[2px] transition-all duration-100 delay-75"
            aria-hidden="true"
          >
            {text}
          </span>
        </>
      )}
    </Component>
  );
}
