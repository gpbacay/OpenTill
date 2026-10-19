"use client";

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

  if (!activeTenant) return null;
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <Tabs
        value={mobileRegisterTab}
        onValueChange={(value) => setMobileRegisterTab(value as "catalog" | "cart")}
        className="mb-3 lg:hidden"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="cart">Cart{count > 0 ? ` ${count}` : ""}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid h-full min-h-0 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-12">
        <div
          className={`${mobileRegisterTab === "catalog" ? "block" : "hidden"} min-h-0 lg:col-span-7 lg:block xl:col-span-8`}
        >
          <RegisterCatalog
            products={products}
            activeTenant={activeTenant}
            onAddToCart={handleAddToCart}
          />
        </div>
        <div
          className={`${mobileRegisterTab === "cart" ? "block" : "hidden"} min-h-0 lg:col-span-5 lg:block xl:col-span-4`}
        >
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

      {mobileRegisterTab === "catalog" && cart.length > 0 ? (
        <Button
          className="absolute inset-x-0 bottom-2 lg:hidden"
          onClick={() => setMobileRegisterTab("cart")}
        >
          Cart {money(activeTenant.currency, subtotal)}
        </Button>
      ) : null}
    </div>
  );
}
