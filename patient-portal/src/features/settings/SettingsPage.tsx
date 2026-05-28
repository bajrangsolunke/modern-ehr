import { Calendar, LogOut, Mail, Phone, User as UserIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth-store";
import { formatDate } from "@/lib/utils";

export function SettingsPage() {
  const me = useAuthStore((s) => s.me);
  const logout = useAuthStore((s) => s.logout);

  if (!me) return null;

  const fullName = `${me.first_name} ${me.last_name}`.trim();
  const rows: Array<{ icon: React.ReactNode; label: string; value: string }> = [
    { icon: <UserIcon />, label: "Name", value: fullName },
    { icon: <Mail />, label: "Email", value: me.email ?? "—" },
    { icon: <Phone />, label: "Phone", value: me.phone ?? "—" },
    { icon: <Calendar />, label: "Date of birth", value: me.dob ? formatDate(me.dob) : "—" },
    { icon: <UserIcon />, label: "MRN", value: me.mrn },
  ];

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Your profile and account."
      />

      <div className="max-w-3xl space-y-4">
        <Card className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <UserAvatar
              name={fullName}
              size="xl"
              variant="gradient"
              className="ring-4 ring-white shadow-glow"
            />
            <div className="min-w-0">
              <div className="text-lg font-bold tracking-tight truncate">
                {fullName}
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {me.email ?? "Patient"}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-primary font-semibold mt-1">
                MRN {me.mrn}
              </div>
            </div>
          </div>

          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Profile details
          </div>
          <dl className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center [&_svg]:size-4 shrink-0">
                  {r.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {r.label}
                  </dt>
                  <dd className="text-sm font-semibold text-foreground truncate">
                    {r.value}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Need a change? Contact your provider's office.
          </p>
        </Card>

        <Card className="p-6">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Session
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            End your session on this device.
          </p>
          <Button variant="destructive" onClick={() => logout()}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </Card>
      </div>
    </>
  );
}
