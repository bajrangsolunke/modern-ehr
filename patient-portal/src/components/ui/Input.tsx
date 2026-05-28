import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  invalid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, iconPosition = "left", invalid, type = "text", ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4",
              iconPosition === "left" ? "left-3" : "right-3"
            )}
          >
            {icon}
          </div>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            "flex h-10 w-full rounded-full border bg-white px-4 py-2 text-sm shadow-soft transition-colors placeholder:text-muted-foreground/70 ring-focus disabled:cursor-not-allowed disabled:opacity-50",
            invalid ? "border-danger focus-visible:ring-danger/40" : "border-border",
            icon && iconPosition === "left" && "pl-10",
            icon && iconPosition === "right" && "pr-10",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
