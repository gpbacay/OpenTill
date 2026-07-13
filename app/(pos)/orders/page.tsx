"use client";

import { Boxes, ShoppingCart } from "lucide-react";
import { RegisterCatalog } from "@/components/RegisterCatalog";
import { ActiveCart } from "@/components/ActiveCart";
import { usePos } from "@/contexts/pos-context";

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

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
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
        <div
          className={`${
            mobileRegisterTab === "catalog" ? "block" : "hidden"
          } lg:block lg:col-span-7 xl:col-span-8 overflow-hidden h-full`}
        >
          <RegisterCatalog
            products={products}
            activeTenant={activeTenant}
            onAddToCart={handleAddToCart}
          />
        </div>
        <div
          className={`${
            mobileRegisterTab === "cart" ? "block" : "hidden"
          } lg:block lg:col-span-5 xl:col-span-4 overflow-hidden h-full`}
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

      {mobileRegisterTab === "catalog" && cart.length > 0 && (
        <div className="lg:hidden absolute bottom-3 left-3 right-3 z-40 animate-slide-in-up">
          <button
            onClick={() => setMobileRegisterTab("cart")}
            className="w-full bg-[#208C8C] hover:bg-[#208C8C]/90 text-[#010326] font-mono text-[11px] font-extrabold py-3 px-4 rounded-xl shadow-lg border border-[#89D9C2]/30 flex justify-between items-center"
          >
            <span className="flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4 animate-bounce" />
              <span>
                VIEW CART ({cart.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                ITEMS)
              </span>
            </span>
            <span>
              {activeTenant.currency === "EUR"
                ? "€"
                : activeTenant.currency === "PHP"
                  ? "₱"
                  : "$"}
              {cart
                .reduce(
                  (sum, item) => sum + item.product.price * item.quantity,
                  0
                )
                .toFixed(2)}{" "}
              →
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
