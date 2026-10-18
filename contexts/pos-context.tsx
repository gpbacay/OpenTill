"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Tenant, Product, Order, OrderItem, HeldCart } from "@/lib/types";
import {
  INITIAL_TENANTS,
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
} from "@/lib/mock-data";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface PosContextValue {
  tenants: Tenant[];
  activeTenant: Tenant;
  products: Product[];
  syncedOrders: Order[];
  offlineQueue: { order: Order; items: OrderItem[] }[];
  heldCarts: HeldCart[];
  tenantHeldCarts: HeldCart[];
  tenantSyncedOrders: Order[];
  cart: CartItem[];
  isOnline: boolean;
  isSyncing: boolean;
  syncProgress: number;
  isDarkMode: boolean;
  mobileRegisterTab: "catalog" | "cart";
  mobileRecordsTab: "logs" | "analytics";
  mobileMenuOpen: boolean;
  searchHistory: string;
  setMobileRegisterTab: (tab: "catalog" | "cart") => void;
  setMobileRecordsTab: (tab: "logs" | "analytics") => void;
  setMobileMenuOpen: (open: boolean) => void;
  setSearchHistory: (value: string) => void;
  setIsDarkMode: (value: boolean | ((prev: boolean) => boolean)) => void;
  handleNetworkToggle: () => void;
  triggerOfflineSync: () => Promise<void>;
  handleAddToCart: (product: Product) => void;
  handleUpdateQuantity: (productId: string, action: "add" | "sub") => void;
  handleRemoveItem: (productId: string) => void;
  handleClearCart: () => void;
  handleHoldCart: (label: string) => void;
  handleResumeHeldCart: (id: string) => void;
  handleDeleteHeldCart: (id: string) => void;
  handleCheckout: (order: Order, items: OrderItem[]) => Promise<void>;
  handleAddProduct: (newProduct: Product) => Promise<void>;
  handleUpdateProduct: (updatedProduct: Product) => Promise<void>;
  handleDeleteProduct: (productId: string) => Promise<void>;
  handleAddTenant: (newTenant: Tenant) => Promise<void>;
  handleSwitchTenant: (tenantId: string) => void;
}

const PosContext = createContext<PosContextValue | null>(null);

type Outbox = {
  productUpserts: string[];
  productDeletes: string[];
  tenantUpserts: string[];
};

const EMPTY_OUTBOX: Outbox = {
  productUpserts: [],
  productDeletes: [],
  tenantUpserts: [],
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return fallback;
    return JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
}

function writeOutbox(outbox: Outbox) {
  localStorage.setItem("opentill_outbox", JSON.stringify(outbox));
}

