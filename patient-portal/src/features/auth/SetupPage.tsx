import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { useForm, zodResolver, z } from "@/lib/form";
import { useSetup, useSetupVerify } from "@/features/auth/hooks/use-setup";
import { AuthFrame } from "@/features/auth/components/AuthFrame";
import { ROUTES } from "@/config/constants";

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });
type Values = z.infer<typeof schema>;

export function SetupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");
  const verify = useSetupVerify(token);
  const setup = useSetup();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const submit = handleSubmit(async (values) => {
    if (!token) return;
    await setup.mutateAsync({ token, password: values.password });
    navigate(ROUTES.dashboard, { replace: true });
  });

  if (!token) {
    return (
      <AuthFrame>
        <Card className="p-6 text-center space-y-2">
          <h1 className="text-lg font-semibold">Missing setup link</h1>
          <p className="text-sm text-muted-foreground">
            Open the setup link your provider shared with you.
          </p>
        </Card>
      </AuthFrame>
    );
  }

  if (verify.isLoading) {
    return (
      <AuthFrame>
        <div className="grid place-items-center py-8">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </AuthFrame>
    );
  }

  if (verify.isError || !verify.data) {
    return (
      <AuthFrame>
        <Card className="p-6 text-center space-y-2">
          <h1 className="text-lg font-semibold">Link expired</h1>
          <p className="text-sm text-muted-foreground">
            This setup link is no longer valid. Ask your provider for a fresh
            invite.
          </p>
        </Card>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <Card className="p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Welcome, {verify.data.first_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Set a password for {verify.data.masked_email} to finish setup.
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
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={setup.isPending}
          >
            {setup.isPending && <Loader2 className="animate-spin" />}
            {setup.isPending ? "Setting up…" : "Set password & sign in"}
          </Button>
        </form>
      </Card>
    </AuthFrame>
  );
}
