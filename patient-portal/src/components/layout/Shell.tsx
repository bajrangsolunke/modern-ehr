import { Outlet } from "react-router-dom";
import { Header } from "./Header";

export function Shell() {
  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="max-w-column mx-auto px-6 py-8 space-y-6">
        <Outlet />
      </main>
    </div>
  );
}
