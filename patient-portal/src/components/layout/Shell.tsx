import { Outlet } from "react-router-dom";
import { Topbar } from "./Topbar";
import { ChatWidget } from "@/features/chat";

export function Shell() {
  return (
    <div className="min-h-screen bg-[#F5F9FF]">
      <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-5 lg:px-6 3xl:px-8 pt-4 sm:pt-5 lg:pt-6">
        <Topbar />
      </div>
      <main className="mx-auto w-full max-w-[1720px] px-4 sm:px-5 lg:px-6 3xl:px-8 pb-6 lg:pb-8 pt-6 lg:pt-8">
        <Outlet />
      </main>
      {/* Floating chart Q&A widget — visible on every authenticated
          patient-portal page. Scoped to "you" via the patient JWT. */}
      <ChatWidget />
    </div>
  );
}
