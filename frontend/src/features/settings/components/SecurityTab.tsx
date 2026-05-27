import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { useForm, zodResolver, z, mapApiError } from "@/lib/form";
import { useChangePassword } from "@/features/auth/hooks/use-self";

const schema = z
  .object({
    current_password: z.string().min(1, "Required"),
    new_password: z.string().min(8, "Min 8 characters").max(128),
    confirm_password: z.string().min(8, "Min 8 characters"),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });

type Values = z.infer<typeof schema>;

export function SecurityTab() {
  const change = useChangePassword();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await change.mutateAsync({
        current_password: values.current_password,
        new_password: values.new_password,
      });
      reset();
    } catch (err) {
      mapApiError(err, setError, { current_password: "current_password" });
    }
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Change password</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          You'll stay signed in. Other sessions are unaffected.
        </p>
      </CardHeader>
      <CardContent className="pb-5">
        <form onSubmit={onSubmit} className="space-y-4 max-w-lg" noValidate>
          <FormField
            label="Current password"
            required
            htmlFor="pw-current"
            error={errors.current_password?.message}
          >
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              {...register("current_password")}
            />
          </FormField>

          <FormField
            label="New password"
            required
            htmlFor="pw-new"
            hint="Minimum 8 characters."
            error={errors.new_password?.message}
          >
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              {...register("new_password")}
            />
          </FormField>

          <FormField
            label="Confirm new password"
            required
            htmlFor="pw-confirm"
            error={errors.confirm_password?.message}
          >
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              {...register("confirm_password")}
            />
          </FormField>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={change.isPending}>
              {change.isPending && <Loader2 className="size-4 animate-spin" />}
              {change.isPending ? "Saving…" : "Update password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
