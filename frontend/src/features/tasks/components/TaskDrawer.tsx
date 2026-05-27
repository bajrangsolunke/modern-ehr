/**
 * Create / edit task drawer — US-TASK-2 + US-TASK-3.
 */
import { useMemo, useState } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form";
import { UserAvatar } from "@/components/ui/avatar";
import { useForm, zodResolver, z } from "@/lib/form";
import { useUsers } from "@/features/users/hooks/use-users";
import { usePatients } from "@/features/patients/hooks/use-patients";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCreateTask, useUpdateTask } from "../hooks/use-tasks";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
} from "../utils";
import type { Task, TaskCategory } from "../api/tasks-api";
import { cn } from "@/lib/utils";

const categoryEnum = z.enum([
  "reminders",
  "document",
  "image_order",
  "lab_order",
  "referral",
  "payment",
  "unsigned_encounter",
  "other",
] as const);
const priorityEnum = z.enum(["low", "medium", "high"] as const);
const statusEnum = z.enum([
  "new",
  "in_progress",
  "completed",
  "cancelled",
] as const);

const schema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional().or(z.literal("")),
  category: categoryEnum,
  priority: priorityEnum,
  status: statusEnum.optional(),
  assigned_to_user_id: z.string().optional().or(z.literal("")),
  patient_id: z.string().optional().or(z.literal("")),
  due_date: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass an existing task to switch into edit mode. */
  task?: Task;
}

