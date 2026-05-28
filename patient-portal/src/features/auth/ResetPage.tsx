import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/Card";
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
    <div className="min-h-screen bg-bg grid place-items-center px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Reset password</h1>
          <p className="text-muted">
            Enter your email and we'll send a reset link.
          </p>
        </div>
        <Card>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
                invalid={Boolean(errors.email)}
              />
            </FormField>
            <Button type="submit" className="w-full" disabled={ask.isPending}>
              {ask.isPending && <Spinner />}
              {ask.isPending ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
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
    <div className="min-h-screen bg-bg grid place-items-center px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Choose a new password</h1>
        </div>
        <Card>
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
                {...register("confirm")}
                invalid={Boolean(errors.confirm)}
              />
            </FormField>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Spinner />}
              {busy ? "Saving…" : "Save & sign in"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
