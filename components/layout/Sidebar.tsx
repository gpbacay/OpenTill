"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Home01Icon,
  Invoice01Icon,
  Package01Icon,
  Settings01Icon,
  ShoppingCart01Icon,
  TruckDeliveryIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { useAuth } from "@/contexts/auth-context";
import { usePos } from "@/contexts/pos-context";
import { useRealtimeStatus } from "@/lib/realtime";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

// `primary` items sit in the phone's bottom bar; the rest live in the store menu on small screens.
export const MENU_ITEMS = [
  { id: "home", href: "/", label: "Dashboard", icon: Home01Icon, primary: true },
  { id: "orders", href: "/orders", label: "Register", icon: ShoppingCart01Icon, primary: true },
  { id: "records", href: "/records", label: "Sales", icon: Invoice01Icon, primary: true },
  { id: "inventory", href: "/inventory", label: "Inventory", icon: Package01Icon, primary: true },
  { id: "expenses", href: "/expenses", label: "Expenses", icon: Wallet01Icon, primary: true },
  { id: "suppliers", href: "/suppliers", label: "Suppliers", icon: TruckDeliveryIcon, primary: false },
  { id: "settings", href: "/settings", label: "Settings", icon: Settings01Icon, primary: false },
] as const;

export function sectionFromPath(pathname: string) {
  const match = MENU_ITEMS.find((item) => item.href !== "/" && pathname.startsWith(item.href));
  if (match) return match.id;
  return pathname.startsWith("/account") ? "account" : "home";
}

export function titleFromPath(pathname: string) {
  const section = sectionFromPath(pathname);
  return MENU_ITEMS.find((item) => item.id === section)?.label ?? (section === "account" ? "Account" : "Dashboard");
}

function initials(name: string) {
  const letters = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "OT";
}

export function StoreMenu() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeTenant, tenants, handleSwitchTenant } = usePos();
  const status = useRealtimeStatus();
  if (!activeTenant || !user) return null;
  const dot = {
    live: { color: "bg-primary", label: "Online: updates arrive instantly" },
    polling: { color: "bg-amber-400", label: "Online: live updates unavailable, refreshing every 20 seconds" },
    offline: { color: "bg-destructive", label: "Offline: changes are saved on this device" },
  }[status];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-sidebar-accent">
          <span className="relative shrink-0">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span
              role="status"
              aria-label={dot.label}
              title={dot.label}
              className={`absolute -top-0.5 -right-0.5 size-3 rounded-full ring-2 ring-sidebar ${dot.color}`}
            />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">
              {user.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {activeTenant.name}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        {tenants.map((tenant) => (
          <DropdownMenuItem key={tenant.id} onClick={() => handleSwitchTenant(tenant.id)}>
            {tenant.id === activeTenant.id ? `${tenant.name} (current)` : tenant.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {MENU_ITEMS.filter((item) => !item.primary).map((item) => (
          <DropdownMenuItem key={item.id} className="md:hidden" onSelect={() => router.push(item.href)}>
            {item.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onSelect={() => router.push("/account")}>
          Account
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AppSidebar() {
  const pathname = usePathname();
  const activeSection = sectionFromPath(pathname);
  const { activeTenant, offlineQueue } = usePos();
  if (!activeTenant) return null;
  const queued = offlineQueue.filter((entry) => entry.order.tenantId === activeTenant.id).length;

  return (
    <Sidebar variant="inset" collapsible="offcanvas">
      <SidebarHeader className="px-4 py-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
          <img src="/icon-light.png" alt="" width={24} height={24} className="size-6 dark:invert" />
          OpenTill
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {MENU_ITEMS.map((item) => {
                const active = activeSection === item.id;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link href={item.href}>
                        <HugeiconsIcon icon={item.icon} size={16} />
                        <span>{item.label}</span>
                        {item.id === "records" && queued > 0 ? (
                          <span className="ml-auto text-xs text-primary">{queued}</span>
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <StoreMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
