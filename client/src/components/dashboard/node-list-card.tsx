import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { NetworkNode } from "@/types/network";
import { Radio, Signal } from "lucide-react";

interface NodeListCardProps {
  nodes: NetworkNode[];
}

export function NodeListCard({ nodes }: NodeListCardProps) {
  const sortedNodes = [...nodes].sort((a, b) => Number(b.isOnline) - Number(a.isOnline));

  return (
    <Card className="rounded-lg border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-base text-slate-950">
          <Radio className="mr-2 h-4 w-4 text-blue-600" />
          Field Nodes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedNodes.slice(0, 6).map((node) => (
          <div key={node.nodeId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{node.name}</p>
              <p className="mt-1 text-xs text-slate-500">{node.nodeId}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Signal className={node.signalStrength > 70 ? "h-4 w-4 text-emerald-600" : "h-4 w-4 text-amber-600"} />
              <Badge variant={node.isOnline ? "default" : "secondary"}>
                {node.isOnline ? "Online" : "Offline"}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