export function PosProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  const [tenants, setTenants] = useState<Tenant[]>(INITIAL_TENANTS);
  const [activeTenantId, setActiveTenantId] = useState<string>(INITIAL_TENANTS[0].id);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [syncedOrders, setSyncedOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [offlineQueue, setOfflineQueue] = useState<{ order: Order; items: OrderItem[] }[]>([]);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [browserOnline, setBrowserOnline] = useState(true);
  const [forcedOffline, setForcedOffline] = useState(false);
  const isOnline = browserOnline && !forcedOffline;
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [mobileRegisterTab, setMobileRegisterTab] = useState<"catalog" | "cart">("catalog");
  const [mobileRecordsTab, setMobileRecordsTab] = useState<"logs" | "analytics">("logs");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const offlineQueueRef = useRef(offlineQueue);
  offlineQueueRef.current = offlineQueue;
  const productsRef = useRef(products);
  productsRef.current = products;
  const tenantsRef = useRef(tenants);
  tenantsRef.current = tenants;
  const outboxRef = useRef<Outbox>(EMPTY_OUTBOX);
  const syncingRef = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  // Load persisted state after mount (SSR-safe)
  useEffect(() => {
    setTenants(readStorage("opentill_tenants", INITIAL_TENANTS));
    setActiveTenantId(readStorage("opentill_active_tenant_id", INITIAL_TENANTS[0].id));
    setProducts(readStorage("opentill_products", INITIAL_PRODUCTS));
    setSyncedOrders(readStorage("opentill_orders", INITIAL_ORDERS));
    setOfflineQueue(readStorage("opentill_offline_queue", []));
    setHeldCarts(readStorage("opentill_held_carts", []));
    setIsDarkMode(readStorage("opentill_theme_dark", true));
    outboxRef.current = readStorage("opentill_outbox", EMPTY_OUTBOX);
    setBrowserOnline(navigator.onLine);
    setHydrated(true);
  }, []);

  useEffect(() => {
    const apply = () => setBrowserOnline(navigator.onLine);
    window.addEventListener("online", apply);
    window.addEventListener("offline", apply);
    return () => {
      window.removeEventListener("online", apply);
      window.removeEventListener("offline", apply);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("opentill_theme_dark", JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.remove("light-theme");
      document.body.classList.remove("light-theme");
    } else {
      document.documentElement.classList.add("light-theme");
      document.body.classList.add("light-theme");
    }
  }, [isDarkMode, hydrated]);

  const activeTenant = useMemo(() => {
    return tenants.find((t) => t.id === activeTenantId) || tenants[0];
  }, [tenants, activeTenantId]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("opentill_tenants", JSON.stringify(tenants));
  }, [tenants, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("opentill_active_tenant_id", activeTenantId);
    setCart([]);
  }, [activeTenantId, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("opentill_products", JSON.stringify(products));
  }, [products, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("opentill_orders", JSON.stringify(syncedOrders));
  }, [syncedOrders, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("opentill_offline_queue", JSON.stringify(offlineQueue));
  }, [offlineQueue, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("opentill_held_carts", JSON.stringify(heldCarts));
  }, [heldCarts, hydrated]);

  const remember = (kind: keyof Outbox, id: string, add: boolean) => {
    const box = outboxRef.current;
    const next = box[kind].filter((item) => item !== id);
    box[kind] = add ? [...next, id] : next;
    writeOutbox(box);
  };

  flushRef.current = async () => {
    if (!navigator.onLine || forcedOffline || syncingRef.current) return;
    const box = outboxRef.current;
    const hasWork =
      offlineQueueRef.current.length > 0 ||
      box.productUpserts.length > 0 ||
      box.productDeletes.length > 0 ||
      box.tenantUpserts.length > 0;
    syncingRef.current = true;
    if (hasWork) {
      setIsSyncing(true);
      setSyncProgress(15);
    }

    try {
      for (const id of [...box.productDeletes]) {
        const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
        if (res.ok || res.status === 404) remember("productDeletes", id, false);
      }

      for (const id of [...box.productUpserts]) {
        const product = productsRef.current.find((p) => p.id === id);
        if (!product) {
          remember("productUpserts", id, false);
          continue;
        }
        const put = await fetch(`/api/products/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(product),
        });
        const putBody = await put.json().catch(() => null);
        let saved = put.ok && !putBody?.error;
        if (!saved) {
          const post = await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(product),
          });
          saved = post.ok;
        }
        if (saved) remember("productUpserts", id, false);
      }

      for (const id of [...box.tenantUpserts]) {
        const tenant = tenantsRef.current.find((t) => t.id === id);
        if (!tenant) {
          remember("tenantUpserts", id, false);
          continue;
        }
        const res = await fetch("/api/tenants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tenant),
        });
        if (res.ok) remember("tenantUpserts", id, false);
      }

      const queue = offlineQueueRef.current;
      if (queue.length > 0) {
        setSyncProgress(50);
        const res = await fetch("/api/orders/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orders: queue.map((item) => item.order),
            items: queue.flatMap((item) => item.items),
          }),
        });
        if (!res.ok) throw new Error("local database sync failed");
        const ids = new Set(queue.map((item) => item.order.id));
        const syncedAt = new Date().toISOString();
        setSyncedOrders((prev) =>
          prev.map((order) =>
            ids.has(order.id)
              ? { ...order, status: "COMPLETED", isOffline: false, syncedAt }
              : order
          )
        );
        setOfflineQueue([]);
        offlineQueueRef.current = [];
      }

      const [tenantsRes, productsRes, ordersRes] = await Promise.all([
        fetch("/api/tenants"),
        fetch("/api/products"),
        fetch("/api/orders"),
      ]);

      if (tenantsRes.ok) {
        const server = await tenantsRes.json();
        if (Array.isArray(server) && server.length > 0) {
          const dirty = new Set(outboxRef.current.tenantUpserts);
          setTenants((local) => {
            const byId = new Map(local.map((t) => [t.id, t]));
            const merged = server.map((t: Tenant) =>
              dirty.has(t.id) && byId.has(t.id) ? byId.get(t.id)! : t
            );
            const ids = new Set(server.map((t: Tenant) => t.id));
            return [...merged, ...local.filter((t) => !ids.has(t.id))];
          });
        }
      }

      if (productsRes.ok) {
        const server = await productsRes.json();
        if (Array.isArray(server) && server.length > 0) {
          const dirty = new Set(outboxRef.current.productUpserts);
          const deleted = new Set(outboxRef.current.productDeletes);
          const queuedIds = new Set(
            offlineQueueRef.current.flatMap((entry) =>
              entry.items.map((item) => item.productId)
            )
          );
          setProducts((local) => {
            const byId = new Map(local.map((p) => [p.id, p]));
            const merged = server
              .filter((p: Product) => !deleted.has(p.id))
              .map((p: Product) => {
                const localProduct = byId.get(p.id);
                if (dirty.has(p.id) && localProduct) return localProduct;
                if (queuedIds.has(p.id) && localProduct) {
                  return { ...p, stock: localProduct.stock };
                }
                return p;
              });
            const ids = new Set(server.map((p: Product) => p.id));
            return [
              ...merged,
              ...local.filter((p) => !ids.has(p.id) && !deleted.has(p.id)),
            ];
          });
        }
      }

      if (ordersRes.ok) {
        const server = await ordersRes.json();
        if (Array.isArray(server)) {
          const mapped: Order[] = server.map((o: Order) => ({
            id: o.id,
            tenantId: o.tenantId,
            status: o.status,
            subtotal: o.subtotal,
            tax: o.tax,
            total: o.total,
            paymentMethod: o.paymentMethod,
            isOffline: o.isOffline,
            date: o.date,
            syncedAt: o.syncedAt,
            cashierName: o.cashierName,
            customerName: o.customerName,
            discountAmount: o.discountAmount,
            discountPercent: o.discountPercent,
            cashReceived: o.cashReceived,
            changeDue: o.changeDue,
          }));
          setSyncedOrders((local) => {
            const ids = new Set(mapped.map((o) => o.id));
            return [...local.filter((o) => !ids.has(o.id)), ...mapped];
          });
        }
      }
      if (hasWork) setSyncProgress(100);
    } catch (err) {
      console.warn(
        "Local API unreachable. Register data stays on this device.",
        err
      );
    } finally {
      syncingRef.current = false;
      setTimeout(() => {
        setIsSyncing(false);
        setSyncProgress(0);
      }, 400);
    }
  };

  useEffect(() => {
    if (!hydrated || !isOnline) return;
    void flushRef.current();
  }, [hydrated, isOnline]);

  const triggerOfflineSync = async () => {
    await flushRef.current();
  };

  const handleNetworkToggle = () => {
    if (!navigator.onLine) return;
    setForcedOffline((current) => !current);
  };

  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId: string, action: "add" | "sub") => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = action === "add" ? item.quantity + 1 : item.quantity - 1;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleHoldCart = (label: string) => {
    if (cart.length === 0) return;
    const newHold: HeldCart = {
      id: "held-" + Date.now(),
      tenantId: activeTenant.id,
      label,
      items: cart.map((i) => ({
        product: i.product,
        quantity: i.quantity,
      })),
      date: new Date().toISOString(),
    };
    setHeldCarts((prev) => [newHold, ...prev]);
    setCart([]);
  };

  const handleResumeHeldCart = (id: string) => {
    const target = heldCarts.find((hc) => hc.id === id);
    if (!target) return;
    const loadedCart = target.items
      .map((ti) => {
        const prod = products.find((p) => p.id === ti.product.id);
        return prod ? { product: prod, quantity: ti.quantity } : null;
      })
      .filter(Boolean) as CartItem[];
    setCart(loadedCart);
    setHeldCarts((prev) => prev.filter((hc) => hc.id !== id));
  };

  const handleDeleteHeldCart = (id: string) => {
    setHeldCarts((prev) => prev.filter((hc) => hc.id !== id));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCart([]);
      }
      if (e.key === "F2") {
        e.preventDefault();
        router.push("/orders");
        setTimeout(() => {
          const searchInput = document.querySelector(
            'input[placeholder*="Search by product"]'
          ) as HTMLInputElement | null;
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        }, 100);
      }
      if (e.key === "F4") {
        e.preventDefault();
        router.push("/orders");
        setTimeout(() => {
          const holdBtn = document.querySelector(
            'button[title*="Place cart on hold"]'
          ) as HTMLButtonElement | null;
          if (holdBtn) holdBtn.click();
        }, 100);
      }
      if (e.key === "F8") {
        e.preventDefault();
        router.push("/orders");
        setTimeout(() => {
          const checkoutBtn = document.querySelector(
            'button[type="submit"]'
          ) as HTMLButtonElement | null;
          if (checkoutBtn) checkoutBtn.click();
        }, 100);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const handleCheckout = async (order: Order, items: OrderItem[]) => {
    setProducts((prev) => {
      const updated = prev.map((product) => {
        const sold = items.find((item) => item.productId === product.id);
        if (!sold) return product;
        return {
          ...product,
          stock: Math.max(0, product.stock - sold.quantity),
        };
      });
      productsRef.current = updated;
      return updated;
    });

    const saved: Order = isOnline
      ? order
      : { ...order, status: "PENDING_SYNC", isOffline: true, syncedAt: undefined };
    setSyncedOrders((prev) => [saved, ...prev]);

    const queueIt = () => {
      const queued: Order = {
        ...saved,
        status: "PENDING_SYNC",
        isOffline: true,
        syncedAt: undefined,
      };
      setSyncedOrders((prev) =>
        prev.map((existing) => (existing.id === queued.id ? queued : existing))
      );
      setOfflineQueue((prev) => {
        const next = [
          ...prev.filter((entry) => entry.order.id !== queued.id),
          { order: queued, items },
        ];
        offlineQueueRef.current = next;
        return next;
      });
    };

    if (!isOnline) {
      queueIt();
      return;
    }

    try {
      const res = await fetch("/api/orders/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: [order], items }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch (err) {
      console.warn(
        "Sale kept on this device until the local database is reachable.",
        err
      );
      queueIt();
    }
  };

  const handleAddProduct = async (newProduct: Product) => {
    setProducts((prev) => {
      const next = [newProduct, ...prev];
      productsRef.current = next;
      return next;
    });
    if (!isOnline) {
      remember("productUpserts", newProduct.id, true);
      return;
    }
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct),
      });
      if (!res.ok) throw new Error("save failed");
    } catch (err) {
      console.warn("Product kept on this device.", err);
      remember("productUpserts", newProduct.id, true);
    }
  };

  const handleUpdateProduct = async (updatedProduct: Product) => {
    setProducts((prev) => {
      const next = prev.map((p) =>
        p.id === updatedProduct.id ? updatedProduct : p
      );
      productsRef.current = next;
      return next;
    });
    if (!isOnline) {
      remember("productUpserts", updatedProduct.id, true);
      return;
    }
    try {
      const res = await fetch(`/api/products/${updatedProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedProduct),
      });
      if (!res.ok) throw new Error("save failed");
    } catch (err) {
      console.warn("Product edit kept on this device.", err);
      remember("productUpserts", updatedProduct.id, true);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    setProducts((prev) => {
      const next = prev.filter((p) => p.id !== productId);
      productsRef.current = next;
      return next;
    });
    remember("productUpserts", productId, false);
    remember("productDeletes", productId, true);
    if (!isOnline) return;
    try {
      const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error("delete failed");
      remember("productDeletes", productId, false);
    } catch (err) {
      console.warn("Product removal kept on this device.", err);
    }
  };

  const handleAddTenant = async (newTenant: Tenant) => {
    setTenants((prev) => {
      const next = [...prev, newTenant];
      tenantsRef.current = next;
      return next;
    });
    if (!isOnline) {
      remember("tenantUpserts", newTenant.id, true);
      return;
    }
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTenant),
      });
      if (!res.ok) throw new Error("save failed");
    } catch (err) {
      console.warn("Store kept on this device.", err);
      remember("tenantUpserts", newTenant.id, true);
    }
  };

  const handleSwitchTenant = (tenantId: string) => {
    setActiveTenantId(tenantId);
  };

  const tenantSyncedOrders = useMemo(() => {
    return syncedOrders.filter((o) => o.tenantId === activeTenant.id);
  }, [syncedOrders, activeTenant.id]);

  const tenantHeldCarts = useMemo(() => {
    return heldCarts.filter((hc) => hc.tenantId === activeTenant.id);
  }, [heldCarts, activeTenant.id]);

  const value: PosContextValue = {
    tenants,
    activeTenant,
    products,
    syncedOrders,
    offlineQueue,
    heldCarts,
    tenantHeldCarts,
    tenantSyncedOrders,
    cart,
    isOnline,
    isSyncing,
    syncProgress,
    isDarkMode,
    mobileRegisterTab,
    mobileRecordsTab,
    mobileMenuOpen,
    searchHistory,
    setMobileRegisterTab,
    setMobileRecordsTab,
    setMobileMenuOpen,
    setSearchHistory,
    setIsDarkMode,
    handleNetworkToggle,
    triggerOfflineSync,
    handleAddToCart,
    handleUpdateQuantity,
    handleRemoveItem,
    handleClearCart,
    handleHoldCart,
    handleResumeHeldCart,
    handleDeleteHeldCart,
    handleCheckout,
    handleAddProduct,
    handleUpdateProduct,
    handleDeleteProduct,
    handleAddTenant,
    handleSwitchTenant,
  };

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

export function usePos() {
  const ctx = useContext(PosContext);
  if (!ctx) {
    throw new Error("usePos must be used within a PosProvider");
  }
  return ctx;
}
