"use client";

import { useState } from "react";
import { RegisterCatalog } from "@/components/RegisterCatalog";
import { ActiveCart } from "@/components/ActiveCart";
import { usePos } from "@/contexts/pos-context";
import { money } from "@/lib/money";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export default function OrdersPage() {
  const {
    products,
    activeTenant,
    cart,
    isOnline,
    tenantHeldCarts,
    mobileRegisterTab,
    setMobileRegisterTab,
    handleAddToCart,
    handleUpdateQuantity,
    handleRemoveItem,
    handleClearCart,
    handleCheckout,
    handleHoldCart,
    handleResumeHeldCart,
    handleDeleteHeldCart,
  } = usePos();

  const [saleOpen, setSaleOpen] = useState(false);

  if (!activeTenant) return null;
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const parked = count > 0 || tenantHeldCarts.length > 0;
  const closeSale = () => {
    setSaleOpen(false);
    setMobileRegisterTab("catalog");
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <Tabs
        value={mobileRegisterTab}
        onValueChange={(value) => setMobileRegisterTab(value as "catalog" | "cart")}
        className="mb-3 lg:hidden"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="cart">Sale{count > 0 ? ` ${count}` : ""}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className={`grid h-full min-h-0 grid-cols-1 gap-4 overflow-hidden ${saleOpen ? "lg:grid-cols-12" : ""}`}>
        <div
          className={`${mobileRegisterTab === "catalog" ? "flex" : "hidden"} min-h-0 flex-col lg:flex ${saleOpen ? "lg:col-span-7 xl:col-span-8" : ""}`}
        >
          <RegisterCatalog
            products={products}
            activeTenant={activeTenant}
            onAddToSale={(product) => {
              handleAddToCart(product);
              setSaleOpen(true);
            }}
            onScanned={() => setMobileRegisterTab("cart")}
          />
        </div>
        {saleOpen || mobileRegisterTab === "cart" ? (
          <div className={`${mobileRegisterTab === "cart" ? "flex" : "hidden"} min-h-0 flex-col ${saleOpen ? "lg:col-span-5 lg:flex xl:col-span-4" : "lg:hidden"}`}>
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
              onClose={closeSale}
            />
          </div>
        ) : null}
      </div>

      {parked && mobileRegisterTab === "catalog" ? (
        <Button
          data-register-action="open-sale"
          className={`absolute inset-x-0 bottom-2 ${saleOpen ? "lg:hidden" : ""}`}
          onClick={() => {
            setSaleOpen(true);
            setMobileRegisterTab("cart");
          }}
        >
          {count > 0 ? `Sale ${money(activeTenant.currency, subtotal)}` : `${tenantHeldCarts.length} on hold`}
        </Button>
      ) : null}
    </div>
  );
}
