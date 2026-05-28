import { type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/Card";

interface Props {
  title: string;
  description: string;
  icon: ReactNode;
}

export function PlaceholderPage({ title, description, icon }: Props) {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="p-12 text-center space-y-4">
          <div className="mx-auto size-14 rounded-2xl bg-primary/10 text-primary grid place-items-center [&_svg]:size-6">
            {icon}
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-foreground">Coming soon</div>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              We're polishing this part of your portal. Check back shortly.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
