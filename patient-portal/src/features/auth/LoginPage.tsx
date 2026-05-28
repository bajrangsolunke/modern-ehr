import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Spinner } from "@/components/ui/Spinner";
import { useForm, zodResolver, z } from "@/lib/form";
import { useLogin } from "@/features/auth/hooks/use-login";
import { ROUTES } from "@/config/constants";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Required"),
});
type Values = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const submit = handleSubmit(async (values) => {
    await login.mutateAsync(values);
    navigate(ROUTES.dashboard);
  });

  return (
    <div className="min-h-screen bg-bg grid place-items-center px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="size-12 rounded-full bg-primary grid place-items-center text-primary-foreground font-bold text-xl mx-auto">
            P
          </div>
          <h1 className="text-2xl font-bold text-foreground">Sign in</h1>
          <p className="text-muted">Welcome back. Sign in to your portal.</p>
        </div>

        <Card>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <FormField
              label="Email"
              htmlFor="email"
              required
              error={errors.email?.message}
            >
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
                invalid={Boolean(errors.email)}
              />
            </FormField>

            <FormField
              label="Password"
              htmlFor="password"
              required
              error={errors.password?.message}
            >
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
                invalid={Boolean(errors.password)}
              />
            </FormField>

            <Button
              type="submit"
              className="w-full"
              disabled={login.isPending}
            >
              {login.isPending && <Spinner />}
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-muted">
          Need help signing in? Contact your provider.
        </p>
      </div>
    </div>
  );
}
