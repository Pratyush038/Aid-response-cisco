import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { NetworkNode, SosEvent } from "@/types/network";
import {
  BrainCircuit,
  CheckCircle2,
  Clock,
  MapPin,
  Route,
  Siren,
} from "lucide-react";

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : new Date(iso).toLocaleString();
}

/**
 * Emergency Response Panel — right-edge drawer aggregating every SOS alert
 * with its Groq AI crisis analysis. Owns the app's SSE connection: any SOS
 * fired anywhere appears instantly on every open client with a loud toast.
 * Mount exactly once (in Home).
 */
export function EmergencyPanel() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events = [] } = useQuery<SosEvent[]>({
    queryKey: ["/api/sos/events"],
    refetchInterval: 5000,
  });

  const { data: nodes = [] } = useQuery<NetworkNode[]>({
    queryKey: ["/api/nodes"],
    refetchInterval: 5000,
  });

  const nodeName = (nodeId: string) =>
    nodes.find((node) => node.nodeId === nodeId)?.name ?? nodeId;

  const active = useMemo(() => events.filter((event) => !event.isResolved), [events]);

  // Instant push channel — no polling delay for a life-safety alert.
  useEffect(() => {
    const source = new EventSource("/api/events");

    source.addEventListener("sos", (raw) => {
      try {
        const { event, senderName, recipientCount } = JSON.parse((raw as MessageEvent).data);
        toast({
          title: "🆘 SOS RECEIVED — EMERGENCY",
          description: `${senderName} at ${event.latitude.toFixed(4)}, ${event.longitude.toFixed(4)} — broadcast to ${recipientCount} nodes. Groq AI analysis attached.`,
          variant: "destructive",
          duration: 10000,
        });
        setOpen(true);
      } catch {
        // malformed frame — the polling fallback still catches the event
      }
      queryClient.invalidateQueries({ queryKey: ["/api/sos/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cisco/uplink"] });
    });

    source.addEventListener("sos-resolved", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sos/events"] });
    });

    return () => source.close();
  }, [toast, queryClient]);

  const resolveMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/sos/events/${id}/resolve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sos/events"] });
    },
  });

  return (
    <>
      {/* Right-edge drawer handle — visible on every tab, collides with nothing */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed right-0 top-1/3 z-50 flex flex-col items-center gap-1.5 rounded-l-xl border border-r-0 px-2 py-3 shadow-lg backdrop-blur-md transition-all hover:pr-3 ${
          active.length > 0
            ? "border-red-400/60 bg-red-600/95 text-white animate-pulse"
            : "border-slate-300/60 bg-white/85 text-slate-600"
        }`}
        title="Open the Emergency Response Panel"
      >
        <Siren className="h-4 w-4" />
        <span className="text-[10px] font-bold tracking-widest [writing-mode:vertical-rl]">
          SOS ALERTS
        </span>
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
            active.length > 0 ? "bg-white text-red-600" : "bg-slate-200 text-slate-600"
          }`}
        >
          {active.length}
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full border-l-red-500/30 bg-slate-950/95 p-0 text-white backdrop-blur-xl sm:max-w-md">
          <SheetHeader className="border-b border-white/10 bg-gradient-to-r from-red-950/80 to-slate-950 p-4">
            <SheetTitle className="flex items-center gap-2 text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600">
                <Siren className="h-4 w-4 text-white" />
              </span>
              Emergency Response Panel
              {active.length > 0 && (
                <Badge className="ml-auto bg-red-600 text-white hover:bg-red-600">
                  {active.length} ACTIVE
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription className="text-slate-400">
              Live SOS alerts with Groq AI crisis analysis, streamed over SSE.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-96px)]">
            <div className="space-y-3 p-4">
              {events.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-400">
                  No SOS alerts yet. When one fires, it appears here instantly
                  with an AI situation report.
                </div>
              )}

              {events.map((event) => (
                <div
                  key={event.id}
                  className={`overflow-hidden rounded-xl border shadow-lg transition-opacity ${
                    event.isResolved
                      ? "border-white/10 bg-white/[0.04] opacity-55"
                      : "border-red-500/40 bg-gradient-to-br from-red-950/60 to-slate-900/80"
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3.5 py-2.5">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      {event.isResolved ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Siren className="h-4 w-4 animate-pulse text-red-400" />
                      )}
                      {nodeName(event.senderId)}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="h-3 w-3" />
                      {timeAgo(event.createdAt)}
                    </span>
                  </div>

                  <div className="space-y-2.5 px-3.5 py-3">
                    {/* Coordinates */}
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-red-400" />
                      <a
                        className="font-mono underline-offset-2 hover:underline"
                        href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {event.latitude.toFixed(5)}, {event.longitude.toFixed(5)}
                      </a>
                    </div>

                    {/* Attached message */}
                    {event.content && (
                      <p className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs leading-5 text-slate-200">
                        “{event.content}”
                      </p>
                    )}

                    {/* Routing path */}
                    {event.routingPath && event.routingPath.length > 1 && (
                      <div className="flex items-start gap-2 text-[11px] text-slate-400">
                        <Route className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                        <span className="flex flex-wrap items-center gap-1">
                          {event.routingPath.map((nodeId, index) => (
                            <span key={`${nodeId}-${index}`} className="flex items-center gap-1">
                              <span className="rounded bg-white/10 px-1.5 py-0.5 font-medium text-slate-200">
                                {nodeName(nodeId)}
                              </span>
                              {index < event.routingPath!.length - 1 && (
                                <span className="text-amber-500">→</span>
                              )}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}

                    {/* Groq AI analysis */}
                    {event.aiSummary && (
                      <div className="rounded-lg border border-violet-500/30 bg-violet-950/40 p-2.5">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-300">
                          <BrainCircuit className="h-3.5 w-3.5" />
                          Groq AI Crisis Analysis
                          {event.aiProvider && (
                            <span className="ml-auto rounded bg-violet-500/20 px-1.5 py-0.5 font-mono text-[9px] normal-case text-violet-300">
                              {event.aiProvider}
                            </span>
                          )}
                        </div>
                        <p className="whitespace-pre-line text-xs leading-5 text-slate-200">
                          {event.aiSummary}
                        </p>
                      </div>
                    )}

                    {!event.isResolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-full border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"
                        disabled={resolveMutation.isPending}
                        onClick={() => resolveMutation.mutate(event.id)}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Mark Resolved
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
