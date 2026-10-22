"use client";

import { useRef, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ImageAdd01Icon } from "@hugeicons/core-free-icons";
import { resizeImage } from "@/lib/image";
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
  const input = useRef<HTMLInputElement>(null);
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
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        aria-label={value ? `Change ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
        className={`flex size-20 shrink-0 items-center justify-center overflow-hidden bg-input text-muted-foreground ${shape} hover:opacity-90 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none`}
      >
        {value ? <img src={value} alt="" className="size-full object-cover" /> : fallback ?? <HugeiconsIcon icon={ImageAdd01Icon} size={24} />}
      </button>
      <div className="min-w-0 space-y-1.5">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => input.current?.click()}>
            {value ? "Change" : "Add photo"}
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
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
