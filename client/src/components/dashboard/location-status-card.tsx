import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Battery, MapPin, RefreshCw, Signal, UserRound } from "lucide-react";
import { formatRounded } from "@/lib/utils";

interface LocationStatusCardProps {
  userLocation: { latitude: number; longitude: number } | null;
  onRefresh: () => Promise<void>;
}

export function LocationStatusCard({ userLocation, onRefresh }: LocationStatusCardProps) {
  return (
    <Card className="rounded-lg border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-base text-slate-950">
          <UserRound className="mr-2 h-4 w-4 text-rose-600" />
          Responder Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {userLocation ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-emerald-900">GPS locked</p>
                <p className="mt-1 text-xs text-emerald-700">
                  {formatRounded(userLocation.latitude, 4)}, {formatRounded(userLocation.longitude, 4)}
                </p>
              </div>
              <Button size="icon" variant="outline" className="h-8 w-8 bg-white" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Acquiring GPS signal. Location sharing will activate when permission is available.
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-slate-200 p-3">
            <Signal className="mx-auto mb-2 h-4 w-4 text-emerald-600" />
            <div className="text-xs font-medium text-slate-600">Strong</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <Battery className="mx-auto mb-2 h-4 w-4 text-emerald-600" />
            <div className="text-xs font-medium text-slate-600">85%</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <MapPin className="mx-auto mb-2 h-4 w-4 text-blue-600" />
            <div className="text-xs font-medium text-slate-600">RVCE</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
