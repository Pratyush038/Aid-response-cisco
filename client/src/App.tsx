import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Simulation from "@/pages/simulation";
import VrSimulation from "@/pages/vr";
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
      <Route path="/vr" component={VrSimulation} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // The floating chatbot is a DOM overlay; it would cover the 3D scene and is
  // meaningless inside a VR headset, so it is hidden on the /vr route.
  const [location] = useLocation();
  const showChatbot = !location.startsWith("/vr");
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        {showChatbot && <Chatbot />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
