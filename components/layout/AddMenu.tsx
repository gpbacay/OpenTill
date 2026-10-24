"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { isCashier } from "@/lib/local-auth";
import { canOpen } from "@/components/layout/Sidebar";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProductDialog } from "@/components/inventory/ProductDialog";
import { GenerateReportDialog } from "@/components/reports/GenerateReportDialog";

// The "+" quick-add menu shared by the dashboard and the phone's bottom bar.
export function AddMenu({
  className,
  iconSize = 16,
  side,
  align = "start",
}: {
  className?: string;
  iconSize?: number;
  side?: "top" | "bottom";
  align?: "start" | "end";
}) {
  const router = useRouter();
  const { user } = useAuth();
  const cashier = isCashier(user);
  const [addingProduct, setAddingProduct] = useState(false);
  const [generating, setGenerating] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" aria-label="Add" className={className}>
            <HugeiconsIcon icon={PlusSignIcon} size={iconSize} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side={side} align={align} className="min-w-40">
          <DropdownMenuItem onSelect={() => router.push("/orders")}>New sale</DropdownMenuItem>
          {cashier ? null : (
            <>
              <DropdownMenuItem onSelect={() => router.push("/expenses")}>Add expense</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAddingProduct(true)}>Add product</DropdownMenuItem>
            </>
          )}
          {canOpen(user, "/reports") ? (
            <DropdownMenuItem onSelect={() => setGenerating(true)}>Generate report</DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <ProductDialog target={addingProduct ? "new" : null} onClose={() => setAddingProduct(false)} />
      <GenerateReportDialog open={generating} onClose={() => setGenerating(false)} />
    </>
  );
}
