import { useNavigate, Link } from "react-router-dom";
import { Loader2, Lock, Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { useForm, zodResolver, z, mapApiError } from "@/lib/form";
import { useLogin } from "@/features/auth/hooks/use-login";
import { AuthFrame } from "@/features/auth/components/AuthFrame";
import { ROUTES } from "@/config/constants";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type Values = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const submit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      navigate(ROUTES.dashboard, { replace: true });
    } catch (err) {
      mapApiError(err, setError);
    }
  });

  return (
    <AuthFrame>
      <Card className="p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back. Sign in to your patient portal.
          </p>
        </div>
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
              icon={<Mail />}
              {...register("email")}
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
              icon={<Lock />}
              {...register("password")}
            />
          </FormField>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={login.isPending}
          >
            {login.isPending && <Loader2 className="animate-spin" />}
            {login.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          Forgot your password?{" "}
          <Link to={ROUTES.reset} className="text-primary font-semibold hover:underline">
            Reset it
          </Link>
        </div>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Need help signing in? Contact your provider.
      </p>
    </AuthFrame>
  );
}
