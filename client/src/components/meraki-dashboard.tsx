import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import type { MerakiTelemetry } from "@/types/network";
import {
  Activity,
  AlertTriangle,
  Cloud,
  Cpu,
  Globe,
  Power,
  Radio,
  RefreshCw,
  ShieldCheck,
  Signal,
  Users,
} from "lucide-react";

// Series colors validated for the dark slate surface (dataviz palette, slots 1–2)
const DOWNLOAD_COLOR = "#3987e5";
const UPLOAD_COLOR = "#199e70";
const CISCO_BLUE = "#049fd9";

function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function MerakiDashboard() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: telemetry } = useQuery<MerakiTelemetry>({
    queryKey: ["/api/meraki/telemetry"],
    refetchInterval: 3000,
    enabled: open,
  });

  const rebootMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/meraki/reboot");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meraki/telemetry"] });
    },
  });

  const state = telemetry?.status.state ?? "online";
  const isOnline = state === "online";
  const isRebooting = state === "rebooting";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="group absolute left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-sky-200/60 bg-white/80 py-2 pl-3 pr-4 text-sm font-semibold text-slate-800 shadow-lg backdrop-blur-md transition-all hover:scale-[1.03] hover:border-sky-300 hover:shadow-sky-200/50"
          title="Open the simulated Cisco Meraki Dashboard for the MG52 edge gateway"
        >
          <span className="relative flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(4,159,217,0.15)" }}>
            <Cloud className="h-3.5 w-3.5" style={{ color: CISCO_BLUE }} />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-white bg-emerald-500 animate-pulse" />
          </span>
          Meraki Dashboard
          <span className="hidden text-[10px] font-normal text-slate-500 sm:inline">MG52 · LTE Uplink</span>
        </button>
      </DialogTrigger>

      <DialogContent className="z-50 max-h-[88vh] max-w-4xl overflow-y-auto border-slate-700 bg-slate-900 p-0 text-slate-100">
        {/* Header */}
        <div className="border-b border-white/10 bg-slate-950/60 px-6 py-4">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center justify-between gap-3 text-slate-100">
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(4,159,217,0.15)" }}>
                  <Cloud className="h-5 w-5" style={{ color: CISCO_BLUE }} />
                </span>
                <span>
                  <span className="flex items-center gap-2 text-base font-bold">
                    Cisco Meraki Dashboard
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        isRebooting
                          ? "bg-amber-500/15 text-amber-300"
                          : isOnline
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isRebooting ? "bg-amber-400 animate-pulse" : isOnline ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                      {isRebooting ? "Rebooting" : isOnline ? "Online" : "Offline"}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs font-normal text-slate-400">
                    {telemetry?.device.model ?? "Meraki MG52"} · {telemetry?.device.serial ?? "—"} · fw {telemetry?.device.firmware ?? "—"}
                  </span>
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                className="border-white/15 bg-white/5 text-xs text-slate-200 hover:bg-white/10 hover:text-white"
                onClick={() => rebootMutation.mutate()}
                disabled={rebootMutation.isPending || isRebooting}
                title="Simulate a remote reboot pushed from the Meraki cloud"
              >
                {isRebooting ? <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" /> : <Power className="mr-1.5 h-3 w-3" />}
                {isRebooting ? "Rebooting…" : "Reboot Gateway"}
              </Button>
            </DialogTitle>
          </DialogHeader>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Simulated Meraki cloud view of the edge gateway that bridges the offline LoRa mesh to the internet.
            Trigger an SOS in the app and watch the packet counters and event log react live.
          </p>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2">
          {/* Cellular backhaul */}
          <section className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Signal className="h-4 w-4" style={{ color: CISCO_BLUE }} />
              Cellular Backhaul
              <span className="ml-auto flex items-end gap-0.5" title={`Signal: ${telemetry?.cellular.signalBars ?? 0}/5 bars`}>
                {[1, 2, 3, 4, 5].map((bar) => (
                  <span
                    key={bar}
                    className="w-1 rounded-sm"
                    style={{
                      height: `${4 + bar * 2.5}px`,
                      backgroundColor: bar <= (telemetry?.cellular.signalBars ?? 0) ? "#34d399" : "rgba(255,255,255,0.15)",
                    }}
                  />
                ))}
              </span>
            </h3>
            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between"><dt className="text-slate-400">Carrier</dt><dd className="font-semibold text-slate-100">{telemetry?.cellular.carrier ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Band</dt><dd className="font-semibold text-slate-100">{telemetry?.cellular.band ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">State</dt><dd className="font-semibold text-emerald-300">{telemetry?.cellular.connectionState ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">APN</dt><dd className="font-mono text-slate-200">{telemetry?.cellular.apn ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Failover</dt><dd className="text-slate-200">{telemetry?.cellular.failover ?? "—"}</dd></div>
            </dl>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                { label: "RSRP", value: telemetry ? `${telemetry.cellular.rsrp} dBm` : "—" },
                { label: "RSRQ", value: telemetry ? `${telemetry.cellular.rsrq} dB` : "—" },
                { label: "SINR", value: telemetry ? `${telemetry.cellular.sinr} dB` : "—" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
                  <div className="text-[10px] text-slate-400">{item.label}</div>
                  <div className="text-sm font-bold text-slate-100">{item.value}</div>
                </div>
              ))}
            </div>
          </section>

          {/* WAN throughput chart */}
          <section className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Activity className="h-4 w-4" style={{ color: CISCO_BLUE }} />
                LTE Throughput
              </h3>
              <div className="flex items-center gap-3 text-[10px] text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DOWNLOAD_COLOR }} />
                  Download
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: UPLOAD_COLOR }} />
                  Upload
                </span>
              </div>
            </div>
            <div className="mt-2 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetry?.throughput ?? []} margin={{ top: 6, right: 4, bottom: 0, left: -14 }}>
                  <defs>
                    <linearGradient id="meraki-down" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={DOWNLOAD_COLOR} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={DOWNLOAD_COLOR} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="meraki-up" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={UPLOAD_COLOR} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={UPLOAD_COLOR} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="t"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={48}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    unit=" Mb"
                  />
                  <ChartTooltip
                    cursor={{ stroke: "rgba(255,255,255,0.25)", strokeDasharray: "3 3" }}
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    labelStyle={{ color: "#94a3b8" }}
                    formatter={(value: number, name: string) => [`${value} Mbps`, name === "down" ? "Download" : "Upload"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="down"
                    stroke={DOWNLOAD_COLOR}
                    strokeWidth={2}
                    fill="url(#meraki-down)"
                    dot={false}
                    activeDot={{ r: 4, stroke: "#0f172a", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="up"
                    stroke={UPLOAD_COLOR}
                    strokeWidth={2}
                    fill="url(#meraki-up)"
                    dot={false}
                    activeDot={{ r: 4, stroke: "#0f172a", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Packet inspection */}
          <section className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <ShieldCheck className="h-4 w-4" style={{ color: CISCO_BLUE }} />
              Packet Inspection
              <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                {telemetry?.packetInspection.inspectionMode ?? "L7 DPI"}
              </span>
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                <div className="text-[10px] text-slate-400">Packets Forwarded</div>
                <div className="text-lg font-bold text-slate-100">{telemetry?.packetInspection.totalForwarded.toLocaleString() ?? "—"}</div>
              </div>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.06] p-2.5">
                <div className="flex items-center gap-1 text-[10px] text-rose-300/80">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  SOS Alerts Uplinked
                </div>
                <div className="text-lg font-bold text-rose-300">{telemetry?.packetInspection.sosAlerts ?? "—"}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                <div className="text-[10px] text-slate-400">System Messages</div>
                <div className="text-lg font-bold text-slate-100">{telemetry?.packetInspection.systemMessages ?? "—"}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                <div className="text-[10px] text-slate-400">Mesh Telemetry</div>
                <div className="text-lg font-bold text-slate-100">{telemetry?.packetInspection.meshTelemetry.toLocaleString() ?? "—"}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-500/15 bg-emerald-500/[0.05] px-3 py-1.5 text-[11px]">
              <span className="text-slate-300">Threats blocked · quarantined</span>
              <span className="font-bold text-emerald-300">
                {telemetry?.packetInspection.blockedThreats ?? 0} · {telemetry?.packetInspection.quarantined ?? 0}
              </span>
            </div>
          </section>

          {/* Device + clients */}
          <section className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Cpu className="h-4 w-4" style={{ color: CISCO_BLUE }} />
              Device & Mesh Clients
            </h3>
            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between"><dt className="text-slate-400">Uptime</dt><dd className="font-semibold text-emerald-300">{telemetry ? formatUptime(telemetry.status.uptimeSeconds) : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">LAN IP</dt><dd className="font-mono text-slate-200">{telemetry?.device.lanIp ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">MAC</dt><dd className="font-mono text-slate-200">{telemetry?.device.mac ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Location</dt><dd className="text-slate-200">{telemetry?.device.address ?? "—"}</dd></div>
              <div className="flex justify-between">
                <dt className="flex items-center gap-1 text-slate-400"><Users className="h-3 w-3" /> Mesh nodes served</dt>
                <dd className="font-semibold text-slate-100">
                  {telemetry ? `${telemetry.clients.meshNodesOnline}/${telemetry.clients.meshNodesTotal} online` : "—"}
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(telemetry?.device.tags ?? []).map((tag) => (
                <Badge key={tag} className="border border-sky-500/25 bg-sky-500/10 text-[10px] text-sky-200 hover:bg-sky-500/10">
                  {tag}
                </Badge>
              ))}
            </div>
          </section>

          {/* Live uplink event log */}
          <section className="rounded-xl border border-white/10 bg-slate-950/50 p-4 md:col-span-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Radio className="h-4 w-4" style={{ color: CISCO_BLUE }} />
              Cloud Uplink Events
              <span className="ml-auto flex items-center gap-1.5 text-[10px] font-normal text-slate-400">
                <Globe className="h-3 w-3" />
                {telemetry?.cloudRegion ?? "meraki.com"}
              </span>
            </h3>
            <div className="mt-3 max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-white/10 bg-slate-950 p-3 font-mono text-[10px] leading-relaxed">
              {telemetry && telemetry.uplinkEvents.length > 0 ? (
                telemetry.uplinkEvents.map((event, index) => (
                  <div key={event.id} className={index === 0 ? "text-emerald-300" : "text-slate-400"}>
                    {event.logLines.map((line, lineIndex) => (
                      <div key={lineIndex}>{line}</div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="text-slate-500">
                  No uplink events yet — press the SOS button in the app to fire the mesh → cloud webhook.
                  <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-emerald-400/80 align-middle" />
                </div>
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
