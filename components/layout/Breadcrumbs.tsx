"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { usePos } from "@/contexts/pos-context";
import { Button } from "@/components/ui/button";
import { titleFromPath } from "@/components/layout/Sidebar";

interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const { products } = usePos();
  const parts = pathname.split("/").filter(Boolean);
  const productRoute = parts[0] === "inventory" && parts[1] === "product" && parts[2];
  let crumbs: Crumb[];

  if (pathname === "/") {
    crumbs = [{ label: "Dashboard" }];
  } else if (productRoute) {
    const productId = decodeURIComponent(parts[2]);
    const product = products.find((item) => item.id === productId);
    crumbs = [
      { label: "Dashboard", href: "/" },
      { label: "Inventory", href: "/inventory" },
      { label: product?.name ?? "Product details" },
    ];
  } else {
    crumbs = [
      { label: "Dashboard", href: "/" },
      { label: titleFromPath(pathname) },
    ];
  }

  const current = crumbs[crumbs.length - 1];
  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2] : null;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      {parent?.href ? (
        <Button asChild size="icon" variant="ghost" className="shrink-0" title={`Back to ${parent.label}`}>
          <Link href={parent.href} aria-label={`Back to ${parent.label}`}>
            <HugeiconsIcon icon={ArrowLeft01Icon} size={17} />
          </Link>
        </Button>
      ) : null}

      <h1 className="min-w-0 flex-1 truncate text-base font-semibold sm:hidden">{current.label}</h1>

      <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 sm:block">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={`${crumb.label}-${index}`} className={`flex min-w-0 items-center gap-1.5 ${last ? "flex-1" : "shrink-0"}`}>
                {index > 0 ? <HugeiconsIcon icon={ArrowRight01Icon} size={13} className="shrink-0 text-muted-foreground" /> : null}
                {last || !crumb.href ? (
                  <span aria-current={last ? "page" : undefined} className="truncate font-semibold text-foreground">
                    {crumb.label}
                  </span>
                ) : (
                  <Link href={crumb.href} className="text-muted-foreground transition-colors hover:text-foreground">
                    {crumb.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
