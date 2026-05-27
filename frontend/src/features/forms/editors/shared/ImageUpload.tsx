/**
 * Image upload that converts the picked file to a data URL and stores
 * it inline in the form payload. Good enough for first-ship insurance
 * card front/back capture; swap to object storage when forms move to
 * S3-style buckets.
 */
import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — keep JSONB rows reasonable.

interface Props {
  label: string;
  value: string | null;
  onChange: (next: string | null) => void;
}

export function ImageUpload({ label, value, onChange }: Props) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [hover, setHover] = useState(false);

  const pick = async (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("That's not an image");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("Image is too large", {
        description: "Max 2 MB. Try compressing the photo.",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(f);
  };

  return (
    <div>
      <div className="text-xs text-muted-foreground font-medium mb-1.5">
        {label}
      </div>
      <button
        type="button"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => ref.current?.click()}
        className={cn(
          "relative h-32 w-48 rounded-2xl overflow-hidden border-2 border-dashed transition ring-focus",
          value
            ? "border-border"
            : "border-border hover:border-primary/40 bg-surface-subtle"
        )}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={label}
              className="w-full h-full object-cover"
            />
            {hover && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
                className="absolute top-1.5 right-1.5 inline-grid place-items-center size-6 rounded-full bg-rose-500 text-white hover:bg-rose-600"
              >
                <X className="size-3" />
              </span>
            )}
          </>
        ) : (
          <div className="h-full w-full grid place-items-center text-muted-foreground">
            <div className="flex flex-col items-center gap-1.5">
              <ImagePlus className="size-5" />
              <span className="text-xs">Click to upload</span>
            </div>
          </div>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
      </button>
    </div>
  );
}