export function TaskDrawer({ open, onOpenChange, task }: Props) {
  const isEdit = Boolean(task);
  const create = useCreateTask();
  const update = useUpdateTask();

  const defaults: FormValues = {
    title: task?.title ?? "",
    description: task?.description ?? "",
    category: (task?.category ?? "other") as TaskCategory,
    priority: task?.priority ?? "medium",
    status: task?.status,
    assigned_to_user_id: task?.assignedToUserId ?? "",
    patient_id: task?.patientId ?? "",
    due_date: task?.dueDate ?? "",
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const submit = handleSubmit(async (values) => {
    if (isEdit && task) {
      await update.mutateAsync({
        id: task.id,
        input: {
          title: values.title,
          description: values.description || null,
          category: values.category,
          priority: values.priority,
          status: values.status,
          assigned_to_user_id: values.assigned_to_user_id || null,
          patient_id: values.patient_id || null,
          due_date: values.due_date || null,
        },
      });
    } else {
      await create.mutateAsync({
        title: values.title,
        description: values.description || null,
        category: values.category,
        priority: values.priority,
        assigned_to_user_id: values.assigned_to_user_id || null,
        patient_id: values.patient_id || null,
        due_date: values.due_date || null,
      });
    }
    reset(defaults);
    onOpenChange(false);
  });

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit task" : "Assign a task"}
      description={
        isEdit
          ? "Update the task details, assignee, or status."
          : "Create a new task and route it to a teammate."
      }
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={isSubmitting} className="h-10">
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Assign task"}
          </Button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormField label="Title" required htmlFor="title" error={errors.title?.message}>
          <Input
            id="title"
            placeholder="Please collect the payment"
            {...register("title")}
          />
        </FormField>

        <FormField
          label="Description"
          htmlFor="description"
          hint="Optional. Free-form context for whoever picks this up."
          error={errors.description?.message}
        >
          <Textarea
            id="description"
            rows={3}
            placeholder="Take the cash from patient if there is any issue with credit card…"
            {...register("description")}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Category" required htmlFor="category" error={errors.category?.message}>
            <Select id="category" {...register("category")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Priority" required htmlFor="priority" error={errors.priority?.message}>
            <Select id="priority" {...register("priority")}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        {isEdit && (
          <FormField label="Status" htmlFor="status" error={errors.status?.message}>
            <Select id="status" {...register("status")}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </FormField>
        )}

        <FormField
          label="Assigned to"
          htmlFor="assigned_to_user_id"
          hint="Leave unassigned to add to the team's queue."
          error={errors.assigned_to_user_id?.message}
        >
          <AssigneePicker
            value={watch("assigned_to_user_id") || ""}
            onChange={(id) =>
              setValue("assigned_to_user_id", id, { shouldDirty: true })
            }
          />
          <input type="hidden" {...register("assigned_to_user_id")} />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="Patient (optional)"
            htmlFor="patient_id"
            error={errors.patient_id?.message}
          >
            <PatientPicker
              value={watch("patient_id") || ""}
              onChange={(id) =>
                setValue("patient_id", id, { shouldDirty: true })
              }
            />
            <input type="hidden" {...register("patient_id")} />
          </FormField>

          <FormField
            label="Due date"
            htmlFor="due_date"
            error={errors.due_date?.message}
          >
            <Input id="due_date" type="date" {...register("due_date")} />
          </FormField>
        </div>
      </form>
    </Drawer>
  );
}

/* -------------------------------------------------------------------------- */
/* Reusable pickers                                                           */
/* -------------------------------------------------------------------------- */

function AssigneePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 200);

  const { data: users } = useUsers({
    q: debounced || undefined,
    page: 1,
    page_size: 20,
    is_active: true,
  });

  const selected = useMemo(
    () => users?.items.find((u) => u.id === value) ?? null,
    [users, value]
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-full border border-border bg-white px-3 h-10 text-left shadow-soft ring-focus"
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <UserAvatar
              name={selected.fullName}
              src={selected.avatarUrl ?? undefined}
              size="sm"
            />
            <span className="text-sm font-medium truncate">
              {selected.fullName}
            </span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Unassigned</span>
        )}
        <ChevronDown className="size-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-2xl border border-border bg-white shadow-elev p-2 animate-fade-in">
          <div className="relative">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email…"
              className="w-full h-9 rounded-full border border-border bg-white pl-9 pr-3 text-sm ring-focus"
            />
          </div>
          <div className="max-h-64 overflow-y-auto mt-2">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                setQuery("");
              }}
              className={cn(
                "flex items-center gap-2 w-full px-2 py-2 rounded-xl hover:bg-surface-subtle text-left text-sm text-muted-foreground italic",
                value === "" && "bg-surface-subtle"
              )}
            >
              Unassigned
            </button>
            {(users?.items ?? []).map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onChange(u.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-2 rounded-xl hover:bg-surface-subtle text-left",
                  value === u.id && "bg-surface-subtle"
                )}
              >
                <UserAvatar
                  name={u.fullName}
                  src={u.avatarUrl ?? undefined}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {u.fullName}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {u.specialty ?? u.role}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PatientPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 200);

  const { data: patients } = usePatients({
    q: debounced || undefined,
    page: 1,
    page_size: 12,
  });

  const selected = useMemo(
    () => patients?.items.find((p) => p.id === value) ?? null,
    [patients, value]
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-full border border-border bg-white px-3 h-10 text-left shadow-soft ring-focus"
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <UserAvatar
              name={selected.name}
              src={selected.avatarUrl}
              size="sm"
            />
            <span className="text-sm font-medium truncate">{selected.name}</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">No patient</span>
        )}
        <ChevronDown className="size-4 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-2xl border border-border bg-white shadow-elev p-2 animate-fade-in">
          <div className="relative">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or MRN…"
              className="w-full h-9 rounded-full border border-border bg-white pl-9 pr-3 text-sm ring-focus"
            />
          </div>
          <div className="max-h-64 overflow-y-auto mt-2">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                setQuery("");
              }}
              className={cn(
                "flex items-center gap-2 w-full px-2 py-2 rounded-xl hover:bg-surface-subtle text-left text-sm text-muted-foreground italic",
                value === "" && "bg-surface-subtle"
              )}
            >
              No patient
            </button>
            {(patients?.items ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-2 rounded-xl hover:bg-surface-subtle text-left",
                  value === p.id && "bg-surface-subtle"
                )}
              >
                <UserAvatar name={p.name} src={p.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    MRN {p.mrn}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Select({
  id,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        id={id}
        {...rest}
        className="appearance-none w-full h-10 rounded-full border border-border bg-white px-3 pr-9 text-sm shadow-soft ring-focus"
      >
        {children}
      </select>
      <ChevronDown className="size-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}
