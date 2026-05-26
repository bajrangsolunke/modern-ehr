import { Outlet } from "react-router-dom";
import { Topbar } from "./Topbar";

export function Shell() {
  return (
    <div className="min-h-screen bg-background">
      <Topbar />
      <main className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1440px] mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
