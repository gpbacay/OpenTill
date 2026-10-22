"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { CloudIcon, Database01Icon, Store02Icon, Wifi01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import pkg from "@/package.json";

const POINTS = [
  { icon: Store02Icon, title: "Built for small shops", text: "Run the register, keep stock right, track suppliers and expenses, and see how each month went." },
  { icon: Wifi01Icon, title: "Works offline", text: "Every page keeps working without internet. Sales and changes are saved on the device and sent when you're back online." },
  { icon: CloudIcon, title: "Live across devices", text: "Changes show up on every open tab and device within a moment." },
  { icon: Database01Icon, title: "Your data stays yours", text: "Records are stored in your OpenTill database and on your devices. Reports only leave when you export or share them." },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <section className="flex flex-col items-start gap-4 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center">
          <img src="/icon-light.png" alt="" width={56} height={56} className="size-14 dark:invert" />
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold tracking-tight">OpenTill</h2>
            <p className="text-sm text-muted-foreground">
              An offline-first point of sale for running one or more stores from a single place.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Version {pkg.version}</p>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          {POINTS.map((point) => (
            <div key={point.title} className="space-y-2 rounded-xl border border-border bg-card p-4">
              <HugeiconsIcon icon={point.icon} size={20} className="text-primary" />
              <p className="text-sm font-medium">{point.title}</p>
              <p className="text-sm text-muted-foreground">{point.text}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div>
            <p className="text-sm font-medium">Need a hand?</p>
            <p className="text-sm text-muted-foreground">Guides and answers to common questions.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link href="/settings">Settings</Link>
            </Button>
            <Button asChild>
              <Link href="/help">Help center</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
