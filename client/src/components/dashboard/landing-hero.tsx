import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Meteors } from "@/registry/magicui/meteors";
import { Ripple } from "@/registry/magicui/ripple";
import { Activity, ArrowDown, Radio, ShieldCheck } from "lucide-react";

interface LandingHeroProps {
  connectedNodes: number;
  activeConnections: number;
  onExplore: () => void;
}

export function LandingHero({
  connectedNodes,
  activeConnections,
  onExplore,
}: LandingHeroProps) {
  return (
    <section className="relative min-h-[68vh] overflow-hidden bg-[#050608] text-white">
      <Meteors number={14} className="opacity-55" />
      <Ripple className="opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(5,6,8,0.1),#050608_84%)]" />
      <div className="absolute -left-24 top-32 h-28 w-[58rem] rotate-12 rounded-full border border-sky-300/20 bg-gradient-to-r from-blue-400/16 via-slate-200/10 to-transparent shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_0_26px_rgba(56,189,248,0.14)] blur-[1px]" />
      <div className="absolute right-8 top-28 h-16 w-72 rotate-[19deg] rounded-full border border-amber-300/22 bg-gradient-to-r from-amber-300/12 to-transparent shadow-[0_0_0_1px_rgba(251,191,36,0.22),0_0_22px_rgba(251,146,60,0.16)]" />
      <div className="absolute -bottom-10 right-0 h-28 w-[44rem] -rotate-12 rounded-full border border-rose-300/22 bg-gradient-to-r from-rose-400/10 to-transparent shadow-[0_0_0_1px_rgba(251,113,133,0.2),0_0_24px_rgba(244,63,94,0.16)]" />
      <div className="absolute bottom-14 left-16 h-16 w-80 -rotate-6 rounded-full border border-indigo-300/20 bg-indigo-300/8 shadow-[0_0_0_1px_rgba(129,140,248,0.22),0_0_18px_rgba(99,102,241,0.14)]" />

      <div className="relative mx-auto flex min-h-[68vh] w-full max-w-6xl flex-col items-center justify-center px-6 py-16 text-center">
        <Badge className="mb-8 gap-2 rounded-full border-white/10 bg-white/8 px-4 py-2 text-sm font-medium text-white/80 shadow-2xl backdrop-blur-md hover:bg-white/10">
          <span className="h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.95)]" />
          Aid-Response Mesh UI
        </Badge>

        <h1 className="max-w-5xl text-balance text-5xl font-black leading-[0.95] tracking-normal text-white sm:text-7xl lg:text-8xl">
          Disaster Response
          <span className="block bg-gradient-to-r from-blue-200 via-white to-rose-200 bg-clip-text text-transparent">
            Network Console
          </span>
        </h1>

        <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-white/52 sm:text-xl">
          Coordinate resilient communication, route emergency messages, and monitor live relief nodes when normal infrastructure is unavailable.
        </p>

        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <Button
            onClick={onExplore}
            className="h-11 rounded-full bg-white px-6 text-sm font-semibold text-slate-950 hover:bg-white/90"
          >
            <Activity className="mr-2 h-4 w-4" />
            Open Network
          </Button>
          <Button
            variant="outline"
            onClick={onExplore}
            className="h-11 rounded-full border-white/15 bg-white/5 px-6 text-sm font-semibold text-white hover:bg-white/10 hover:text-white"
          >
            <ArrowDown className="mr-2 h-4 w-4" />
            View Status
          </Button>
        </div>

        <div className="mt-12 grid w-full max-w-2xl grid-cols-3 gap-3 text-left">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
            <Radio className="mb-3 h-4 w-4 text-blue-200" />
            <div className="text-2xl font-bold">{connectedNodes}</div>
            <div className="mt-1 text-xs text-white/45">nodes online</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
            <ShieldCheck className="mb-3 h-4 w-4 text-emerald-200" />
            <div className="text-2xl font-bold">{activeConnections}</div>
            <div className="mt-1 text-xs text-white/45">active links</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
            <Activity className="mb-3 h-4 w-4 text-rose-200" />
            <div className="text-2xl font-bold">Live</div>
            <div className="mt-1 text-xs text-white/45">simulation</div>
          </div>
        </div>
      </div>
    </section>
  );
}
