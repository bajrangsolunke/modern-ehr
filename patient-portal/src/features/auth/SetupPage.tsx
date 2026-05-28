import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Spinner } from "@/components/ui/Spinner";
import { useForm, zodResolver, z } from "@/lib/form";
import { useSetup, useSetupVerify } from "@/features/auth/hooks/use-setup";
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
    navigate(ROUTES.dashboard);
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-bg grid place-items-center px-6">
        <Card className="max-w-md w-full text-center space-y-3">
          <h1 className="text-xl font-bold">Missing setup link</h1>
          <p className="text-muted text-sm">
            Open the setup link your provider shared with you.
          </p>
        </Card>
      </div>
    );
  }

  if (verify.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  if (verify.isError || !verify.data) {
    return (
      <div className="min-h-screen bg-bg grid place-items-center px-6">
        <Card className="max-w-md w-full text-center space-y-3">
          <h1 className="text-xl font-bold">Link expired</h1>
          <p className="text-muted text-sm">
            This setup link is no longer valid. Ask your provider for a fresh
            invite.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg grid place-items-center px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="size-12 rounded-full bg-primary grid place-items-center text-primary-foreground font-bold text-xl mx-auto">
            P
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome, {verify.data.first_name}
          </h1>
          <p className="text-muted">
            Set a password for {verify.data.masked_email} to finish setup.
          </p>
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

            <Button
              type="submit"
              className="w-full"
              disabled={setup.isPending}
            >
              {setup.isPending && <Spinner />}
              {setup.isPending ? "Setting up…" : "Set password & sign in"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
