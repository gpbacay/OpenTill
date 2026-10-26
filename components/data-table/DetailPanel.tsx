"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useHistoryLayer } from "@/lib/history-layer";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

/**
 * Table on the left, optional detail panel on the right. The panel only exists while a row is selected:
 * beside the table on large screens, full screen on phones.
 */
export function SplitView({ panel, children }: { panel: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">{children}</div>
      {panel}
    </div>
  );
}

export function DetailPanel({
  title,
  subtitle,
  onClose,
  children,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  // Full screen below lg, so on a phone it is a page of its own: back should close it, not the screen under it.
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useHistoryLayer(phone, onClose);
  // Keep one stable listener; onClose changes identity on every parent render.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <aside
      aria-label="Details"
      className="fixed inset-0 z-50 flex flex-col bg-card lg:static lg:inset-auto lg:z-auto lg:w-80 lg:shrink-0 lg:rounded-xl xl:w-96"
    >
      <div className="flex items-start justify-between gap-2 p-4 pb-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{title}</h2>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close" title="Close" className="shrink-0">
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-2">{children}</div>
      {actions ? <div className="flex flex-wrap gap-2 p-4 pt-2">{actions}</div> : null}
    </aside>
  );
}

export function Fields({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="space-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4">
          <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words text-right text-sm">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}
