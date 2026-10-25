"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Analytics01Icon,
  Cancel01Icon,
  HelpCircleIcon,
  Home01Icon,
  InformationCircleIcon,
  Invoice01Icon,
  Logout01Icon,
  Notification03Icon,
  Package01Icon,
  Settings01Icon,
  ShoppingCart01Icon,
  Store01Icon,
  TruckDeliveryIcon,
  UserGroupIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { useAuth } from "@/contexts/auth-context";
import { usePos } from "@/contexts/pos-context";
import { isCashier, type LocalUser } from "@/lib/local-auth";
import { ALWAYS_OPEN, cashierPages } from "@/lib/cashier-pages";
import { useRealtimeStatus } from "@/lib/realtime";
import { useRecentActivity } from "@/hooks/use-recent-activity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/LogoutButton";
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
  useSidebar,
} from "@/components/ui/sidebar";

// The phone's bottom bar picks its tabs in app/(pos)/layout.tsx; the rest live in the hamburger menu.
export const MENU_ITEMS = [
  { id: "home", href: "/", label: "Dashboard", icon: Home01Icon },
  { id: "suppliers", href: "/suppliers", label: "Suppliers", icon: TruckDeliveryIcon },
  { id: "inventory", href: "/inventory", label: "Inventory", icon: Package01Icon },
  { id: "records", href: "/records", label: "Sales", icon: Invoice01Icon },
  { id: "orders", href: "/orders", label: "Register", icon: ShoppingCart01Icon },
  { id: "expenses", href: "/expenses", label: "Expenses", icon: Wallet01Icon },
  { id: "reports", href: "/reports", label: "Reports", icon: Analytics01Icon },
  { id: "activity", href: "/activity", label: "Recent activity", icon: Notification03Icon },
  { id: "stores", href: "/stores", label: "Stores", icon: Store01Icon },
  { id: "cashiers", href: "/cashiers", label: "Cashiers", icon: UserGroupIcon },
  { id: "settings", href: "/settings", label: "Settings", icon: Settings01Icon },
  { id: "help", href: "/help", label: "Help center", icon: HelpCircleIcon },
  { id: "about", href: "/about", label: "About", icon: InformationCircleIcon },
] as const;

/** Whether `user` may open `href` (query string ignored). Cashiers get the Register, Account and the pages their admin turned on. */
export function canOpen(user: LocalUser | null | undefined, href: string) {
  if (!isCashier(user)) return true;
  const path = href.split("?")[0];
  return [...ALWAYS_OPEN, ...cashierPages(user?.pages)].some((p) => path === p || path.startsWith(`${p}/`));
}

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
        <button
          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-sidebar-accent"
        >
          <span className="relative shrink-0">
            <Avatar className="size-8">
              {user.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
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
          <DropdownMenuItem
            key={tenant.id}
            disabled={tenant.id === activeTenant.id}
            onClick={() => handleSwitchTenant(tenant.id)}
          >
            {tenant.id === activeTenant.id ? `${tenant.name} (current)` : tenant.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
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
  const { user } = useAuth();
  const { unreadCount } = useRecentActivity();
  const { setOpenMobile } = useSidebar();
  // Close the phone menu after navigating.
  useEffect(() => setOpenMobile(false), [pathname, setOpenMobile]);
  if (!activeTenant) return null;
  const queued = offlineQueue.filter((entry) => entry.order.tenantId === activeTenant.id).length;

  return (
    <Sidebar variant="inset" collapsible="offcanvas">
      <SidebarHeader className="flex-row items-center justify-between px-4 py-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
          <img src="/icon-light.png" alt="" width={24} height={24} className="size-6 dark:invert" />
          OpenTill
        </Link>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setOpenMobile(false)}
          aria-label="Close menu"
          className="text-muted-foreground md:hidden"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={18} />
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {MENU_ITEMS.filter((item) => canOpen(user, item.href)).map((item) => {
                const active = activeSection === item.id;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild isActive={active} className="h-11 gap-3 text-[15px] md:h-8 md:gap-2 md:text-sm">
                      <Link href={item.href}>
                        <HugeiconsIcon icon={item.icon} size={18} className="md:size-4" />
                        <span>{item.label}</span>
                        {item.id === "records" && queued > 0 ? (
                          <span className="ml-auto text-xs text-primary">{queued}</span>
                        ) : null}
                        {item.id === "activity" && unreadCount > 0 ? (
                          <span className="ml-auto min-w-5 rounded-full bg-primary px-1.5 text-center text-[10px] font-semibold text-primary-foreground">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
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
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1"><StoreMenu /></div>
          <LogoutButton>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Log out"
              title="Log out"
              className="text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon icon={Logout01Icon} size={17} />
            </Button>
          </LogoutButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
