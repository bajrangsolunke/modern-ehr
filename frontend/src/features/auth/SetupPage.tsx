import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/features/auth/api/auth-api";
import { useAuthStore } from "@/stores/auth-store";

interface SetupInfo {
  full_name: string;
  email_masked: string;
  role: string;
}

export function SetupPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);

  const token = params.get("token") ?? "";

  const [info, setInfo] = useState<SetupInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setInfoError("No setup token provided. Check the link in your invitation email.");
      setLoadingInfo(false);
      return;
    }
    authApi
      .setupInfo(token)
      .then(setInfo)
      .catch(() =>
        setInfoError(
          "This setup link is invalid or has expired. Ask your admin to resend the invite."
        )
      )
      .finally(() => setLoadingInfo(false));
  }, [token]);

  const ROLE_LABEL: Record<string, string> = {
    provider: "Provider",
    staff: "Staff",
    admin: "Admin",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    setSubmitError(null);

    if (password.length < 8) {
      setFieldError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setFieldError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await authApi.setup({ token, password });
      setTokens({ access: res.access_token, refresh: res.refresh_token });
      navigate("/", { replace: true });
    } catch {
      setSubmitError("Couldn't complete setup. The link may have expired — ask your admin to resend.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F9FF] grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm space-y-8">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-full bg-primary-gradient grid place-items-center text-white shadow-glow">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M9 2v14M2 9h14"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display text-[22px] font-bold tracking-tight">
                Modern-EHR
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary mt-0.5">
                AI-Native
              </span>
            </div>
          </div>

          {/* Loading */}
          {loadingInfo && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Verifying your setup link…
            </div>
          )}

          {/* Error state */}
          {!loadingInfo && infoError && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
                {infoError}
              </div>
              <p className="text-xs text-muted-foreground">
                If you believe this is an error, contact your administrator.
              </p>
            </div>
          )}

          {/* Setup form */}
          {!loadingInfo && info && (
            <>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Set up your account</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Welcome, <span className="font-semibold text-foreground">{info.full_name}</span>.
                  You&apos;re joining as{" "}
                  <span className="font-semibold text-foreground">
                    {ROLE_LABEL[info.role] ?? info.role}
                  </span>{" "}
                  ({info.email_masked}). Set a password to complete your account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="password">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPw ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="confirm">
                    Confirm password
                  </label>
                  <Input
                    id="confirm"
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>

                {fieldError && (
                  <p className="text-xs text-danger">{fieldError}</p>
                )}

                {submitError && (
                  <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                    {submitError}
                  </div>
                )}

                <Button type="submit" className="w-full h-11" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Setting up…
                    </>
                  ) : (
                    "Complete setup"
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="hidden lg:flex items-center justify-center bg-primary-gradient p-12">
        <div className="max-w-md text-white">
          <h2 className="text-4xl font-bold leading-tight">
            Welcome to the team.
          </h2>
          <p className="text-white/80 mt-4 leading-relaxed">
            Set your password to access Modern-EHR and start collaborating
            with your clinical team.
          </p>
        </div>
      </div>
    </div>
  );
}
