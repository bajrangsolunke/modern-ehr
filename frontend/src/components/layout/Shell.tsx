import { Outlet } from "react-router-dom";
import { Topbar } from "./Topbar";

export function Shell() {
  return (
    <div className="min-h-screen bg-[#F5F9FF]">
      <Topbar />
      <main className="mx-auto w-full max-w-[1720px] px-5 sm:px-6 lg:px-8 3xl:px-10 py-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
