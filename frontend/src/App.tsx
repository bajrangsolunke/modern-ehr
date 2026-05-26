import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/layout/Shell";
import { DashboardPage } from "@/pages/DashboardPage";
import { PatientsPage } from "@/pages/PatientsPage";
import { PatientProfilePage } from "@/pages/PatientProfilePage";
import { InsightsPage } from "@/pages/InsightsPage";
import { MobilePage } from "@/pages/MobilePage";
import { AppointmentsPage } from "@/pages/AppointmentsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/patients/:patientId" element={<PatientProfilePage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/docs" element={<Placeholder title="Docs" />} />
        <Route path="/team" element={<Placeholder title="Team" />} />
        <Route path="/mobile" element={<MobilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
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
