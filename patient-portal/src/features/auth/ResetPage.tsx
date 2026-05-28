import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Spinner } from "@/components/ui/Spinner";
import { useForm, zodResolver, z } from "@/lib/form";
import { useAuthStore } from "@/stores/auth-store";
import { authApi } from "@/features/auth/api/auth-api";
import { useRequestReset } from "@/features/auth/hooks/use-request-reset";
import { toast } from "@/lib/toast";
import { ROUTES } from "@/config/constants";

const resetSchema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });
type ResetValues = z.infer<typeof resetSchema>;

const requestSchema = z.object({
  email: z.string().email("Enter a valid email"),
});
type RequestValues = z.infer<typeof requestSchema>;

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F9FF] grid place-items-center px-6 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="size-14 rounded-full bg-primary-gradient grid place-items-center text-white shadow-glow mx-auto">
            <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 2v14M2 9h14"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="font-display text-[26px] font-bold tracking-tight">Padmavat</div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ResetPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");

  if (token) return <FinishReset token={token} onDone={() => navigate(ROUTES.dashboard)} />;
  return <RequestReset />;
}

function RequestReset() {
  const ask = useRequestReset();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestValues>({ resolver: zodResolver(requestSchema) });

  const submit = handleSubmit(async (values) => {
    await ask.mutateAsync(values.email);
  });

  return (
    <PageFrame>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Reset password</CardTitle>
          <CardDescription>Enter your email and we'll send a reset link.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@email.com"
                {...register("email")}
                invalid={Boolean(errors.email)}
              />
            </FormField>
            <Button type="submit" size="lg" className="w-full" disabled={ask.isPending}>
              {ask.isPending && <Spinner />}
              {ask.isPending ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageFrame>
  );
}

function FinishReset({ token, onDone }: { token: string; onDone: () => void }) {
  const setTokens = useAuthStore((s) => s.setTokens);
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema) });

  const submit = handleSubmit(async (values) => {
    setBusy(true);
    try {
      const tokens = await authApi.reset({ token, password: values.password });
      setTokens({
        access: tokens.access_token,
        refresh: tokens.refresh_token,
      });
      toast.success("Password reset. You're signed in.");
      onDone();
    } catch (err) {
      toast.error("Couldn't reset password", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  });

  return (
    <PageFrame>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Choose a new password</CardTitle>
          <CardDescription>You'll be signed in once you save it.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <FormField
              label="New password"
              htmlFor="password"
              required
              hint="At least 8 characters."
              error={errors.password?.message}
            >
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                {...register("password")}
                invalid={Boolean(errors.password)}
              />
            </FormField>
            <FormField
              label="Confirm password"
              htmlFor="confirm"
              required
              error={errors.confirm?.message}
            >
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                {...register("confirm")}
                invalid={Boolean(errors.confirm)}
              />
            </FormField>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy && <Spinner />}
              {busy ? "Saving…" : "Save & sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageFrame>
  );
}
