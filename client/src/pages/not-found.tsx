import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-black text-white p-4">
      <AlertTriangle className="w-20 h-20 text-red-500 mb-6 animate-pulse" />
      <h1 className="text-6xl font-display font-black text-red-500 mb-2 tracking-widest">404</h1>
      <p className="text-xl font-tech text-muted-foreground mb-8 uppercase tracking-widest">
        Sector Not Found
      </p>
      <Link href="/">
        <a className="px-8 py-3 border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-black font-bold uppercase tracking-widest transition-all clip-corner">
          Return to Base
        </a>
      </Link>
    </div>
  );
}
