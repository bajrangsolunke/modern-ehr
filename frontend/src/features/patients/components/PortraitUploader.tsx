import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn, initials, avatarColor } from "@/lib/utils";
import { fileToBoundedDataUrl } from "@/lib/image-resize";

interface Props {
  /** Seed for initials + fallback color when there's no photo yet. */
  name: string;
  /** Current photo (http(s) URL or data URL). */
  src?: string | null;
  /** Called with the new resized data URL after a successful pick. */
  onChange: (dataUrl: string) => void | Promise<void>;
  className?: string;
  /** Width of the frame; height auto-derived from 3:4 ratio. */
  size?: "sm" | "md";
  disabled?: boolean;
}

/**
 * Vertical 3:4 passport-style portrait with a camera bubble to upload a
 * new photo. The picked image is resized client-side to 360×480 JPEG
 * (~30–80 KB) before `onChange` fires so callers can feed it straight
 * into a JSON PATCH payload.
 */
export function PortraitUploader({
  name,
  src,
  onChange,
  className,
  size = "md",
  disabled,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const widthClass = size === "sm" ? "w-[88px]" : "w-[104px] sm:w-[120px]";

  const pick = () => {
    if (disabled || busy) return;
    fileRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // re-pick same file is allowed
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToBoundedDataUrl(file, 360, 480, 0.85);
      await onChange(dataUrl);
    } catch (err) {
      toast.error("Couldn't update photo", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("relative shrink-0 aspect-[3/4]", widthClass, className)}>
      <div
        className={cn(
          "relative w-full h-full rounded-2xl overflow-hidden border border-border shadow-soft",
          !src && "bg-surface-subtle"
        )}
      >
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div
            className={cn(
              "w-full h-full grid place-items-center text-2xl font-bold",
              avatarColor(name || "?")
            )}
          >
            {initials(name)}
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] grid place-items-center">
            <Loader2 className="size-5 animate-spin text-foreground" />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={pick}
        disabled={disabled || busy}
        aria-label={src ? "Change photo" : "Add photo"}
        title={src ? "Change photo" : "Add photo"}
        className="absolute -bottom-2 -right-2 size-9 rounded-full bg-primary text-primary-foreground shadow-elev grid place-items-center hover:bg-primary/90 transition ring-2 ring-white ring-focus disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <Camera className="size-4" />
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
      />
    </div>
  );
}
