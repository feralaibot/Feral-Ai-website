import { Switch, Route, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";

import Home from "@/pages/Home";
import Tools from "@/pages/Tools";
import Lore from "@/pages/Lore";
import Evolve from "@/pages/Evolve";
import Portal from "@/pages/Portal";
import WalletScan from "@/pages/WalletScan";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home}/>
        <Route path="/tools" component={Tools}/>
        <Route path="/tools/scan" component={WalletScan}/>
        <Route path="/lore" component={Lore}/>
        <Route path="/evolve" component={Evolve}/>
        <Route path="/portal" component={Portal}/>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <WouterRouter hook={useHashLocation}>
          <AppRouter />
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
