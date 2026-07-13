import React, { useState, useEffect, useMemo } from "react";
import { Tenant, Product, Order, OrderItem, HeldCart } from "./types";
import {
  INITIAL_TENANTS,
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
} from "./mockData";
import { RegisterCatalog } from "./components/RegisterCatalog";
import { ProductsManager } from "./components/ProductsManager";
import { TenantOnboarding } from "./components/TenantOnboarding";
import { ActiveCart } from "./components/ActiveCart";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import BentoDashboard from "./components/dashboard/BentoDashboard";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";

import {
  WifiOff,
  CheckCircle,
  FileText,
  Terminal,
  X,
  History,
  TrendingUp,
  TriangleAlert,
  Boxes,
  CircleDollarSign,
  Briefcase,
  RefreshCw,
  Clock,
  ShoppingCart
} from "lucide-react";

interface CartItem {
  product: Product;
  quantity: number;
}

export default function App() {
  // --- STATE PERSISTENCE LOADERS ---
  const [tenants, setTenants] = useState<Tenant[]>(() => {
    const saved = localStorage.getItem("nxtgen_tenants");
    return saved ? JSON.parse(saved) : INITIAL_TENANTS;
  });

  const [activeTenantId, setActiveTenantId] = useState<string>(() => {
    const saved = localStorage.getItem("nxtgen_active_tenant_id");
    return saved || INITIAL_TENANTS[0].id;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem("nxtgen_products");
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [syncedOrders, setSyncedOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem("nxtgen_orders");
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });

  const [offlineQueue, setOfflineQueue] = useState<{ order: Order; items: OrderItem[] }[]>(() => {
    const saved = localStorage.getItem("nxtgen_offline_queue");
    return saved ? JSON.parse(saved) : [];
  });

  const [heldCarts, setHeldCarts] = useState<HeldCart[]>(() => {
    const saved = localStorage.getItem("nxtgen_held_carts");
    return saved ? JSON.parse(saved) : [];
  });

  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("nxtgen_theme_dark");
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem("nxtgen_theme_dark", JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.remove("light-theme");
      document.body.classList.remove("light-theme");
    } else {
      document.documentElement.classList.add("light-theme");
      document.body.classList.add("light-theme");
    }
  }, [isDarkMode]);
  
  // Navigation layout section controller
  const [activeSection, setActiveSection] = useState<string>("home");

  // Mobile Tab Controllers
  const [mobileRegisterTab, setMobileRegisterTab] = useState<"catalog" | "cart">("catalog");
  const [mobileRecordsTab, setMobileRecordsTab] = useState<"logs" | "analytics">("logs");
  
  // Mobile slide-over drawer toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Search parameters for reports
  const [searchHistory, setSearchHistory] = useState<string>("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [systemTime, setSystemTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Find active tenant object
  const activeTenant = useMemo(() => {
    return tenants.find((t) => t.id === activeTenantId) || tenants[0];
  }, [tenants, activeTenantId]);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem("nxtgen_tenants", JSON.stringify(tenants));
  }, [tenants]);

  useEffect(() => {
    localStorage.setItem("nxtgen_active_tenant_id", activeTenantId);
    // Clear cart when tenant shifts to prevent cross-tenant sales!
    setCart([]);
  }, [activeTenantId]);

  useEffect(() => {
    localStorage.setItem("nxtgen_products", JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem("nxtgen_orders", JSON.stringify(syncedOrders));
  }, [syncedOrders]);

  useEffect(() => {
    localStorage.setItem("nxtgen_offline_queue", JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  useEffect(() => {
    localStorage.setItem("nxtgen_held_carts", JSON.stringify(heldCarts));
  }, [heldCarts]);

  // Synchronize frontend state with NestJS backend when online
  useEffect(() => {
    if (!isOnline) return;

    const fetchBackendData = async () => {
      try {
        const [tenantsRes, productsRes, ordersRes] = await Promise.all([
          fetch("/api/tenants"),
          fetch("/api/products"),
          fetch("/api/orders")
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
            const mappedOrders = ordersData.map((o: any) => ({
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
              changeDue: o.changeDue
            }));
            setSyncedOrders(mappedOrders);
          }
        }
      } catch (err) {
        console.warn("Could not fetch data from NestJS backend. Operating in local-first mode.", err);
      }
    };

    fetchBackendData();
  }, [isOnline]);

  // Network Sync flow simulator
  const handleNetworkToggle = () => {
    const nextState = !isOnline;
    setIsOnline(nextState);

    if (nextState && offlineQueue.length > 0) {
      triggerOfflineSync();
    }
  };

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
          body: JSON.stringify({ orders: ordersBatch, items: itemsBatch })
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

  // --- CART CONTROLLERS ---
  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev; // stock limit
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId: string, action: "add" | "sub") => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = action === "add" ? item.quantity + 1 : item.quantity - 1;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
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

  // Keyboard shortcut speed operations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCart([]);
      }
      if (e.key === "F2") {
        e.preventDefault();
        setActiveSection("orders");
        setTimeout(() => {
          const searchInput = document.querySelector('input[placeholder*="Search by product"]') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        }, 100);
      }
      if (e.key === "F4") {
        e.preventDefault();
        setActiveSection("orders");
        setTimeout(() => {
          const holdBtn = document.querySelector('button[title*="Place cart on hold"]') as HTMLButtonElement;
          if (holdBtn) holdBtn.click();
        }, 100);
      }
      if (e.key === "F8") {
        e.preventDefault();
        setActiveSection("orders");
        setTimeout(() => {
          const checkoutBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
          if (checkoutBtn) checkoutBtn.click();
        }, 100);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [products]);

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
          body: JSON.stringify({ orders: [order], items })
        });
      } catch (err) {
        console.warn("Could not save order on NestJS server. Retained in client state.", err);
      }
    } else {
      setOfflineQueue((prev) => [...prev, { order, items }]);
    }
  };

  // --- INVENTORY MANAGEMENT CALLBACKS ---
  const handleAddProduct = async (newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev]);
    if (isOnline) {
      try {
        await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newProduct)
        });
      } catch (err) {
        console.error("Failed to add product to backend", err);
      }
    }
  };

  const handleUpdateProduct = async (updatedProduct: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)));
    if (isOnline) {
      try {
        await fetch(`/api/products/${updatedProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedProduct)
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
          method: "DELETE"
        });
      } catch (err) {
        console.error("Failed to delete product on backend", err);
      }
    }
  };

  // --- TENANT CREATION ---
  const handleAddTenant = async (newTenant: Tenant) => {
    setTenants((prev) => [...prev, newTenant]);
    if (isOnline) {
      try {
        await fetch("/api/tenants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newTenant)
        });
      } catch (err) {
        console.error("Failed to add tenant to backend", err);
      }
    }
  };

  const handleSwitchTenant = (tenantId: string) => {
    setActiveTenantId(tenantId);
  };

  // Filter synced orders for current tenant
  const tenantSyncedOrders = useMemo(() => {
    return syncedOrders.filter((o) => o.tenantId === activeTenant.id);
  }, [syncedOrders, activeTenant.id]);

  // Filter held carts for current tenant
  const tenantHeldCarts = useMemo(() => {
    return heldCarts.filter((hc) => hc.tenantId === activeTenant.id);
  }, [heldCarts, activeTenant.id]);

  // Financial statistics
  const revenueStats = useMemo(() => {
    const activeOrders = tenantSyncedOrders.filter((o) => o.status === "COMPLETED");
    const totalSales = activeOrders.reduce((sum, o) => sum + o.total, 0);
    return {
      totalSales,
      ordersCount: activeOrders.length,
    };
  }, [tenantSyncedOrders]);

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-slate-100 flex flex-row antialiased select-none">
      
      {/* 1. DESKTOP SIDEBAR PANEL */}
      <aside className="hidden lg:block w-64 h-screen sticky top-0 shrink-0">
        <Sidebar 
          activeSection={activeSection} 
          setActiveSection={setActiveSection} 
          activeTenant={activeTenant} 
          offlineQueueCount={offlineQueue.length}
        />
      </aside>

      {/* 2. MOBILE DRAWER SIDEBAR PANEL */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden animate-fade-in">
          {/* Overlay blur */}
          <div 
            onClick={() => setMobileMenuOpen(false)} 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          ></div>
          {/* Sidebar container */}
          <div className="relative flex w-64 max-w-xs flex-col bg-[#0D0D0D] border-r border-[#024959] h-full shadow-2xl animate-slide-in-left">
            <div className="absolute top-3.5 right-3 z-50">
              <button 
                onClick={() => setMobileMenuOpen(false)} 
                className="p-1 rounded-md border border-[#024959] text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <Sidebar 
              activeSection={activeSection} 
              setActiveSection={(section) => {
                setActiveSection(section);
                setMobileMenuOpen(false);
              }} 
              activeTenant={activeTenant} 
              offlineQueueCount={offlineQueue.length}
            />
          </div>
        </div>
      )}

      {/* 3. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Dynamic header widgets */}
        <Header
          activeSection={activeSection}
          isOnline={isOnline}
          onToggleNetwork={handleNetworkToggle}
          activeTenant={activeTenant}
          offlineQueueCount={offlineQueue.length}
          onTriggerSync={triggerOfflineSync}
          isSyncing={isSyncing}
          onMobileMenuToggle={() => setMobileMenuOpen(true)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        />

        {/* Sync Progress Banner */}
        {isSyncing && (
          <div className="bg-gradient-to-r from-[#024959] to-[#010326] border-b border-[#208C8C]/40 text-center py-2 px-4 shrink-0 animate-pulse">
            <div className="max-w-md mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px] font-mono text-[#89D9C2]">
                <RefreshCw className="w-3 h-3 animate-spin text-[#89D9C2]" />
                <span>Restoring offline transactions to Cloud database (Postgres)...</span>
              </div>
              <span className="text-[10px] font-bold text-white font-mono">{syncProgress}%</span>
            </div>
            <div className="max-w-md mx-auto h-0.5 bg-[#010326] rounded-full overflow-hidden mt-1.5 border border-[#208C8C]/20">
              <div
                className="h-full bg-gradient-to-r from-[#208C8C] to-[#89D9C2] transition-all duration-300"
                style={{ width: `${syncProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Workspace views and layouts */}
        <main className="flex-1 overflow-hidden p-3 md:p-5 flex flex-col">
          
          {/* HOME (BENTO GRID DASHBOARD) */}
          {activeSection === "home" && (
            <BentoDashboard 
              products={products} 
              orders={syncedOrders} 
              activeTenant={activeTenant} 
            />
          )}

          {/* ORDERS (ACTIVE BILLING REGISTER) */}
          {activeSection === "orders" && (
            <div className="flex flex-col h-full overflow-hidden relative">
              {/* Mobile Tab Switcher */}
              <div className="flex lg:hidden bg-[#0D0D0D] border border-[#024959] p-1 rounded-xl mb-3 shrink-0">
                <button
                  onClick={() => setMobileRegisterTab("catalog")}
                  className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-wider font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    mobileRegisterTab === "catalog"
                      ? "bg-[#208C8C] text-[#010326] shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5" />
                  Catalog
                </button>
                <button
                  onClick={() => setMobileRegisterTab("cart")}
                  className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-wider font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 relative ${
                    mobileRegisterTab === "cart"
                      ? "bg-[#208C8C] text-[#010326] shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Active Cart
                  {cart.length > 0 && (
                    <span className="absolute top-1 right-2 bg-amber-500 text-[#010326] text-[8px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                      {cart.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 h-full overflow-hidden">
                <div className={`${mobileRegisterTab === "catalog" ? "block" : "hidden"} lg:block lg:col-span-7 xl:col-span-8 overflow-hidden h-full`}>
                  <RegisterCatalog
                    products={products}
                    activeTenant={activeTenant}
                    onAddToCart={handleAddToCart}
                  />
                </div>
                <div className={`${mobileRegisterTab === "cart" ? "block" : "hidden"} lg:block lg:col-span-5 xl:col-span-4 overflow-hidden h-full`}>
                  <ActiveCart
                    cart={cart}
                    activeTenant={activeTenant}
                    isOnline={isOnline}
                    onUpdateQuantity={handleUpdateQuantity}
                    onRemoveItem={handleRemoveItem}
                    onClearCart={handleClearCart}
                    onCheckout={handleCheckout}
                    heldCarts={tenantHeldCarts}
                    onHoldCart={handleHoldCart}
                    onResumeHeldCart={handleResumeHeldCart}
                    onDeleteHeldCart={handleDeleteHeldCart}
                  />
                </div>
              </div>

              {/* Floating Bottom Checkout Action Banner on Mobile */}
              {mobileRegisterTab === "catalog" && cart.length > 0 && (
                <div className="lg:hidden absolute bottom-3 left-3 right-3 z-40 animate-slide-in-up">
                  <button
                    onClick={() => setMobileRegisterTab("cart")}
                    className="w-full bg-[#208C8C] hover:bg-[#208C8C]/90 text-[#010326] font-mono text-[11px] font-extrabold py-3 px-4 rounded-xl shadow-lg border border-[#89D9C2]/30 flex justify-between items-center"
                  >
                    <span className="flex items-center gap-1.5">
                      <ShoppingCart className="w-4 h-4 animate-bounce" />
                      <span>VIEW CART ({cart.reduce((sum, item) => sum + item.quantity, 0)} ITEMS)</span>
                    </span>
                    <span>
                      {activeTenant.currency === "EUR" ? "€" : activeTenant.currency === "PHP" ? "₱" : "$"}
                      {cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0).toFixed(2)} →
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PRODUCT INVENTORY MANAGER */}
          {activeSection === "products" && (
            <ProductsManager
              products={products}
              activeTenant={activeTenant}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
            />
          )}

          {/* RECORDS LOGS */}
          {activeSection === "records" && (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Mobile Tab Switcher */}
              <div className="flex lg:hidden bg-[#0D0D0D] border border-[#024959] p-1 rounded-xl mb-3 shrink-0">
                <button
                  onClick={() => setMobileRecordsTab("logs")}
                  className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-wider font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    mobileRecordsTab === "logs"
                      ? "bg-[#208C8C] text-[#010326] shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Sales Ledger
                </button>
                <button
                  onClick={() => setMobileRecordsTab("analytics")}
                  className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-wider font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    mobileRecordsTab === "analytics"
                      ? "bg-[#208C8C] text-[#010326] shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Analytics Reports
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 h-full overflow-hidden">
                {/* Detailed Transaction table */}
                <div className={`${mobileRecordsTab === "logs" ? "flex" : "hidden"} lg:flex lg:col-span-8 flex-col bg-[#024959]/10 rounded-xl border border-[#024959] p-3 overflow-hidden shadow-md`}>
                  <div className="flex justify-between items-center mb-3 shrink-0">
                    <div>
                      <h4 className="text-[10px] font-mono text-[#89D9C2] uppercase tracking-wider">Synced sales ledger</h4>
                      <p className="text-[9px] text-slate-400">
                        Row counts synced with Cloud Postgres (Neon Database).
                      </p>
                    </div>
                    <div className="bg-[#208C8C]/15 border border-[#208C8C]/30 px-2 py-0.5 rounded text-[9px] font-mono text-[#89D9C2]">
                      Total Records: {tenantSyncedOrders.length}
                    </div>
                  </div>

                  <div className="relative mb-3 shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#89D9C2]/60">
                      <Terminal className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      placeholder="Filter terminal audit log rows by transaction ID..."
                      value={searchHistory}
                      onChange={(e) => setSearchHistory(e.target.value)}
                      className="w-full bg-[#0D0D0D] border border-[#024959] rounded-lg py-1.5 pl-8.5 pr-3 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-[#208C8C] transition-colors"
                    />
                  </div>

                  {/* Database logs ledger scrollable */}
                  <div className="flex-1 overflow-y-auto pr-0.5 space-y-2">
                    {tenantSyncedOrders.length === 0 ? (
                      <div className="h-44 flex flex-col items-center justify-center text-center p-5 bg-[#024959]/5 rounded-lg border border-dashed border-[#024959]">
                        <FileText className="w-7 h-7 text-[#024959] mb-1.5" />
                        <p className="text-[10px] text-slate-400 font-mono">No transactional data logged.</p>
                        <p className="text-[9px] text-slate-500 mt-0.5 font-mono">Complete checkout orders in the register to see records.</p>
                      </div>
                    ) : (
                      tenantSyncedOrders
                        .filter((o) => o.id.toLowerCase().includes(searchHistory.toLowerCase()))
                        .map((o) => (
                          <div
                            key={o.id}
                            className="bg-[#0D0D0D]/45 hover:bg-[#024959]/10 p-3 rounded-lg border border-[#024959] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 transition-all"
                          >
                            <div className="space-y-0.5 font-mono">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-white">Order ID: {o.id.substring(4, 12).toUpperCase()}</span>
                                <span className="text-[8px] bg-[#208C8C]/15 text-[#89D9C2] px-1 py-0.2 rounded border border-[#208C8C]/10">
                                  {o.paymentMethod}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 text-[8.5px] text-slate-400">
                                <span>Cashier: <span className="text-white">{o.cashierName || "System Operator"}</span></span>
                                <span>•</span>
                                <span>Customer: <span className="text-[#89D9C2]">{o.customerName || "Walk-In Guest"}</span></span>
                                <span>•</span>
                                <span>Timestamp: <span className="text-slate-300">{new Date(o.date).toLocaleString()}</span></span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                              <div className="text-right font-mono">
                                <span className="text-[12px] font-bold text-[#89D9C2] glow-text-mint">
                                  {activeTenant.currency === "EUR" ? "€" : activeTenant.currency === "PHP" ? "₱" : "$"}
                                  {o.total.toFixed(2)}
                                </span>
                                <p className="text-[7.5px] text-slate-500">VAT Inc: {activeTenant.currency === "EUR" ? "€" : activeTenant.currency === "PHP" ? "₱" : "$"} {o.tax.toFixed(2)}</p>
                              </div>

                              <div className="flex items-center gap-1.5 text-[8px] font-mono bg-[#0D0D0D] px-2 py-1 rounded border border-[#024959]/50 text-slate-300 shadow-inner">
                                <CheckCircle className="w-3 h-3 text-[#89D9C2]" />
                                <span className="text-[#89D9C2] font-semibold">POSTGRES_SYNCED</span>
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Sidebar stats panel */}
                <div className={`${mobileRecordsTab === "analytics" ? "block" : "hidden"} lg:block lg:col-span-4 h-full`}>
                  <AnalyticsPanel orders={tenantSyncedOrders} activeTenant={activeTenant} />
                </div>
              </div>
            </div>
          )}

          {/* STORE CONFIGURATION SETTINGS */}
          {activeSection === "settings" && (
            <TenantOnboarding
              tenants={tenants}
              activeTenant={activeTenant}
              onAddTenant={handleAddTenant}
              onSwitchTenant={handleSwitchTenant}
            />
          )}

        </main>

      </div>
    </div>
  );
}
