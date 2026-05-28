import { type ReactNode } from "react";

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F9FF] grid place-items-center px-6 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="size-14 rounded-full bg-primary-gradient grid place-items-center text-white shadow-glow mx-auto">
            <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 2v14M2 9h14"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="flex flex-col leading-none items-center">
            <span className="font-display text-[26px] font-bold tracking-tight">
              Modern-EHR
            </span>
            <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-primary mt-1">
              AI-Native
            </span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
