import { LoginForm } from "@/features/auth/components/LoginForm";
import { isDev } from "@/config/env";

export function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F5F9FF] grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm space-y-8">
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
            <div className="font-display text-[22px] font-bold tracking-tight">
              Padmavat
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to your Padmavat account to continue.
            </p>
          </div>

          <LoginForm />

          {isDev && (
            <p className="text-xs text-muted-foreground">
              Demo creds:{" "}
              <span className="font-mono text-foreground/70">
                robert.fox@padmavat.health / padmavat123
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="hidden lg:flex items-center justify-center bg-primary-gradient p-12">
        <div className="max-w-md text-white">
          <h2 className="text-4xl font-bold leading-tight">
            The AI-native EHR
            <br />
            doctors actually want to use.
          </h2>
          <p className="text-white/80 mt-4 leading-relaxed">
            Padmavat brings clinical intelligence to your daily practice. Spend
            less time on paperwork and more time with patients.
          </p>
        </div>
      </div>
    </div>
  );
}
