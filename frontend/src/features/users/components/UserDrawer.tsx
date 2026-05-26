import { ChevronDown, Loader2 } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { useForm, zodResolver, z, mapApiError } from "@/lib/form";
import {
  useCreateUser,
  useUpdateUser,
} from "@/features/users/hooks/use-users";
import type { AppUser } from "@/features/users/api/users-api";
import type { Role } from "@/types";

const roles = ["provider", "staff", "admin"] as const;

const baseShape = {
  full_name: z.string().min(1, "Full name is required").max(255),
  email: z.string().email("Invalid email"),
  role: z.enum(roles),
  specialty: z.string().max(255).optional().or(z.literal("")),
};

const createSchema = z.object({
  ...baseShape,
  password: z.string().min(8, "Min 8 characters").max(128),
});

const updateSchema = z.object({
  ...baseShape,
  // Empty string means "don't change". Otherwise must be ≥8.
  password: z.string().refine(
    (v) => v === "" || v.length >= 8,
    "Min 8 characters"
  ),
});

type CreateValues = z.infer<typeof createSchema>;
type UpdateValues = z.infer<typeof updateSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass an existing user to switch into edit mode. */
  user?: AppUser;
}

export function UserDrawer({ open, onOpenChange, user }: Props) {
  const isEdit = Boolean(user);
  const create = useCreateUser();
  const update = useUpdateUser(user?.id);

  const defaults = {
    full_name: user?.fullName ?? "",
    email: user?.email ?? "",
    role: (user?.role ?? "provider") as Role,
    specialty: user?.specialty ?? "",
    password: "",
  };

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<CreateValues | UpdateValues>({
    resolver: zodResolver(isEdit ? updateSchema : createSchema) as never,
    defaultValues: defaults,
    values: user
      ? {
          full_name: user.fullName,
          email: user.email,
          role: user.role,
          specialty: user.specialty ?? "",
          password: "",
        }
      : undefined,
  });

  const role = watch("role");

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit && user) {
        await update.mutateAsync({
          full_name: values.full_name,
          role: values.role,
          specialty: values.specialty || null,
          ...(values.password ? { password: values.password } : {}),
        });
      } else {
        await create.mutateAsync({
          email: values.email,
          full_name: values.full_name,
          role: values.role,
          specialty: values.specialty || null,
          password: (values as CreateValues).password,
        });
      }
      onOpenChange(false);
    } catch (err) {
      mapApiError(err, setError);
    }
  });

  const submitting = isEdit ? update.isPending : create.isPending;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit user" : "New user"}
      description={
        isEdit
          ? `Update profile and access for ${user?.fullName}.`
          : "Invite a new teammate. They'll sign in with the password you set."
      }
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField
          label="Full name"
          required
          htmlFor="u-name"
          error={errors.full_name?.message}
        >
          <Input id="u-name" placeholder="Dr. Jane Cooper" {...register("full_name")} />
        </FormField>

        <FormField
          label="Email"
          required
          htmlFor="u-email"
          hint={isEdit ? "Email is the durable identity and can't be changed." : undefined}
          error={errors.email?.message}
        >
          <Input
            id="u-email"
            type="email"
            placeholder="jane@padmavat.health"
            disabled={isEdit}
            {...register("email")}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Role" required htmlFor="u-role" error={errors.role?.message}>
            <Select id="u-role" {...register("role")}>
              <option value="provider">Provider</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </Select>
          </FormField>
          <FormField
            label="Specialty"
            htmlFor="u-specialty"
            hint={role === "provider" ? "e.g. Orthopedics" : "Optional"}
            error={errors.specialty?.message}
          >
            <Input id="u-specialty" {...register("specialty")} />
          </FormField>
        </div>

        <FormField
          label={isEdit ? "Reset password" : "Password"}
          required={!isEdit}
          htmlFor="u-password"
          hint={
            isEdit
              ? "Leave blank to keep the current password."
              : "Minimum 8 characters."
          }
          error={errors.password?.message}
        >
          <Input
            id="u-password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create user"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className="h-10 w-full rounded-full border border-border bg-white px-4 pr-9 text-sm shadow-soft ring-focus appearance-none cursor-pointer"
      />
      <ChevronDown className="size-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}
