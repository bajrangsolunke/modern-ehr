import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Structural skeleton that mirrors the PatientProfilePage 3-column layout,
 * so the page doesn't visibly snap from spinner → content.
 */
export function ProfileSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-4 space-y-4">
        <Card className="p-5 space-y-3">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <Skeleton className="h-5 w-40 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-full" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
        </Card>
        <Card className="p-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </Card>
      </div>

      <div className="lg:col-span-5 space-y-4">
        <Card className="p-5 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 rounded-xl" />
          ))}
        </Card>
        <Card className="p-5 space-y-3">
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </Card>
        <Card className="p-5 space-y-2">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </Card>
      </div>

      <div className="lg:col-span-3 space-y-4">
        <Card className="p-5 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-xl" />
          ))}
        </Card>
        <Card className="p-5 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </Card>
      </div>

      <div className="lg:col-span-12">
        <Card className="p-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </Card>
      </div>
    </div>
  );
}

/**
 * Sectioned skeleton mirroring the PatientForm layout.
 */
export function FormSkeleton() {
  return (
    <div className="space-y-4 lg:space-y-5 max-w-5xl">
      {Array.from({ length: 4 }).map((_, s) => (
        <Card key={s} className="p-5 space-y-3">
          <Skeleton className="h-5 w-28 rounded-full" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20 rounded-full" />
                <Skeleton className="h-10 rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
