import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Simulation from "@/pages/simulation";
import NotFound from "@/pages/not-found";
import { Chatbot } from "@/components/chatbot";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/app" component={Home} />
      <Route path="/maps" component={Home} />
      <Route path="/messages" component={Home} />
      <Route path="/settings" component={Home} />
      <Route path="/simulation" component={Simulation} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <Chatbot />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
