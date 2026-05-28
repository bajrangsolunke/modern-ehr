/**
 * Pill-shaped select matching the app's input style. Use a controlled
 * `value`/`onChange` pair just like Input. Children are <option> tags.
 */
import { ChevronDown } from "lucide-react";

interface Props {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function Select({ id, value, onChange, children, disabled }: Props) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="appearance-none w-full h-10 rounded-full border border-border bg-white px-3 pr-9 text-sm shadow-soft ring-focus disabled:opacity-60"
      >
        {children}
      </select>
      <ChevronDown className="size-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}
