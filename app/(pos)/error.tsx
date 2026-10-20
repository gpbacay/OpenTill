"use client";

import { Button } from "@/components/ui/button";

// A broken page shouldn't take the register down with it: show a retry and leave the sidebar usable.
export default function PageError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-muted-foreground">This page hit a problem. Your data is safe on this device.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
