import { Outlet } from "react-router-dom";
import { Topbar } from "./Topbar";

export function Shell() {
  return (
    <div className="min-h-screen bg-background">
      <Topbar />
      <main className="mx-auto w-full max-w-[1720px] px-4 sm:px-6 lg:px-8 3xl:px-10 py-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
