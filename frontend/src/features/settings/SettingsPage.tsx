/**
 * Settings (US-7 .. US-12).
 *
 * Tabs:
 * - Profile     — any signed-in user; edits own name/specialty/avatar.
 * - Availability — providers + admins; weekly hours editor.
 * - Security    — change password.
 * - Notifications — placeholder until the notification pipeline lands.
 *
 * Admins manage other users' availability from the user detail page,
 * not here.
 */
import { Bell, CalendarRange, Receipt, Shield, UserRound } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { ProfileTab } from "@/features/settings/components/ProfileTab";
import { SecurityTab } from "@/features/settings/components/SecurityTab";
import { AvailabilityEditor } from "@/features/settings/components/AvailabilityEditor";

type TabValue = "profile" | "availability" | "security" | "notifications";

const TABS: { value: TabValue; label: string; icon: typeof UserRound }[] = [
  { value: "profile", label: "Profile", icon: UserRound },
  { value: "availability", label: "Availability", icon: CalendarRange },
  { value: "security", label: "Security", icon: Shield },
  { value: "notifications", label: "Notifications", icon: Bell },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const canScheduleAvailability =
    user?.role === "provider" || user?.role === "admin";

  const requested = (searchParams.get("tab") as TabValue | null) ?? "profile";
  const activeTab: TabValue =
    requested === "availability" && !canScheduleAvailability
      ? "profile"
      : requested;

  const setTab = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v === "profile") next.delete("tab");
    else next.set("tab", v);
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Settings"
        back
        onBack={() => navigate(-1)}
      />

      {user?.role === "admin" && (
        <Card className="mb-4">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center">
                <Receipt className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold">Services & Pricing</div>
                <div className="text-xs text-muted-foreground">
                  Manage the billable service catalog used by providers and the front desk.
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate("/settings/services")}
            >
              Open
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setTab} className="space-y-4">
        <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
          <TabsList className="bg-white border border-border shadow-soft p-1 h-auto">
            {TABS.filter(
              (t) => t.value !== "availability" || canScheduleAvailability
            ).map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.value} value={t.value} className="text-sm gap-1.5">
                  <Icon className="size-3.5" />
                  {t.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="profile" className="mt-0">
          <ProfileTab />
        </TabsContent>

        {canScheduleAvailability && (
          <TabsContent value="availability" className="mt-0">
            <AvailabilityEditor userId="me" />
          </TabsContent>
        )}

        <TabsContent value="security" className="mt-0">
          <SecurityTab />
        </TabsContent>

        <TabsContent value="notifications" className="mt-0">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="size-12 rounded-2xl bg-surface-subtle grid place-items-center mx-auto mb-3">
                <Bell className="size-5 text-muted-foreground" />
              </div>
              <div className="text-sm font-semibold">
                Notification preferences are coming soon
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Email + in-app alert opt-ins will live here once the notification
                pipeline ships. Critical patient alerts are always delivered.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
