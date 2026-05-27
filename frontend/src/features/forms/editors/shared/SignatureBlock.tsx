/**
 * Signature block — typed name with the option to "Insert saved sign"
 * (which reuses the current user's display name as a stub for a real
 * saved-signature record). A full canvas-drawing pad is a future
 * iteration; the data model already supports it (the `signature`
 * string can become a data URL).
 */
import { Download, PenLine } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export interface SignatureValue {
  signature: string;
  name: string;
  date: string;
}

interface Props {
  value: SignatureValue;
  onChange: (next: SignatureValue) => void;
  /** Show the "Required" flag visually. */
  required?: boolean;
  /** Hide the date field — useful when the date lives in another column. */
  hideDate?: boolean;
}

export function SignatureBlock({
  value,
  onChange,
  required,
  hideDate,
}: Props) {
  const currentUser = useAuthStore((s) => s.user);

  const today = new Date().toISOString().slice(0, 10);
  const date = value.date || today;

  const setField = (k: keyof SignatureValue, v: string) =>
    onChange({ ...value, [k]: v });

  const insertSaved = () => {
    const name = currentUser?.name ?? "";
    onChange({
      signature: name,
      name,
      date: date,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Signature {required && <span className="text-danger">*</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById(
                "sig-input"
              ) as HTMLInputElement | null;
              el?.focus();
            }}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-semibold ring-focus"
            )}
          >
            <PenLine className="size-3.5" />
            Sign here
          </button>
          <span className="text-xs text-muted-foreground">Or</span>
          <button
            type="button"
            onClick={insertSaved}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-border bg-white text-foreground text-xs font-semibold ring-focus hover:bg-secondary"
          >
            <Download className="size-3.5" />
            Insert saved sign
          </button>
        </div>
        <Input
          id="sig-input"
          value={value.signature}
          onChange={(e) => setField("signature", e.target.value)}
          placeholder="Type your full name to sign"
          className="mt-3"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Name" htmlFor="sig-name" required={required}>
          <Input
            id="sig-name"
            value={value.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="Printed name"
          />
        </FormField>
        {!hideDate && (
          <FormField label="Date" htmlFor="sig-date" required={required}>
            <Input
              id="sig-date"
              type="date"
              value={date}
              onChange={(e) => setField("date", e.target.value)}
            />
          </FormField>
        )}
      </div>
    </div>
  );
}

export function emptySignature(): SignatureValue {
  return { signature: "", name: "", date: "" };
}
