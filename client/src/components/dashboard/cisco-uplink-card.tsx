import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CiscoUplinkState } from "@/types/network";
import { Cloud, CloudUpload, Radio, Satellite, ShieldCheck, Signal } from "lucide-react";

const CISCO_BLUE = "#049fd9";

export function CiscoUplinkCard() {
  const { data: uplink } = useQuery<CiscoUplinkState>({
    queryKey: ["/api/cisco/uplink"],
    refetchInterval: 2500,
  });

  const [flash, setFlash] = useState(false);
  const lastEventIdRef = useRef<string | null>(null);

  // Flash the card green whenever a fresh uplink event lands
  useEffect(() => {
    const latestId = uplink?.events[0]?.id ?? null;
    const previousId = lastEventIdRef.current;
    lastEventIdRef.current = latestId;

    if (latestId && previousId && latestId !== previousId) {
      setFlash(true);
      const timeout = window.setTimeout(() => setFlash(false), 2400);
      return () => window.clearTimeout(timeout);
    }
  }, [uplink?.events]);

  const isOnline = uplink ? uplink.uplinkStatus === "online" : true;
  const events = uplink?.events ?? [];

  return (
    <Card
      className={`relative overflow-hidden border-slate-200 bg-white shadow-sm transition-all duration-700 ${
        flash ? "ring-2 ring-emerald-400/70 shadow-[0_0_36px_rgba(16,185,129,0.35)]" : ""
      }`}
    >
      {/* Cisco-blue accent strip */}
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: `linear-gradient(90deg, ${CISCO_BLUE}, #22d3ee, ${CISCO_BLUE})` }}
      />

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: "rgba(4,159,217,0.12)" }}
            >
              <Cloud className="h-4 w-4" style={{ color: CISCO_BLUE }} />
            </div>
            <div>
              Cisco Meraki Uplink
              <div className="text-[11px] font-normal text-slate-400">
                {uplink?.gateway?.name ?? "MG52 Edge Gateway"} · Cloud Backhaul
              </div>
            </div>
          </CardTitle>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
              isOnline ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"
              }`}
            />
            {isOnline ? "Live" : "Down"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
            <div className="flex items-center gap-1">
              <Signal className="h-3 w-3 text-slate-400" />
              <span className="text-xs text-slate-500">Uplink Status</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
              {isOnline ? "Online" : "Offline"}
              <span className="font-medium text-slate-400">· {uplink?.transport ?? "LTE"}</span>
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
            <div className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-slate-400" />
              <span className="text-xs text-slate-500">Gateway Health</span>
            </div>
            <div className="mt-0.5 text-sm font-bold capitalize text-emerald-600">
              {uplink?.gatewayHealth ?? "Active"}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
            <div className="flex items-center gap-1">
              <Satellite className="h-3 w-3 text-slate-400" />
              <span className="text-xs text-slate-500">Failover</span>
            </div>
            <div className="mt-0.5 text-sm font-semibold text-slate-800">
              {uplink?.failover ?? "Satellite Ready"}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
            <div className="flex items-center gap-1">
              <CloudUpload className="h-3 w-3 text-slate-400" />
              <span className="text-xs text-slate-500">Cloud Uplinks</span>
            </div>
            <div className="mt-0.5 text-sm font-bold" style={{ color: CISCO_BLUE }}>
              {uplink?.totalUplinks ?? 0} alerts forwarded
            </div>
          </div>
        </div>

        {/* Terminal-style live event log */}
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-inner">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500/80" />
              <span className="h-2 w-2 rounded-full bg-amber-500/80" />
              <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
            </div>
            <span className="font-mono text-[10px] text-slate-500">meraki-events.log — live</span>
          </div>
          <div className="max-h-40 space-y-1.5 overflow-y-auto p-3 font-mono text-[10px] leading-relaxed">
            <AnimatePresence initial={false}>
              {events.length === 0 ? (
                <div className="text-slate-500">
                  <span className="text-emerald-400">$</span> Awaiting mesh traffic... gateway idle
                  <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-emerald-400/80 align-middle" />
                </div>
              ) : (
                events.slice(0, 6).map((event, eventIndex) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: -8, backgroundColor: "rgba(16,185,129,0.25)" }}
                    animate={{ opacity: 1, y: 0, backgroundColor: "rgba(16,185,129,0)" }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.9 }}
                    className={`rounded px-1 py-0.5 ${eventIndex === 0 ? "text-emerald-300" : "text-slate-400"}`}
                  >
                    {event.logLines.map((line, lineIndex) => (
                      <div key={lineIndex} className={lineIndex === event.logLines.length - 1 ? "text-emerald-400" : ""}>
                        {line}
                      </div>
                    ))}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(4,159,217,0.08)" }}>
          <div className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5" style={{ color: CISCO_BLUE }} />
            <span className="text-xs font-medium text-slate-700">Mesh → Cisco Cloud Bridge</span>
          </div>
          <span className="text-[10px] font-semibold text-slate-500">{uplink?.cloudRegion ?? "meraki.com"}</span>
        </div>
      </CardContent>
    </Card>
  );
}
