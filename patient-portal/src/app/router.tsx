import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/layout/Shell";

function DashboardPlaceholder() {
  return <div className="text-foreground">Dashboard placeholder</div>;
}

function LoginPlaceholder() {
  return <div className="p-8">Login placeholder</div>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPlaceholder />} />
      <Route element={<Shell />}>
        <Route path="/" element={<DashboardPlaceholder />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
