import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import type { NetworkNode, RoutingResult } from "@/types/network";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeftRight,
  Crosshair,
  Power,
  Route,
  Waypoints,
  X,
  Zap,
  ZapOff,
  Send,
} from "lucide-react";

export type PickMode = "source" | "dest" | "place" | null;

interface NetworkToolkitProps {
  nodes: NetworkNode[];
  users: any[];
  currentUser: any;
  routeSource: string | null;
  routeDest: string | null;
  onRouteSourceChange: (nodeId: string | null) => void;
  onRouteDestChange: (nodeId: string | null) => void;
  route: RoutingResult | null;
  routeLatencyMs: number | null;
  pickMode: PickMode;
  onPickModeChange: (mode: PickMode) => void;
}

const CLEAR_VALUE = "__clear__";

export function NetworkToolkit({
  nodes,
  users = [],
  currentUser,
  routeSource,
  routeDest,
  onRouteSourceChange,
  onRouteDestChange,
  route,
  routeLatencyMs,
  pickMode,
  onPickModeChange,
}: NetworkToolkitProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [controlNodeId, setControlNodeId] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState("");

  const controlNode = nodes.find((node) => node.nodeId === controlNodeId) ?? null;
  const nodeName = (nodeId: string) => nodes.find((node) => node.nodeId === nodeId)?.name ?? nodeId;

  const toggleNodeMutation = useMutation({
    mutationFn: async ({ nodeId, isOnline }: { nodeId: string; isOnline: boolean }) => {
      await apiRequest("PATCH", `/api/nodes/${nodeId}/status`, {
        isOnline,
        signalStrength: isOnline ? 85 : 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/network/stats"] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!routeSource || !routeDest || !route) return;
      // Simulate E2EE if destination is a user (assuming usernames are destination if they don't match node IDs)
      const isUserDest = users.some(u => u.username === routeDest);
      const payloadContent = isUserDest 
        ? `[E2EE-ENCRYPTED]:${btoa(messageContent)}` 
        : messageContent;

      const response = await apiRequest("POST", "/api/messages/direct", {
        senderId: routeSource,
        receiverId: routeDest,
        content: payloadContent,
        routingPath: route.path,
        hops: route.hops
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Message sent",
        description: `Successfully routed over ${route?.hops} hops.`,
      });
      setMessageContent("");
    },
    onError: () => {
      toast({
        title: "Failed to send",
        description: "Message could not be routed.",
        variant: "destructive",
      });
    }
  });

  const renderNodeItem = (node: NetworkNode) => (
    <SelectItem key={node.nodeId} value={node.nodeId} className="text-xs">
      <span className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${node.isOnline ? "bg-emerald-500" : "bg-slate-400"}`} />
        {node.name}
        {!node.isOnline && <span className="text-slate-400">(offline)</span>}
      </span>
    </SelectItem>
  );

  const bothSelected = Boolean(routeSource && routeDest);
  const routeBroken = bothSelected && !route;

  return (
    <Card className="w-72 border-slate-200/50 bg-white/80 shadow-lg backdrop-blur-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center text-sm font-semibold text-slate-900">
          <Waypoints className="mr-2 h-4 w-4 text-blue-600" />
          Network Toolkit
        </CardTitle>
        <p className="text-[11px] leading-4 text-slate-500">
          Plan routes and break the mesh — watch Dijkstra self-heal in real time.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ---- Dijkstra Route Planner ---- */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Route className="h-3.5 w-3.5 text-amber-500" />
              Shortest Path (Dijkstra)
            </span>
            {(routeSource || routeDest) && (
              <button
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600"
                onClick={() => {
                  onRouteSourceChange(null);
                  onRouteDestChange(null);
                  onPickModeChange(null);
                }}
                title="Clear the selected route"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          {(["source", "dest"] as const).map((endpoint) => {
            const value = endpoint === "source" ? routeSource : routeDest;
            const onChange = endpoint === "source" ? onRouteSourceChange : onRouteDestChange;
            const label = endpoint === "source" ? "Source" : "Destination";
            const dotColor = endpoint === "source" ? "bg-blue-600" : "bg-amber-500";

            return (
              <div key={endpoint} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} title={label} />
                <Select
                  value={value ?? undefined}
                  onValueChange={(next) => onChange(next === CLEAR_VALUE ? null : next)}
                >
                  <SelectTrigger className="h-8 flex-1 bg-white/70 text-xs">
                    <SelectValue placeholder={`${label} node…`} />
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    {value && (
                      <SelectItem value={CLEAR_VALUE} className="text-xs text-slate-400">
                        — clear {label.toLowerCase()} —
                      </SelectItem>
                    )}
                    {nodes.map(renderNodeItem)}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant={pickMode === endpoint ? "default" : "outline"}
                  className="h-8 w-8 shrink-0 p-0"
                  onClick={() => onPickModeChange(pickMode === endpoint ? null : endpoint)}
                  title={`Pick the ${label.toLowerCase()} by clicking a node on the map`}
                >
                  <Crosshair className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}

          {pickMode && (
            <div className="rounded-md border border-blue-200 bg-blue-50/80 px-2.5 py-1.5 text-[10px] font-medium text-blue-700 animate-pulse">
              Click a node on the map to set the {pickMode === "source" ? "source" : "destination"}…
            </div>
          )}

          {bothSelected && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-full text-[10px] text-slate-500"
              onClick={() => {
                onRouteSourceChange(routeDest);
                onRouteDestChange(routeSource);
              }}
            >
              <ArrowLeftRight className="mr-1 h-3 w-3" />
              Swap endpoints
            </Button>
          )}

          {route && (
            <div className="rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50/90 to-yellow-50/70 p-2.5">
              <div className="flex items-center justify-between text-[10px] font-semibold text-amber-800">
                <span>OPTIMAL ROUTE FOUND</span>
                <span>
                  {route.hops} hop{route.hops === 1 ? "" : "s"}
                  {routeLatencyMs !== null && ` · ~${routeLatencyMs}ms`}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] leading-4 text-slate-700">
                {route.path.map((nodeId, index) => (
                  <span key={`${nodeId}-${index}`} className="flex items-center gap-1">
                    <span className="rounded bg-white/80 px-1.5 py-0.5 font-medium shadow-sm">{nodeName(nodeId)}</span>
                    {index < route.path.length - 1 && <span className="text-amber-500">→</span>}
                  </span>
                ))}
              </div>
              
              <div className="mt-3 space-y-2">
                <textarea
                  className="w-full resize-none rounded bg-white/60 p-2 text-xs outline-none placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-amber-400"
                  rows={2}
                  placeholder="Message payload..."
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                />
                <Button 
                  size="sm" 
                  className="w-full text-xs shadow-sm" 
                  disabled={!messageContent.trim() || sendMessageMutation.isPending}
                  onClick={() => sendMessageMutation.mutate()}
                >
                  <Send className="mr-1.5 h-3 w-3" /> 
                  Send via Mesh
                </Button>
                {routeDest === "cisco-gateway" && (
                  <p className="text-center text-[9px] font-medium text-amber-700/80">
                    Will auto-uplink to Webex Cloud
                  </p>
                )}
              </div>
            </div>
          )}

          {routeBroken && (
            <div className="rounded-lg border border-red-200 bg-red-50/90 p-2.5 text-[10px] leading-4 text-red-700">
              <strong>No route available.</strong> The mesh is partitioned between these nodes — restore a
              node or link to reconnect them.
            </div>
          )}

          {!routeSource && !routeDest && (
            <p className="text-[10px] leading-4 text-slate-400">
              Choose two nodes (or use <Crosshair className="inline h-2.5 w-2.5" /> to click them on the map).
              The gold line is the live least-latency path over active links.
            </p>
          )}
        </div>

        <div className="border-t border-slate-200/70" />

        {/* ---- Node Failure Simulator ---- */}
        <div className="space-y-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Power className="h-3.5 w-3.5 text-red-500" />
            Node Failure Simulator
          </span>
          <Select value={controlNodeId ?? undefined} onValueChange={(next) => setControlNodeId(next)}>
            <SelectTrigger className="h-8 bg-white/70 text-xs">
              <SelectValue placeholder="Select any node…" />
            </SelectTrigger>
            <SelectContent className="z-[60]">{nodes.map(renderNodeItem)}</SelectContent>
          </Select>

          {controlNode && (
            <Button
              size="sm"
              variant={controlNode.isOnline ? "destructive" : "default"}
              className={`w-full text-xs shadow-sm transition-all hover:scale-[1.02] ${
                controlNode.isOnline ? "" : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
              onClick={() =>
                toggleNodeMutation.mutate({ nodeId: controlNode.nodeId, isOnline: !controlNode.isOnline })
              }
              disabled={toggleNodeMutation.isPending}
            >
              {controlNode.isOnline ? (
                <>
                  <ZapOff className="mr-2 h-3 w-3" />
                  Take “{controlNode.name}” Offline
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-3 w-3" />
                  Bring “{controlNode.name}” Online
                </>
              )}
            </Button>
          )}

          <p className="text-[10px] leading-4 text-slate-400">
            Killing a node also severs its physical links (grey dashed). Any gold route through it
            re-computes instantly — that's the self-healing mesh.
          </p>
        </div>

        <div className="border-t border-slate-200/70" />

        {/* ---- Legend ---- */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded bg-emerald-500" /> Active link
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded border-t-2 border-dashed border-slate-400" /> Failed link
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-5 rounded bg-yellow-300 ring-1 ring-yellow-600/60 shadow-[0_0_6px_rgba(250,204,21,0.95)]" /> Dijkstra path
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px]" style={{ backgroundColor: "rgba(4,159,217,0.2)" }}>
              ☁
            </span>
            Meraki gateway
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
