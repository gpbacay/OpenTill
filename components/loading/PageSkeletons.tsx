import { Skeleton } from "@/components/motion/skeleton";

function LoadingRegion({ children, label = "Loading content" }: { children: React.ReactNode; label?: string }) {
  return (
    <div role="status" aria-label={label} className="contents">
      {children}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function TablePageSkeleton({ stats = 3 }: { stats?: number }) {
  return (
    <LoadingRegion label="Loading table">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden py-1">
        <div className="hidden grid-cols-2 gap-3 sm:grid lg:grid-cols-4">
          {Array.from({ length: stats }).map((_, index) => (
            <div key={index} className="rounded-xl bg-card p-4">
              <Skeleton className="mb-3 h-3 w-24" />
              <Skeleton className="h-7 w-32" />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-full sm:w-64" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="min-h-72 flex-1 overflow-hidden rounded-xl bg-card p-3">
          <Skeleton className="mb-4 h-8 w-full" />
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}

export function DashboardPageSkeleton() {
  return (
    <LoadingRegion label="Loading dashboard">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden py-1">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-5">
          <Skeleton className="min-h-64 rounded-xl lg:col-span-3" />
          <Skeleton className="min-h-64 rounded-xl lg:col-span-2" />
        </div>
      </div>
    </LoadingRegion>
  );
}

export function RegisterPageSkeleton() {
  return (
    <LoadingRegion label="Loading register">
      <div className="grid min-h-0 flex-1 gap-4 py-1 lg:grid-cols-12">
        <div className="flex min-h-0 flex-col gap-3 lg:col-span-8">
          <div className="flex gap-2">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 w-32" />
          </div>
          <Skeleton className="min-h-80 flex-1 rounded-xl" />
        </div>
        <Skeleton className="hidden min-h-80 rounded-xl lg:col-span-4 lg:block" />
      </div>
    </LoadingRegion>
  );
}

export function FormPageSkeleton() {
  return (
    <LoadingRegion label="Loading form">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
        <Skeleton className="h-8 w-full" />
      </div>
    </LoadingRegion>
  );
}

export function AppShellSkeleton() {
  return (
    <LoadingRegion label="Loading OpenTill">
      <div className="flex min-h-svh bg-background">
        <aside className="hidden w-64 shrink-0 flex-col gap-6 bg-background p-4 md:flex">
          <Skeleton className="h-8 w-32" />
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
          <Skeleton className="mt-auto h-10 w-full" />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center px-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="ml-auto size-8" />
          </header>
          <main className="flex min-h-0 flex-1 px-4 pb-20 md:pb-4">
            <DashboardPageSkeleton />
          </main>
        </div>
      </div>
    </LoadingRegion>
  );
}
