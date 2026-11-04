import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LandingHero } from "@/components/dashboard/landing-hero";
import type { NetworkStats } from "@/types/network";
import { Play } from "lucide-react";

const emptyStats: NetworkStats = {
  connectedNodes: 0,
  totalNodes: 0,
  activeConnections: 0,
  averageLatency: 0,
  coverageRadius: 0,
  totalMessages: 0,
  unreadMessages: 0,
};

export default function Landing() {
  const [, setLocation] = useLocation();
  const { data: stats = emptyStats } = useQuery<NetworkStats>({
    queryKey: ["/api/network/stats"],
    refetchInterval: 3000,
  });

  return (
    <div className="min-h-screen bg-[#050608]">
      <LandingHero
        connectedNodes={stats.connectedNodes}
        activeConnections={stats.activeConnections}
        onExplore={() => setLocation("/app")}
      />
      <section className="border-t border-white/10 bg-[#050608] px-6 py-10 text-white">
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-sm font-semibold text-white">Mesh-first routing</h2>
            <p className="mt-2 text-sm leading-6 text-white/50">
              Nodes relay messages through resilient paths when normal infrastructure is unavailable.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-sm font-semibold text-white">Emergency broadcast</h2>
            <p className="mt-2 text-sm leading-6 text-white/50">
              SOS alerts prioritize live routes, location payloads, and nearby BLE-capable devices.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-sm font-semibold text-white">Field visibility</h2>
            <p className="mt-2 text-sm leading-6 text-white/50">
              Track node health, latency, coverage, messages, and map fallbacks from the console.
            </p>
          </div>
        </div>
        <div className="mx-auto mt-8 flex max-w-6xl justify-center">
          <Button
            onClick={() => setLocation("/simulation")}
            className="rounded-full bg-white px-6 text-slate-950 hover:bg-white/90"
          >
            <Play className="mr-2 h-4 w-4" />
            Watch Simulation
          </Button>
        </div>
      </section>
    </div>
  );
}
