import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Loader2, Lock, Radio, ShieldCheck, UserPlus } from "lucide-react";

const CISCO_BLUE = "#049fd9";

const MFA_ERRORS: Record<string, string> = {
  denied: "Duo rejected the authentication — the push was denied or timed out.",
  state_mismatch: "Security check failed (state mismatch). Please sign in again.",
  unknown_user: "Duo verified you, but the account no longer exists.",
  session_error: "Could not establish your session after MFA. Please retry.",
};

type LoginResponse = {
  mfaRequired: boolean;
  username?: string;
  warning?: string;
};

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Surface why Duo bounced us back here (e.g. /login?mfa=denied)
  const mfaError = useMemo(() => {
    const code = new URLSearchParams(window.location.search).get("mfa");
    return code ? MFA_ERRORS[code] ?? "Multi-factor authentication failed." : null;
  }, []);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/login", { username, password });
      return (await response.json()) as LoginResponse;
    },
    onSuccess: async (data) => {
      if (!data.mfaRequired) {
        if (data.warning) {
          toast({ title: "Signed in without MFA", description: data.warning });
        }
        setLocation("/app");
        return;
      }

      // Password factor passed — hand the browser to the Duo Universal Prompt.
      const startResponse = await apiRequest("GET", "/api/auth/duo/start");
      const { authUrl } = (await startResponse.json()) as { authUrl: string };
      window.location.href = authUrl;
    },
    onError: (error: Error) => {
      toast({
        title: "Sign-in failed",
        description: error.message.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/register", { username, password });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Account created",
        description: "Now sign in — Duo will challenge you for the second factor.",
      });
      setMode("login");
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      });
    },
  });

  const isPending = loginMutation.isPending || registerMutation.isPending;
  const redirectingToDuo = loginMutation.isSuccess && loginMutation.data?.mfaRequired;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_50%_30%,rgba(4,159,217,0.12),transparent_45%),linear-gradient(160deg,#0f172a,#020617)] px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg" style={{ backgroundColor: CISCO_BLUE }}>
            <Radio className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Aid-Response Console</h1>
          <p className="mt-1 text-sm text-slate-400">Disaster mesh command · restricted access</p>
        </div>

        <Card className="border-white/10 bg-white/[0.06] shadow-2xl backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base text-white">
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4" style={{ color: CISCO_BLUE }} />
                {mode === "login" ? "Operator Sign-in" : "Create Operator Account"}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                <ShieldCheck className="h-3 w-3" />
                Duo MFA
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mfaError && mode === "login" && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs leading-5 text-red-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {mfaError}
              </div>
            )}

            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (mode === "login") loginMutation.mutate();
                else registerMutation.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs text-slate-300">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Must match your Duo username"
                  autoComplete="username"
                  className="border-white/15 bg-white/5 text-white placeholder:text-slate-500"
                  required
                  minLength={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs text-slate-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="border-white/15 bg-white/5 text-white placeholder:text-slate-500"
                  required
                  minLength={8}
                />
              </div>

              <Button
                type="submit"
                disabled={isPending || Boolean(redirectingToDuo)}
                className="w-full text-white shadow-lg transition-transform hover:scale-[1.01]"
                style={{ backgroundColor: CISCO_BLUE }}
              >
                {redirectingToDuo ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redirecting to Cisco Duo…
                  </>
                ) : isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {mode === "login" ? "Verifying credentials…" : "Creating account…"}
                  </>
                ) : mode === "login" ? (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Sign in with Duo MFA
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Register
                  </>
                )}
              </Button>
            </form>

            <button
              className="w-full text-center text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Need an account? Register" : "Already registered? Sign in"}
            </button>

            <div className="flex items-center justify-center gap-1.5 border-t border-white/10 pt-3 text-[10px] text-slate-500">
              <ShieldCheck className="h-3 w-3" style={{ color: CISCO_BLUE }} />
              Second factor secured by Cisco Duo Universal Prompt (Web SDK v4)
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
