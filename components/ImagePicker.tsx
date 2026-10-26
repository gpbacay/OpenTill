"use client";

import { useId, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ImageAdd01Icon } from "@hugeicons/core-free-icons";
import { PHOTO_ACCEPT, resizeImage } from "@/lib/image";
import { Button } from "@/components/ui/button";

/** Optional picture with a preview, Add/Change and Remove. Photos are shrunk to `max` pixels before `onChange`. */
export function ImagePicker({
  value,
  onChange,
  max,
  label,
  round = false,
  fallback,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  max: number;
  label: string;
  round?: boolean;
  fallback?: ReactNode;
  disabled?: boolean;
}) {
  const inputId = useId();
  const [error, setError] = useState("");
  const shape = round ? "rounded-full" : "rounded-xl";

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    try {
      onChange(await resizeImage(file, max));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "That picture couldn't be read.");
    }
  };

  return (
    <div className="relative flex items-center gap-3">
      {/* A label, not a button that calls input.click(): phones ignore that inside a dialog, and display:none inputs never open. */}
      <label
        htmlFor={inputId}
        aria-label={value ? `Change ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
        className={`flex size-20 shrink-0 items-center justify-center overflow-hidden bg-input text-muted-foreground ${shape} hover:opacity-90 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
      >
        {value ? <img src={value} alt="" className="size-full object-cover" /> : fallback ?? <HugeiconsIcon icon={ImageAdd01Icon} size={24} />}
      </label>
      <div className="min-w-0 space-y-1.5">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary" disabled={disabled}>
            <label htmlFor={inputId} className={disabled ? "pointer-events-none opacity-50" : "cursor-pointer"}>
              {value ? "Change" : "Add photo"}
            </label>
          </Button>
          {value ? (
            <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onChange("")}>
              Remove
            </Button>
          ) : null}
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
      <input
        id={inputId}
        type="file"
        accept={PHOTO_ACCEPT}
        disabled={disabled}
        className="absolute h-px w-px opacity-0"
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
