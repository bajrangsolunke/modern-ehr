import { Pencil, ShieldOff, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import type { AppUser } from "@/features/users/api/users-api";
import type { Role } from "@/types";
import { cn, formatDate } from "@/lib/utils";

const roleLabel: Record<Role, string> = {
  provider: "Provider",
  staff: "Staff",
  admin: "Admin",
};

const roleVariant: Record<Role, "info" | "neutral" | "danger"> = {
  provider: "info",
  staff: "neutral",
  admin: "danger",
};

interface Props {
  data: AppUser[];
  onEdit: (u: AppUser) => void;
  onDeactivate: (u: AppUser) => void;
  onReactivate: (u: AppUser) => void;
}

export function UserCardGrid({ data, onEdit, onDeactivate, onReactivate }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {data.map((u, i) => (
        <motion.div
          key={u.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.025 }}
        >
          <Card className={cn("card-hover h-full", !u.isActive && "opacity-60")}>
            <CardContent className="p-4 flex flex-col h-full">
              <div className="flex items-start justify-between gap-2 mb-3">
                <Badge variant={roleVariant[u.role]} size="sm">
                  {roleLabel[u.role]}
                </Badge>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-full"
                    aria-label="Edit user"
                    onClick={() => onEdit(u)}
                  >
                    <Pencil className="size-3" />
                  </Button>
                  {u.isActive ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-full text-danger hover:bg-rose-50"
                      aria-label="Deactivate user"
                      onClick={() => onDeactivate(u)}
                    >
                      <ShieldOff className="size-3" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-full text-success hover:bg-emerald-50"
                      aria-label="Reactivate user"
                      onClick={() => onReactivate(u)}
                    >
                      <UserCheck className="size-3" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <UserAvatar
                  name={u.fullName}
                  src={u.avatarUrl ?? undefined}
                  size="lg"
                />
                <div className="min-w-0">
                  <Link
                    to={`/users/${u.id}`}
                    className="text-sm font-semibold hover:text-primary transition block truncate"
                  >
                    {u.fullName}
                  </Link>
                  <a
                    href={`mailto:${u.email}`}
                    className="text-xs text-muted-foreground hover:text-foreground transition truncate block"
                  >
                    {u.email}
                  </a>
                </div>
              </div>

              <div className="space-y-1.5 text-xs mt-auto pt-3 border-t border-border/60">
                <Row label="Specialty" value={u.specialty || "—"} />
                <Row
                  label="Status"
                  value={
                    u.isActive ? (
                      <Badge variant="success" dot size="sm">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="neutral" dot size="sm">
                        Deactivated
                      </Badge>
                    )
                  }
                />
                <Row label="Joined" value={formatDate(u.createdAt)} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground font-medium text-right truncate">{value}</span>
    </div>
  );
}
