"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
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

function readStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return fallback;
    return JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
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
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [mobileRegisterTab, setMobileRegisterTab] = useState<"catalog" | "cart">("catalog");
  const [mobileRecordsTab, setMobileRecordsTab] = useState<"logs" | "analytics">("logs");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  // Load persisted state after mount (SSR-safe)
  useEffect(() => {
    setTenants(readStorage("nxtgen_tenants", INITIAL_TENANTS));
    setActiveTenantId(readStorage("nxtgen_active_tenant_id", INITIAL_TENANTS[0].id));
    setProducts(readStorage("nxtgen_products", INITIAL_PRODUCTS));
    setSyncedOrders(readStorage("nxtgen_orders", INITIAL_ORDERS));
    setOfflineQueue(readStorage("nxtgen_offline_queue", []));
    setHeldCarts(readStorage("nxtgen_held_carts", []));
    setIsDarkMode(readStorage("nxtgen_theme_dark", true));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("nxtgen_theme_dark", JSON.stringify(isDarkMode));
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
    localStorage.setItem("nxtgen_tenants", JSON.stringify(tenants));
  }, [tenants, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("nxtgen_active_tenant_id", activeTenantId);
    setCart([]);
  }, [activeTenantId, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("nxtgen_products", JSON.stringify(products));
  }, [products, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("nxtgen_orders", JSON.stringify(syncedOrders));
  }, [syncedOrders, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("nxtgen_offline_queue", JSON.stringify(offlineQueue));
  }, [offlineQueue, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("nxtgen_held_carts", JSON.stringify(heldCarts));
  }, [heldCarts, hydrated]);

  useEffect(() => {
    if (!isOnline) return;

    const fetchBackendData = async () => {
      try {
        const [tenantsRes, productsRes, ordersRes] = await Promise.all([
          fetch("/api/tenants"),
          fetch("/api/products"),
          fetch("/api/orders"),
        ]);

        if (tenantsRes.ok) {
          const tenantsData = await tenantsRes.json();
          if (tenantsData && tenantsData.length > 0) {
            setTenants(tenantsData);
          }
        }
        if (productsRes.ok) {
          const productsData = await productsRes.json();
          if (productsData && productsData.length > 0) {
            setProducts(productsData);
          }
        }
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          if (ordersData) {
            const mappedOrders = ordersData.map((o: Order) => ({
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
            setSyncedOrders(mappedOrders);
          }
        }
      } catch (err) {
        console.warn(
          "Could not fetch data from NestJS backend. Operating in local-first mode.",
          err
        );
      }
    };

    fetchBackendData();
  }, [isOnline]);

  const triggerOfflineSync = async () => {
    if (offlineQueue.length === 0) return;
    setIsSyncing(true);
    setSyncProgress(10);

    const ordersBatch = offlineQueue.map((item) => item.order);
    const itemsBatch: OrderItem[] = [];
    offlineQueue.forEach((item) => {
      itemsBatch.push(...item.items);
    });

    try {
      if (isOnline) {
        setSyncProgress(35);
        const res = await fetch("/api/orders/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orders: ordersBatch, items: itemsBatch }),
        });
        if (!res.ok) {
          throw new Error("NestJS backend sync failed");
        }
        setSyncProgress(75);
      }
    } catch (err) {
      console.error("Failed to sync offline queue with NestJS backend:", err);
    }

    setSyncProgress(100);
    setTimeout(() => {
      setProducts((prevProducts) => {
        const updatedProducts = [...prevProducts];
        offlineQueue.forEach(({ items }) => {
          items.forEach((item) => {
            const pIdx = updatedProducts.findIndex((p) => p.id === item.productId);
            if (pIdx !== -1) {
              updatedProducts[pIdx] = {
                ...updatedProducts[pIdx],
                stock: Math.max(0, updatedProducts[pIdx].stock - item.quantity),
              };
            }
          });
        });
        return updatedProducts;
      });

      const syncedFromQueue = offlineQueue.map((item) => ({
        ...item.order,
        status: "COMPLETED" as const,
        syncedAt: new Date().toISOString(),
      }));

      setSyncedOrders((prevOrders) => [...syncedFromQueue, ...prevOrders]);
      setOfflineQueue([]);
      setIsSyncing(false);
      setSyncProgress(0);
    }, 600);
  };

  const handleNetworkToggle = () => {
    const nextState = !isOnline;
    setIsOnline(nextState);
    if (nextState && offlineQueue.length > 0) {
      void triggerOfflineSync();
    }
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
    if (isOnline) {
      setProducts((prev) => {
        const updated = [...prev];
        items.forEach((item) => {
          const idx = updated.findIndex((p) => p.id === item.productId);
          if (idx !== -1) {
            updated[idx] = {
              ...updated[idx],
              stock: Math.max(0, updated[idx].stock - item.quantity),
            };
          }
        });
        return updated;
      });

      setSyncedOrders((prev) => [order, ...prev]);

      try {
        await fetch("/api/orders/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orders: [order], items }),
        });
      } catch (err) {
        console.warn(
          "Could not save order on NestJS server. Retained in client state.",
          err
        );
      }
    } else {
      setOfflineQueue((prev) => [...prev, { order, items }]);
    }
  };

  const handleAddProduct = async (newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev]);
    if (isOnline) {
      try {
        await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newProduct),
        });
      } catch (err) {
        console.error("Failed to add product to backend", err);
      }
    }
  };

  const handleUpdateProduct = async (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
    if (isOnline) {
      try {
        await fetch(`/api/products/${updatedProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedProduct),
        });
      } catch (err) {
        console.error("Failed to update product on backend", err);
      }
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    if (isOnline) {
      try {
        await fetch(`/api/products/${productId}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error("Failed to delete product on backend", err);
      }
    }
  };

  const handleAddTenant = async (newTenant: Tenant) => {
    setTenants((prev) => [...prev, newTenant]);
    if (isOnline) {
      try {
        await fetch("/api/tenants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newTenant),
        });
      } catch (err) {
        console.error("Failed to add tenant to backend", err);
      }
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
