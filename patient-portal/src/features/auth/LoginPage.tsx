import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
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

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>Welcome back. Sign in to your patient portal.</CardDescription>
          </CardHeader>
          <CardContent>
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
                  placeholder="you@email.com"
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
                  placeholder="••••••••"
                  {...register("password")}
                  invalid={Boolean(errors.password)}
                />
              </FormField>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={login.isPending}
              >
                {login.isPending && <Spinner />}
                {login.isPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Need help signing in? Contact your provider.
        </p>
      </div>
    </div>
  );
}
