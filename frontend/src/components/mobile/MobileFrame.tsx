import { cn } from "@/lib/utils";

export function MobileFrame({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative w-[360px] h-[740px] rounded-[44px] border-[10px] border-slate-900 bg-white shadow-elev overflow-hidden",
        className
      )}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-32 bg-slate-900 rounded-b-2xl z-20" />
      <div className="h-full overflow-y-auto scrollbar-hide bg-background">
        {children}
      </div>
    </div>
  );
}
