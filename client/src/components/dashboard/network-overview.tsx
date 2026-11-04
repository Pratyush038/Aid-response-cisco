import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { NetworkConnection, NetworkNode, NetworkStats } from "@/types/network";
import { Activity, Info, Network, Route, ShieldCheck } from "lucide-react";

interface NetworkOverviewProps {
  nodes: NetworkNode[];
  connections: NetworkConnection[];
  stats: NetworkStats;
  isError?: boolean;
}

export function NetworkOverview({
  nodes,
  connections,
  stats,
  isError = false,
}: NetworkOverviewProps) {
  const connectedPercent =
    stats.totalNodes > 0 ? Math.round((stats.connectedNodes / stats.totalNodes) * 100) : 0;
  const inactiveConnections = connections.filter((connection) => !connection.isActive).length;
  const health =
    connectedPercent >= 80 ? "Excellent" : connectedPercent >= 60 ? "Stable" : "Degraded";

  return (
    <Card className="rounded-lg border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center text-base text-slate-950">
            <Activity className="mr-2 h-4 w-4 text-blue-600" />
            Network Status
          </CardTitle>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Info className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" aria-describedby="network-concepts-description">
              <DialogHeader>
                <DialogTitle className="flex items-center">
                  <Network className="mr-2 h-5 w-5" />
                  Network Concepts
                </DialogTitle>
              </DialogHeader>
              <div id="network-concepts-description" className="space-y-4 text-sm text-slate-600">
                <p>Mesh nodes relay messages across multiple paths so communication survives partial outages.</p>
                <p>Dijkstra routing selects the lowest-cost route using distance, latency, and active links.</p>
                <p>SOS traffic is broadcast with priority across every reachable relay.</p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {isError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Live API data is unavailable. Showing the latest local simulation snapshot.
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Node availability</span>
            <Badge variant={connectedPercent >= 60 ? "default" : "destructive"}>
              {health}
            </Badge>
          </div>
          <Progress value={connectedPercent} className="h-2" />
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{stats.connectedNodes} of {stats.totalNodes || nodes.length} online</span>
            <span>{connectedPercent}% reachable</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-slate-200 p-3">
            <Route className="mb-2 h-4 w-4 text-amber-600" />
            <div className="font-semibold text-slate-950">{Math.round(stats.averageLatency)}ms</div>
            <div className="text-xs text-slate-500">average latency</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <ShieldCheck className="mb-2 h-4 w-4 text-emerald-600" />
            <div className="font-semibold text-slate-950">{inactiveConnections}</div>
            <div className="text-xs text-slate-500">inactive links</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
