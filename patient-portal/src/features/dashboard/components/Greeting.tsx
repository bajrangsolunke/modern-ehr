import { useNavigate } from "react-router-dom";
import {
  CalendarPlus,
  CreditCard,
  MessageSquare,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function timeOfDay(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

interface Props {
  firstName: string;
  upcomingCount?: number;
  unreadCount?: number;
}

export function Greeting({ firstName, upcomingCount = 0, unreadCount = 0 }: Props) {
  const navigate = useNavigate();

  const subtitle = buildSubtitle(upcomingCount, unreadCount);

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1">
        <h1 className="text-[28px] lg:text-[34px] font-bold tracking-tight leading-tight text-slate-900">
          Good {timeOfDay()}, {firstName}{" "}
          <span className="inline-block animate-pulse">👋</span>
        </h1>
        <p className="text-sm text-slate-500 max-w-2xl">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => navigate("/appointments")}>
          <CalendarPlus className="size-3.5" />
          Book appointment
        </Button>
        <Button size="sm" variant="secondary" onClick={() => navigate("/messages")}>
          <MessageSquare className="size-3.5" />
          Message doctor
        </Button>
        <Button size="sm" variant="secondary" onClick={() => navigate("/documents")}>
          <Upload className="size-3.5" />
          Upload document
        </Button>
        <Button size="sm" variant="secondary" onClick={() => navigate("/billing")}>
          <CreditCard className="size-3.5" />
          Pay bill
        </Button>
      </div>
    </div>
  );
}

function buildSubtitle(upcoming: number, unread: number): string {
  const parts: string[] = ["Your health is stable today."];
  if (upcoming > 0) {
    parts.push(
      `You have ${upcoming} upcoming ${upcoming === 1 ? "appointment" : "appointments"}`
    );
  }
  if (unread > 0) {
    parts.push(
      `${parts.length === 1 ? "You have " : "and "}${unread} unread ${unread === 1 ? "update" : "updates"}.`
    );
  } else if (upcoming > 0) {
    parts[parts.length - 1] = parts[parts.length - 1] + ".";
  }
  if (upcoming === 0 && unread === 0) {
    parts.push("Nothing on your plate right now — enjoy the calm.");
  }
  return parts.join(" ");
}
