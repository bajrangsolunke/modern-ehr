import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn, initials, avatarColor } from "@/lib/utils";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-soft",
      className
    )}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> & { seed?: string }
>(({ className, seed = "X", ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full text-xs font-semibold",
      avatarColor(seed),
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export function UserAvatar({
  name,
  src,
  size = "md",
  variant = "seeded",
  className,
}: {
  name: string;
  src?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /**
   * "seeded" picks a stable color from a small palette based on the
   * name — good for lists where rows should be visually distinct.
   * "gradient" uses the brand primary gradient — use it for the
   * signed-in user's own avatar in chrome (topbar, profile header).
   */
  variant?: "seeded" | "gradient";
  className?: string;
}) {
  const sizes = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-9 w-9 text-xs",
    lg: "h-11 w-11 text-sm",
    xl: "h-14 w-14 text-base",
  };
  return (
    <Avatar className={cn(sizes[size], className)}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback
        seed={name}
        className={
          variant === "gradient"
            ? "!bg-primary-gradient !text-white font-bold"
            : undefined
        }
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export { Avatar, AvatarImage, AvatarFallback };
