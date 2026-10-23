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
import { Tenant, Product, Order, OrderItem, HeldCart, StockMovement } from "@/lib/types";
import { subscribe } from "@/lib/realtime";
import { writeLocalSession } from "@/lib/local-auth";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface PosContextValue {
  tenants: Tenant[];
  activeTenant: Tenant | null;
  hydrated: boolean;
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
  mobileMenuOpen: boolean;
  setMobileRegisterTab: (tab: "catalog" | "cart") => void;
  setMobileMenuOpen: (open: boolean) => void;
  setIsDarkMode: (value: boolean | ((prev: boolean) => boolean)) => void;
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
  handleApplyMovement: (movement: StockMovement) => void;
  handleAddTenant: (newTenant: Tenant) => Promise<void>;
  handleUpdateTenant: (tenant: Tenant) => Promise<void>;
  /** Deletes stores and everything in them. Needs a connection; resolves to an error message, or null when done. */
  handleDeleteTenants: (tenantIds: string[]) => Promise<string | null>;
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

function storeKey(userId: string, name: string) {
  return `opentill_${userId}_${name}`;
}

function writeOutbox(userId: string, outbox: Outbox) {
  localStorage.setItem(storeKey(userId, "outbox"), JSON.stringify(outbox));
}

async function api(input: string, init?: RequestInit) {
  const res = await fetch(input, init);
  if (res.status === 401 && navigator.onLine) {
    // Drop the stale local session too, or /login bounces straight back to "/" and loops.
    writeLocalSession(null);
    window.location.href = "/login";
  }
  return res;
}

export function PosProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<string | null>(null);
  const hydrated = scope === userId;

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenantId, setActiveTenantId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [syncedOrders, setSyncedOrders] = useState<Order[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<{ order: Order; items: OrderItem[] }[]>([]);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [mobileRegisterTab, setMobileRegisterTab] = useState<"catalog" | "cart">("catalog");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  // Load this account's store after mount. Theme stays on the device.
  useEffect(() => {
    const key = (name: string) => storeKey(userId, name);
    const stored = {
      tenants: readStorage<Tenant[]>(key("tenants"), []),
      products: readStorage<Product[]>(key("products"), []),
      orders: readStorage<Order[]>(key("orders"), []),
    };
    const savedTenantId = readStorage(key("active_tenant_id"), "");
    const nextTenantId = stored.tenants.some((tenant) => tenant.id === savedTenantId)
      ? savedTenantId
      : stored.tenants[0]?.id ?? "";
    setTenants(stored.tenants);
    setProducts(stored.products);
    setSyncedOrders(stored.orders);
    setActiveTenantId(nextTenantId);
    setOfflineQueue(readStorage<{ order: Order; items: OrderItem[] }[]>(key("offline_queue"), []));
    setHeldCarts(readStorage(key("held_carts"), []));
    setIsDarkMode(readStorage("opentill_theme_dark", true));
    outboxRef.current = readStorage(key("outbox"), EMPTY_OUTBOX);
    setIsOnline(navigator.onLine);
    setScope(userId);
  }, [userId]);

  useEffect(() => {
    const apply = () => setIsOnline(navigator.onLine);
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
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode, hydrated]);

  const activeTenant = useMemo(() => {
    return tenants.find((t) => t.id === activeTenantId) ?? null;
  }, [tenants, activeTenantId]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storeKey(userId, "tenants"), JSON.stringify(tenants));
  }, [tenants, hydrated, userId]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storeKey(userId, "active_tenant_id"), JSON.stringify(activeTenantId));
    setCart([]);
  }, [activeTenantId, hydrated, userId]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storeKey(userId, "products"), JSON.stringify(products));
    } catch {
      // Storage full (product photos are the big part): the server copy is still saved; only the offline cache lags.
    }
  }, [products, hydrated, userId]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storeKey(userId, "orders"), JSON.stringify(syncedOrders));
  }, [syncedOrders, hydrated, userId]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storeKey(userId, "offline_queue"), JSON.stringify(offlineQueue));
  }, [offlineQueue, hydrated, userId]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storeKey(userId, "held_carts"), JSON.stringify(heldCarts));
  }, [heldCarts, hydrated, userId]);

  const remember = (kind: keyof Outbox, id: string, add: boolean) => {
    const box = outboxRef.current;
    const next = box[kind].filter((item) => item !== id);
    box[kind] = add ? [...next, id] : next;
    writeOutbox(userId, box);
  };

  flushRef.current = async () => {
    if (!navigator.onLine || syncingRef.current) return;
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
        const res = await api(`/api/products/${id}`, { method: "DELETE" });
        if (res.ok || res.status === 404) remember("productDeletes", id, false);
      }

      for (const id of [...box.productUpserts]) {
        const product = productsRef.current.find((p) => p.id === id);
        if (!product) {
          remember("productUpserts", id, false);
          continue;
        }
        const put = await api(`/api/products/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(product),
        });
        const putBody = await put.json().catch(() => null);
        let saved = put.ok && !putBody?.error;
        if (!saved) {
          const post = await api("/api/products", {
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
        const res = await api(`/api/tenants/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tenant),
        });
        // A 4xx from the API will never succeed on retry (e.g. the store was deleted elsewhere), so drop it from the queue.
        // A 404/5xx page from the host (API not deployed, or down) says nothing about the store: keep it queued.
        const fromApi = (res.headers.get("content-type") ?? "").includes("json");
        if (res.ok || (fromApi && res.status >= 400 && res.status < 500 && res.status !== 401)) remember("tenantUpserts", id, false);
      }

      const queue = offlineQueueRef.current;
      if (queue.length > 0) {
        setSyncProgress(50);
        const res = await api("/api/orders/sync", {
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

      // Commit each collection as soon as its own request finishes. A slow orders request, for
      // example, should never hold back a fresh product catalogue or tenant switcher.
      const refreshTenants = async () => {
        const response = await api("/api/tenants");
        if (!response.ok) return;
        const server = await response.json();
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
          setActiveTenantId((current) => {
            const localOnly = tenantsRef.current.filter(
              (tenant) => !server.some((item: Tenant) => item.id === tenant.id)
            );
            const available = [...server, ...localOnly];
            if (available.some((tenant) => tenant.id === current)) return current;
            return available[0]?.id ?? "";
          });
        }
      };

      const refreshProducts = async () => {
        const response = await api("/api/products");
        if (!response.ok) return;
        const server = await response.json();
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
      };

      const refreshOrders = async () => {
        const response = await api("/api/orders");
        if (!response.ok) return;
        const server = await response.json();
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
            items: o.items,
          }));
          setSyncedOrders((local) => {
            const ids = new Set(mapped.map((o) => o.id));
            return [...local.filter((o) => !ids.has(o.id)), ...mapped];
          });
        }
      };

      await Promise.allSettled([refreshTenants(), refreshProducts(), refreshOrders()]);
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
    return subscribe(["products", "orders"], () => void flushRef.current());
  }, [hydrated, isOnline]);

  const triggerOfflineSync = async () => {
    await flushRef.current();
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
            if (action === "add" && nextQty > item.product.stock) return item;
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
    if (!activeTenant || cart.length === 0) return;
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
            '[data-register-action="product-search"]'
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
            '[data-register-action="hold-sale"]'
          ) as HTMLButtonElement | null;
          if (holdBtn) {
            holdBtn.click();
            return;
          }
          const openSale = document.querySelector(
            '[data-register-action="open-sale"]'
          ) as HTMLButtonElement | null;
          openSale?.click();
          setTimeout(() => {
            const revealed = document.querySelector(
              '[data-register-action="hold-sale"]'
            ) as HTMLButtonElement | null;
            revealed?.click();
          }, 0);
        }, 100);
      }
      if (e.key === "F8") {
        e.preventDefault();
        router.push("/orders");
        setTimeout(() => {
          const checkoutBtn = document.querySelector(
            '[data-register-action="charge-sale"]'
          ) as HTMLButtonElement | null;
          if (checkoutBtn) {
            checkoutBtn.click();
            return;
          }
          const openSale = document.querySelector(
            '[data-register-action="open-sale"]'
          ) as HTMLButtonElement | null;
          openSale?.click();
          setTimeout(() => {
            const revealed = document.querySelector(
              '[data-register-action="charge-sale"]'
            ) as HTMLButtonElement | null;
            revealed?.click();
          }, 0);
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
    setSyncedOrders((prev) => [{ ...saved, items }, ...prev]);

    const queueIt = () => {
      const queued: Order = {
        ...saved,
        status: "PENDING_SYNC",
        isOffline: true,
        syncedAt: undefined,
      };
      setSyncedOrders((prev) =>
        prev.map((existing) => (existing.id === queued.id ? { ...queued, items } : existing))
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
      const res = await api("/api/orders/sync", {
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
      const res = await api("/api/products", {
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
      const res = await api(`/api/products/${updatedProduct.id}`, {
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
      const res = await api(`/api/products/${productId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error("delete failed");
      remember("productDeletes", productId, false);
    } catch (err) {
      console.warn("Product removal kept on this device.", err);
    }
  };

  // Stock only moves through movements. Apply it locally now; the server applies the same movement once, by id.
  const handleApplyMovement = (movement: StockMovement) => {
    setProducts((prev) => {
      const next = prev.map((product) =>
        product.id !== movement.productId
          ? product
          : {
              ...product,
              stock: product.stock + movement.quantity,
              ...(movement.type === "RESTOCK" || movement.type === "OPENING"
                ? {
                    costPrice: movement.unitCost && movement.unitCost > 0 ? movement.unitCost : product.costPrice,
                    supplierId: movement.supplierId || product.supplierId,
                  }
                : {}),
            }
      );
      productsRef.current = next;
      return next;
    });
  };

  const handleAddTenant = async (newTenant: Tenant) => {
    setTenants((prev) => {
      const next = [...prev, newTenant];
      tenantsRef.current = next;
      return next;
    });
    setActiveTenantId(newTenant.id);
    await saveTenant(newTenant);
  };

  const saveTenant = async (tenant: Tenant) => {
    if (!isOnline) {
      remember("tenantUpserts", tenant.id, true);
      return;
    }
    try {
      const res = await api(`/api/tenants/${tenant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tenant),
      });
      if (!res.ok) throw new Error("save failed");
    } catch (err) {
      console.warn("Store kept on this device.", err);
      remember("tenantUpserts", tenant.id, true);
    }
  };

  const handleUpdateTenant = async (tenant: Tenant) => {
    setTenants((prev) => {
      const next = prev.map((t) => (t.id === tenant.id ? tenant : t));
      tenantsRef.current = next;
      return next;
    });
    await saveTenant(tenant);
  };

  const handleDeleteTenants = async (tenantIds: string[]) => {
    if (!isOnline) return "Deleting a store needs an internet connection.";
    const gone = new Set<string>();
    let failure: string | null = null;
    for (const id of tenantIds) {
      try {
        const res = await api(`/api/tenants/${id}`, { method: "DELETE" });
        // 404: it only ever existed on this device (never synced), so there is nothing to delete remotely.
        if (res.ok || res.status === 404) gone.add(id);
        else failure = (await res.json().catch(() => null))?.message ?? "Could not delete the store.";
      } catch {
        failure = "Could not reach the server. Try again when you're online.";
      }
      if (failure) break;
    }
    if (gone.size > 0) {
      gone.forEach((id) => remember("tenantUpserts", id, false));
      const left = tenantsRef.current.filter((t) => !gone.has(t.id));
      tenantsRef.current = left;
      setTenants(left);
      setActiveTenantId((current) => (gone.has(current) ? left[0]?.id ?? "" : current));
      setProducts((prev) => {
        const next = prev.filter((p) => !gone.has(p.tenantId));
        productsRef.current = next;
        return next;
      });
      setSyncedOrders((prev) => prev.filter((o) => !gone.has(o.tenantId)));
      setOfflineQueue((prev) => {
        const next = prev.filter((entry) => !gone.has(entry.order.tenantId));
        offlineQueueRef.current = next;
        return next;
      });
      setHeldCarts((prev) => prev.filter((hc) => !gone.has(hc.tenantId)));
    }
    return failure;
  };

  const handleSwitchTenant = (tenantId: string) => {
    setActiveTenantId(tenantId);
  };

  const tenantSyncedOrders = useMemo(() => {
    if (!activeTenant) return [];
    return syncedOrders.filter((o) => o.tenantId === activeTenant.id);
  }, [syncedOrders, activeTenant]);

  const tenantHeldCarts = useMemo(() => {
    if (!activeTenant) return [];
    return heldCarts.filter((hc) => hc.tenantId === activeTenant.id);
  }, [heldCarts, activeTenant]);

  const value: PosContextValue = {
    tenants,
    activeTenant,
    hydrated,
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
    mobileMenuOpen,
    setMobileRegisterTab,
    setMobileMenuOpen,
    setIsDarkMode,
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
    handleApplyMovement,
    handleAddTenant,
    handleUpdateTenant,
    handleDeleteTenants,
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
