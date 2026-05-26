import { Outlet } from "react-router-dom";
import { Topbar } from "./Topbar";

export function Shell() {
  return (
    <div className="min-h-screen bg-[#E6EEFB] p-3 sm:p-4 lg:p-5 3xl:p-6">
      <div className="mx-auto w-full max-w-[1720px] rounded-[28px] bg-white shadow-[0_10px_40px_rgba(17,24,39,0.08)] ring-1 ring-black/5 overflow-hidden">
        <Topbar />
        <main className="bg-[#F5F9FF] px-5 sm:px-6 lg:px-8 3xl:px-10 py-6 lg:py-8 min-h-[calc(100vh-7rem)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
