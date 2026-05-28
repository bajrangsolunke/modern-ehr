import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useDeleteNote,
  useNotes,
} from "@/features/patients/hooks/use-notes";
import { cn, formatDate, formatTime } from "@/lib/utils";
import type { SoapNote } from "@/types";

interface Props {
  patientId: string;
}

export function SoapNotesCard({ patientId }: Props) {
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState<SoapNote | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useNotes(patientId);
  const remove = useDeleteNote(patientId);

  // Backend orders by created_at DESC but be defensive — sort newest first.
  const notes = (data ?? [])
    .slice()
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const latest = notes[0];
  const older = notes.slice(1);

  const openCreate = () => navigate(`/patients/${patientId}/notes/new`);
  const openEdit = (n: SoapNote) =>
    navigate(`/patients/${patientId}/notes/${n.id}`);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="min-w-0">
            <CardTitle>SOAP notes</CardTitle>
            {latest && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Latest · {formatDate(latest.date)} · {formatTime(latest.date)} ·{" "}
                {latest.author} · v{latest.version}
              </p>
            )}
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-3.5" /> New note
          </Button>
        </CardHeader>
        <CardContent className="pb-5 space-y-4">
          {isLoading && <NotesSkeleton />}

          {isError && !isLoading && (
            <ErrorBanner
              title="Couldn't load notes"
              message={error instanceof Error ? error.message : "Please try again."}
              onRetry={() => refetch()}
              retrying={isFetching}
            />
          )}

          {!isLoading && !isError && notes.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6 rounded-xl bg-surface-subtle">
              No SOAP notes yet. Click <strong>New note</strong> to write the first one.
            </div>
          )}

          {!isLoading && !isError && latest && (
            <LatestNote
              note={latest}
              onEdit={() => openEdit(latest)}
              onDelete={() => setPendingDelete(latest)}
            />
          )}

          {!isLoading && !isError && older.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold px-1">
                Previous notes ({older.length})
              </h4>
              {older.map((n) => (
                <OlderNote
                  key={n.id}
                  note={n}
                  onEdit={() => openEdit(n)}
                  onDelete={() => setPendingDelete(n)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Remove SOAP note?"
        description="This deletes the note from the chart. Most teams retain notes for audit — make sure this is the right action."
        confirmLabel="Remove note"
        destructive
        busy={remove.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await remove.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}

function LatestNote({
  note,
  onEdit,
  onDelete,
}: {
  note: SoapNote;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl bg-surface-subtle p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="info" size="sm">
            v{note.version}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDate(note.date)} · {formatTime(note.date)} · {note.author}
          </span>
        </div>
        <RowMenu onEdit={onEdit} onDelete={onDelete} />
      </div>
      <Tabs defaultValue="S">
        <TabsList>
          <TabsTrigger value="S">Subjective</TabsTrigger>
          <TabsTrigger value="O">Objective</TabsTrigger>
          <TabsTrigger value="A">Assessment</TabsTrigger>
          <TabsTrigger value="P">Plan</TabsTrigger>
        </TabsList>
        <TabsContent value="S">
          <NoteSection text={note.subjective} />
        </TabsContent>
        <TabsContent value="O">
          <NoteSection text={note.objective} />
        </TabsContent>
        <TabsContent value="A">
          <NoteSection text={note.assessment} />
        </TabsContent>
        <TabsContent value="P">
          <NoteSection text={note.plan} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OlderNote({
  note,
  onEdit,
  onDelete,
}: {
  note: SoapNote;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = `note-panel-${note.id}`;
  return (
    <div className="rounded-xl bg-surface-subtle/60 border border-border/60">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex items-center gap-2 min-w-0 flex-1 text-left ring-focus rounded-lg"
        >
          {open ? (
            <ChevronDown className="size-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
          )}
          <Badge variant="neutral" size="sm" className="shrink-0">
            v{note.version}
          </Badge>
          <span className="text-sm font-medium truncate">
            {formatDate(note.date)} · {note.author}
          </span>
        </button>
        <RowMenu onEdit={onEdit} onDelete={onDelete} />
      </div>
      {open && (
        <div
          id={panelId}
          className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <Section label="Subjective" text={note.subjective} />
          <Section label="Objective" text={note.objective} />
          <Section label="Assessment" text={note.assessment} />
          <Section label="Plan" text={note.plan} />
        </div>
      )}
    </div>
  );
}

function Section({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
        {label}
      </div>
      <NoteSection text={text} />
    </div>
  );
}

function NoteSection({ text }: { text: string }) {
  if (!text || !text.trim()) {
    return <p className="text-sm text-muted-foreground italic">Not documented.</p>;
  }
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
  );
}

function RowMenu({
  onEdit,
  onDelete,
  busy,
}: {
  onEdit: () => void;
  onDelete: () => void;
  busy?: boolean;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full shrink-0"
          aria-label="Note actions"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MoreVertical className="size-4" />
          )}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-40 rounded-2xl bg-white shadow-elev border border-border p-1.5 animate-fade-in"
        >
          <MenuItem icon={<Pencil className="size-4" />} onSelect={onEdit}>
            Edit
          </MenuItem>
          <DropdownMenu.Separator className="h-px bg-border my-1" />
          <MenuItem
            icon={<Trash2 className="size-4" />}
            onSelect={onDelete}
            destructive
          >
            Remove
          </MenuItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuItem({
  icon,
  children,
  onSelect,
  destructive,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onSelect: () => void;
  destructive?: boolean;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm rounded-xl cursor-pointer outline-none",
        destructive
          ? "hover:bg-danger/10 text-danger"
          : "hover:bg-secondary text-foreground"
      )}
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

function NotesSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-10 rounded-xl" />
      <Skeleton className="h-10 rounded-xl" />
    </div>
  );
}
