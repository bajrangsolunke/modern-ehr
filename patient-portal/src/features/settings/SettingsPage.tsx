import { Settings, User as UserIcon, Mail, Phone, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/auth-store";
import { formatDate } from "@/lib/utils";

export function SettingsPage() {
  const me = useAuthStore((s) => s.me);
  const logout = useAuthStore((s) => s.logout);

  if (!me) return null;

  const rows: Array<{ icon: React.ReactNode; label: string; value: string }> = [
    { icon: <UserIcon />, label: "Name", value: `${me.first_name} ${me.last_name}`.trim() },
    { icon: <Mail />, label: "Email", value: me.email ?? "—" },
    { icon: <Phone />, label: "Phone", value: me.phone ?? "—" },
    { icon: <Calendar />, label: "Date of birth", value: me.dob ? formatDate(me.dob) : "—" },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Your profile, sign-in, and account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="size-4 text-primary" />
            Profile
          </CardTitle>
          <CardDescription>Need a change? Contact your provider's office.</CardDescription>
        </CardHeader>
        <CardContent>
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
            <div className="flex items-center gap-4 py-3 last:pb-0">
              <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center [&_svg]:size-4 shrink-0">
                <UserIcon />
              </div>
              <div className="min-w-0 flex-1">
                <dt className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  MRN
                </dt>
                <dd className="text-sm font-semibold text-foreground truncate">{me.mrn}</dd>
              </div>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sign out</CardTitle>
          <CardDescription>End your session on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="default" onClick={() => logout()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
