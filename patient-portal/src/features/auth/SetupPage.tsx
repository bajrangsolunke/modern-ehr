import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
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
      <PageFrame>
        <Card>
          <CardHeader>
            <CardTitle>Missing setup link</CardTitle>
            <CardDescription>
              Open the setup link your provider shared with you.
            </CardDescription>
          </CardHeader>
        </Card>
      </PageFrame>
    );
  }

  if (verify.isLoading) {
    return (
      <PageFrame>
        <div className="grid place-items-center py-8">
          <Spinner className="size-6 text-primary" />
        </div>
      </PageFrame>
    );
  }

  if (verify.isError || !verify.data) {
    return (
      <PageFrame>
        <Card>
          <CardHeader>
            <CardTitle>Link expired</CardTitle>
            <CardDescription>
              This setup link is no longer valid. Ask your provider for a fresh invite.
            </CardDescription>
          </CardHeader>
        </Card>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Welcome, {verify.data.first_name}</CardTitle>
          <CardDescription>
            Set a password for {verify.data.masked_email} to finish setup.
          </CardDescription>
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

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={setup.isPending}
            >
              {setup.isPending && <Spinner />}
              {setup.isPending ? "Setting up…" : "Set password & sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageFrame>
  );
}
