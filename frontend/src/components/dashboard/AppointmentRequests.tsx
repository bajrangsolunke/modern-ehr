import { Calendar, Check, X } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";

const requests = [
  {
    id: "r1",
    name: "Jane Cooper",
    role: "Individual consultations",
    date: "02 Apr. 10:00 am",
  },
  {
    id: "r2",
    name: "Albert Flores",
    role: "Individual consultations",
    date: "04 Apr. 09:00 am",
  },
  {
    id: "r3",
    name: "Kristin Watson",
    role: "Individual consultations",
    date: "04 Apr. 14:00 pm",
  },
  {
    id: "r4",
    name: "Jenny Wilson",
    role: "Individual consultations",
    date: "05 Apr. 11:30 am",
  },
];

export function AppointmentRequests() {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="size-8 rounded-xl bg-primary/10 grid place-items-center text-primary">
            <Calendar className="size-4" />
          </span>
          Appoint request
        </CardTitle>
        <button className="text-sm font-medium text-primary hover:underline">
          View more
        </button>
      </CardHeader>
      <CardContent className="space-y-3 pb-5">
        {requests.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 rounded-2xl border border-border p-3 hover:border-primary/30 transition"
          >
            <UserAvatar name={r.name} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[15px] leading-tight truncate">
                {r.name}
              </div>
              <div className="text-[12px] text-muted-foreground truncate">
                {r.role}
              </div>
              <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-surface-subtle rounded-full px-2 py-0.5">
                <Calendar className="size-3" />
                {r.date}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Button
                size="icon"
                variant="ghost"
                className="size-8 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100"
              >
                <X className="size-3.5" />
              </Button>
              <Button
                size="icon"
                className="size-8 rounded-full"
              >
                <Check className="size-3.5" />
              </Button>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}
