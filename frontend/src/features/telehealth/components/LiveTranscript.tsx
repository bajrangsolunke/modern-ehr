/**
 * Scrolling, speaker-attributed transcript pane displayed next to
 * the Daily iframe. Auto-scrolls to the bottom on new segments
 * unless the user has scrolled up.
 */
import { useEffect, useRef } from "react";
import { Stethoscope, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranscriptSegment } from "../api/telehealth-api";

interface Props {
  segments: TranscriptSegment[];
}

export function LiveTranscript({ segments }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      // "stuck to bottom" if within 80px of the floor
      stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (stickRef.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [segments.length]);

  return (
    <div className="flex flex-col h-full bg-slate-50/40 border-l border-border">
      <div className="px-4 py-3 border-b border-border bg-white">
        <h3 className="text-sm font-semibold">Live transcript</h3>
        <p className="text-[11px] text-muted-foreground">
          Captions update as you speak.
        </p>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {segments.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-12">
            Waiting for the first caption…
          </div>
        ) : (
          segments.map((s) => <Bubble key={s.id} segment={s} />)
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function Bubble({ segment }: { segment: TranscriptSegment }) {
  const isProvider = segment.speakerRole === "provider";
  const isPatient = segment.speakerRole === "patient";
  return (
    <div className="flex items-start gap-2">
      <div
        className={cn(
          "size-7 rounded-full grid place-items-center shrink-0 [&_svg]:size-3.5 ring-1",
          isProvider
            ? "bg-primary/10 text-primary ring-primary/20"
            : isPatient
              ? "bg-success/10 text-success ring-success/20"
              : "bg-muted text-muted-foreground ring-border",
        )}
      >
        {isProvider ? <Stethoscope /> : <UserIcon />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {segment.speakerRole}
        </div>
        <div className="text-sm leading-snug">{segment.text}</div>
      </div>
    </div>
  );
}
