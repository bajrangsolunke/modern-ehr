import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { useForm, zodResolver, z } from "@/lib/form";
import { PortraitUploader } from "@/features/patients/components/PortraitUploader";
import { useUpdateSelf } from "@/features/auth/hooks/use-self";
import { useAuthStore } from "@/stores/auth-store";

const schema = z.object({
  full_name: z.string().min(1, "Full name is required").max(255),
  specialty: z.string().max(255).optional().or(z.literal("")),
  avatar_url: z.string().optional().or(z.literal("")),
});

type Values = z.infer<typeof schema>;

export function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const update = useUpdateSelf();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: user?.name ?? "",
      specialty: user?.specialty ?? "",
      avatar_url: user?.avatarUrl ?? "",
    },
    values: {
      full_name: user?.name ?? "",
      specialty: user?.specialty ?? "",
      avatar_url: user?.avatarUrl ?? "",
    },
  });

  const avatarUrl = watch("avatar_url");
  const nameValue = watch("full_name");

  const onSubmit = handleSubmit(async (values) => {
    await update.mutateAsync({
      full_name: values.full_name,
      specialty: values.specialty || null,
      avatar_url: values.avatar_url || null,
    });
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Profile</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          This is what colleagues see in patient charts and audit logs.
        </p>
      </CardHeader>
      <CardContent className="pb-5">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="flex items-start gap-5">
            <PortraitUploader
              name={nameValue || user?.name || "You"}
              src={avatarUrl || undefined}
              onChange={(dataUrl) =>
                setValue("avatar_url", dataUrl, { shouldDirty: true })
              }
            />
            <div className="flex-1 min-w-0 self-center space-y-1">
              <div className="text-sm font-semibold">Profile photo</div>
              <p className="text-xs text-muted-foreground">
                Tap the camera to upload. The image is resized client-side.
              </p>
              <p className="text-[11px] text-muted-foreground">
                <strong className="text-foreground/80">{user?.email}</strong> ·{" "}
                <span className="capitalize">{user?.role}</span> (managed by admin)
              </p>
            </div>
          </div>
          <input type="hidden" {...register("avatar_url")} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <FormField
              label="Full name"
              required
              htmlFor="self-name"
              error={errors.full_name?.message}
            >
              <Input id="self-name" {...register("full_name")} />
            </FormField>

            <FormField
              label="Specialty"
              htmlFor="self-specialty"
              hint="Shown next to your name on the patient chart."
              error={errors.specialty?.message}
            >
              <Input id="self-specialty" {...register("specialty")} />
            </FormField>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={update.isPending || !isDirty}>
              {update.isPending && <Loader2 className="size-4 animate-spin" />}
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
