import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2, Lock, Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { useForm, zodResolver, z } from "@/lib/form";
import { useAuthStore } from "@/stores/auth-store";
import { authApi } from "@/features/auth/api/auth-api";
import { useRequestReset } from "@/features/auth/hooks/use-request-reset";
import { AuthFrame } from "@/features/auth/components/AuthFrame";
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

export function ResetPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");

  if (token)
    return <FinishReset token={token} onDone={() => navigate(ROUTES.dashboard, { replace: true })} />;
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
    <AuthFrame>
      <Card className="p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Reset password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and we'll send a reset link.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
              icon={<Mail />}
              {...register("email")}
            />
          </FormField>
          <Button type="submit" size="lg" className="w-full" disabled={ask.isPending}>
            {ask.isPending && <Loader2 className="animate-spin" />}
            {ask.isPending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        <div className="text-center text-sm text-muted-foreground">
          <Link to={ROUTES.login} className="text-primary font-semibold hover:underline">
            Back to sign in
          </Link>
        </div>
      </Card>
    </AuthFrame>
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
    <AuthFrame>
      <Card className="p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
          <p className="text-sm text-muted-foreground">
            You'll be signed in once you save it.
          </p>
        </div>
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
              icon={<Lock />}
              {...register("password")}
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
              icon={<Lock />}
              {...register("confirm")}
            />
          </FormField>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {busy ? "Saving…" : "Save & sign in"}
          </Button>
        </form>
      </Card>
    </AuthFrame>
  );
}
