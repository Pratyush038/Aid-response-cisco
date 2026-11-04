import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone: "blue" | "emerald" | "amber" | "rose";
}

const toneClasses = {
  blue: "bg-blue-50 text-blue-700 border-blue-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
  rose: "bg-rose-50 text-rose-700 border-rose-100",
};

export function MetricCard({ label, value, detail, icon: Icon, tone }: MetricCardProps) {
  return (
    <Card className="rounded-lg border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-normal text-slate-950">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
          </div>
          <div className={`rounded-lg border p-2 ${toneClasses[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
