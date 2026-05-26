import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/layout/Shell";
import { DashboardPage } from "@/features/dashboard";
import { PatientsPage, PatientProfilePage } from "@/features/patients";
import { InsightsPage } from "@/features/analytics";
import { AppointmentsPage } from "@/features/appointments";
import { MobilePage } from "@/features/mobile";
import { ROUTES } from "@/config/constants";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path={ROUTES.dashboard} element={<DashboardPage />} />
        <Route path={ROUTES.patients} element={<PatientsPage />} />
        <Route path="/patients/:patientId" element={<PatientProfilePage />} />
        <Route path={ROUTES.insights} element={<InsightsPage />} />
        <Route path={ROUTES.appointments} element={<AppointmentsPage />} />
        <Route path={ROUTES.docs} element={<Placeholder title="Docs" />} />
        <Route path={ROUTES.team} element={<Placeholder title="Team" />} />
        <Route path={ROUTES.mobile} element={<MobilePage />} />
        <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
      </Route>
    </Routes>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-subtle p-12 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">
        This module is part of the platform scaffold and will be wired to live data shortly.
      </p>
    </div>
  );
}
