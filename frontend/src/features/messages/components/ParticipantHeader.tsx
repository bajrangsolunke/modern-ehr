import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { UserAvatar } from "@/components/ui/avatar";
import type { Participant } from "../types";

interface Props {
  participant: Participant;
}

export function ParticipantHeader({ participant }: Props) {
  const isPatient = participant.audience === "patient";

  return (
    <div className="flex items-start gap-3 px-4 sm:px-5 py-3 border-b border-border bg-white">
      <UserAvatar
        name={participant.name}
        src={participant.avatarUrl}
        size="lg"
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-[15px] font-bold truncate">
            {participant.name}
            {participant.mrn && (
              <span className="text-muted-foreground font-medium">
                {" "}({participant.mrn})
              </span>
            )}
          </h2>
        </div>
        <div className="mt-0.5 flex items-center gap-x-4 gap-y-0.5 flex-wrap text-[11px] text-muted-foreground">
          {isPatient ? (
            <>
              {participant.dob && (
                <Meta label="DOB" value={formatDob(participant.dob)} />
              )}
              {typeof participant.age === "number" && (
                <Meta label="Age" value={`${participant.age}Y`} />
              )}
              {participant.gender && (
                <Meta label="Gender" value={participant.gender} />
              )}
              {participant.phone && (
                <Meta label="Phone No." value={participant.phone} />
              )}
              {participant.email && (
                <Meta label="Email ID" value={participant.email} />
              )}
            </>
          ) : (
            <>
              {participant.role && (
                <Meta label="Role" value={cap(participant.role)} />
              )}
              {participant.specialty && (
                <Meta label="Specialty" value={participant.specialty} />
              )}
              {participant.email && <Meta label="Email" value={participant.email} />}
            </>
          )}
        </div>
      </div>
      {isPatient && (
        <Link
          to={`/patients/${participant.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:gap-1.5 transition-all shrink-0 mt-1"
        >
          View Patient Profile <ExternalLink className="size-3" />
        </Link>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-medium text-foreground/70">{label}:</span> {value}
    </span>
  );
}

function formatDob(iso: string): string {
  // ISO date → MM/DD/YYYY for the chat header style in the design.
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${m}/${d}/${y}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
