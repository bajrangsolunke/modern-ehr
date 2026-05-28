import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ className, invalid, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-full border bg-surface px-4 text-base ring-focus transition",
        invalid
          ? "border-danger focus-visible:ring-danger/30"
          : "border-border focus-visible:border-primary/40",
        className
      )}
      {...rest}
    />
  )
);
Input.displayName = "Input";
