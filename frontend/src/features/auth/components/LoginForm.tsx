import { Loader2, Mail, Lock } from "lucide-react";
import { useForm, zodResolver, z, mapApiError } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { useLogin } from "@/features/auth/hooks/use-login";
import { ApiError } from "@/lib/api-client";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type LoginInput = z.infer<typeof loginSchema>;

export function LoginForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "robert.fox@padmavat.health", password: "padmavat123" },
  });
  const login = useLogin();

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("password", { type: "server", message: "Incorrect email or password" });
      } else {
        const msg = mapApiError(err, setError);
        setError("root", { type: "server", message: msg });
      }
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
          icon={<Mail />}
          placeholder="you@hospital.org"
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
          icon={<Lock />}
          placeholder="••••••••"
          {...register("password")}
        />
      </FormField>

      {errors.root && (
        <p className="text-sm text-danger leading-tight">{errors.root.message}</p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={login.isPending}
      >
        {login.isPending && <Loader2 className="size-4 animate-spin" />}
        {login.isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
