"use client";

import { useEffect, useMemo, useState } from "react";
import {
  HeldCart,
  Order,
  OrderItem,
  PaymentMethod,
  Product,
  Tenant,
} from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { money } from "@/lib/money";
import { PrintReceipt } from "./PrintReceipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CartItem {
  product: Product;
  quantity: number;
}

interface ActiveCartProps {
  cart: CartItem[];
  activeTenant: Tenant;
  isOnline: boolean;
  onUpdateQuantity: (productId: string, action: "add" | "sub") => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onCheckout: (order: Order, items: OrderItem[]) => void;
  heldCarts?: HeldCart[];
  onHoldCart?: (label: string) => void;
  onResumeHeldCart?: (id: string) => void;
  onDeleteHeldCart?: (id: string) => void;
}

const PAYMENTS: { id: PaymentMethod; label: string }[] = [
  { id: "CASH", label: "Cash" },
  { id: "CARD", label: "Card" },
  { id: "MOBILE_WALLET", label: "Wallet" },
];

export function ActiveCart({
  cart,
  activeTenant,
  isOnline,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
  heldCarts = [],
  onHoldCart,
  onResumeHeldCart,
  onDeleteHeldCart,
}: ActiveCartProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [cashierName, setCashierName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [checkoutError, setCheckoutError] = useState("");
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [receiptItems, setReceiptItems] = useState<OrderItem[]>([]);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdLabel, setHoldLabel] = useState("");
  const { user } = useAuth();
  const cashierKey = user ? `opentill_${user.id}_cashier` : "";

  useEffect(() => {
    if (!cashierKey) return;
    setCashierName(localStorage.getItem(cashierKey) ?? "");
  }, [cashierKey]);

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const total = discountedSubtotal;

  const cashSuggestions = useMemo(() => {
    if (total <= 0) return [];
    const steps = [total, 5, 10, 20, 50, 100].map((step, index) =>
      index === 0 ? total : Math.ceil(total / step) * step
    );
    return [...new Set(steps.filter((amount) => amount >= total))].slice(0, 4);
  }, [total]);

  const handleCheckoutSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (cart.length === 0) return;
    if (!cashierName.trim()) {
      setCheckoutError("Enter the cashier name.");
      return;
    }
    const cashReceivedNum = parseFloat(cashReceived);
    if (paymentMethod === "CASH" && (Number.isNaN(cashReceivedNum) || cashReceivedNum < total)) {
      setCheckoutError(`Cash needs to cover ${money(activeTenant.currency, total)}.`);
      return;
    }

    const orderId = `ord-${Date.now()}`;
    const changeDue = paymentMethod === "CASH" ? Math.max(0, cashReceivedNum - total) : 0;
    const order: Order = {
      id: orderId,
      tenantId: activeTenant.id,
      status: isOnline ? "COMPLETED" : "PENDING_SYNC",
      subtotal: discountedSubtotal,
      tax: 0,
      total,
      paymentMethod,
      isOffline: !isOnline,
      date: new Date().toISOString(),
      syncedAt: isOnline ? new Date().toISOString() : undefined,
      cashierName: cashierName.trim(),
      customerName: customerName.trim() || undefined,
      discountAmount,
      discountPercent,
      cashReceived: paymentMethod === "CASH" ? cashReceivedNum : total,
      changeDue,
    };
    const items: OrderItem[] = cart.map((item) => ({
      id: `item-${orderId}-${item.product.id}`,
      orderId,
      productId: item.product.id,
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
    }));

    if (cashierKey) localStorage.setItem(cashierKey, cashierName.trim());
    onCheckout(order, items);
    setCheckoutError("");
    setReceiptOrder(order);
    setReceiptItems(items);
  };

  const closeReceipt = () => {
    setReceiptOrder(null);
    setReceiptItems([]);
    setCashReceived("");
    setDiscountPercent(0);
    setCustomerName("");
    onClearCart();
  };

  const downloadReceipt = () => {
    if (!receiptOrder) return;
    const lines = [
      activeTenant.name,
      new Date(receiptOrder.date).toLocaleString(),
      `Receipt ${receiptOrder.id}`,
      receiptOrder.cashierName ? `Cashier ${receiptOrder.cashierName}` : "",
      receiptOrder.customerName ? `Customer ${receiptOrder.customerName}` : "",
      "",
      ...receiptItems.map(
        (item) =>
          `${item.quantity} x ${item.name}  ${money(activeTenant.currency, item.price * item.quantity)}`
      ),
      "",
      `Total ${money(activeTenant.currency, receiptOrder.total)}`,
      receiptOrder.paymentMethod === "CASH"
        ? `Cash ${money(activeTenant.currency, receiptOrder.cashReceived || 0)}`
        : receiptOrder.paymentMethod,
      receiptOrder.paymentMethod === "CASH"
        ? `Change ${money(activeTenant.currency, receiptOrder.changeDue || 0)}`
        : "",
    ].filter(Boolean);
    const file = new Blob([lines.join("\n")], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = `receipt-${receiptOrder.id}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const holdSale = (event: React.FormEvent) => {
    event.preventDefault();
    if (!holdLabel.trim() || !onHoldCart) return;
    onHoldCart(holdLabel.trim());
    setHoldLabel("");
    setShowHoldModal(false);
  };

  if (receiptOrder) {
    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto">
        <PrintReceipt order={receiptOrder} items={receiptItems} tenant={activeTenant} />
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={downloadReceipt}>
            Download
          </Button>
          <Button className="flex-1" onClick={closeReceipt}>
            New sale
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleCheckoutSubmit} className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {cart.reduce((sum, item) => sum + item.quantity, 0) === 1
            ? "1 item"
            : `${cart.reduce((sum, item) => sum + item.quantity, 0)} items`}
        </p>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={cart.length === 0}
            onClick={() => setShowHoldModal(true)}
            title="Place cart on hold"
          >
            Hold
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={cart.length === 0} onClick={onClearCart}>
            Clear
          </Button>
        </div>
      </div>

      {heldCarts.length > 0 ? (
        <div className="space-y-1">
          {heldCarts.map((held) => (
            <div key={held.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent">
              <button type="button" className="text-sm" onClick={() => onResumeHeldCart?.(held.id)}>
                {held.label}
              </button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onDeleteHeldCart?.(held.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        {cart.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Cart is empty</p>
        ) : (
          <ul>
            {cart.map((item) => (
              <li key={item.product.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{item.product.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {money(activeTenant.currency, item.product.price)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => onUpdateQuantity(item.product.id, "sub")}>
                    −
                  </Button>
                  <span className="w-5 text-center text-sm tabular-nums">{item.quantity}</span>
                  <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => onUpdateQuantity(item.product.id, "add")}>
                    +
                  </Button>
                </div>
                <button type="button" className="text-xs text-muted-foreground" onClick={() => onRemoveItem(item.product.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="cashier">Cashier</Label>
            <Input
              id="cashier"
              value={cashierName}
              onChange={(event) => setCashierName(event.target.value)}
              placeholder="Name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="customer">Customer</Label>
            <Input
              id="customer"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="discount" className="shrink-0">
            Discount %
          </Label>
          <Input
            id="discount"
            type="number"
            min={0}
            max={100}
            value={discountPercent || ""}
            onChange={(event) => {
              const next = Number(event.target.value);
              setDiscountPercent(Number.isNaN(next) ? 0 : Math.min(100, Math.max(0, next)));
            }}
            className="w-24"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {PAYMENTS.map((method) => (
            <Button
              key={method.id}
              type="button"
              variant={paymentMethod === method.id ? "default" : "secondary"}
              onClick={() => setPaymentMethod(method.id)}
            >
              {method.label}
            </Button>
          ))}
        </div>

        {paymentMethod === "CASH" ? (
          <div className="space-y-2">
            <Label htmlFor="cash">Cash received</Label>
            <Input
              id="cash"
              inputMode="decimal"
              value={cashReceived}
              onChange={(event) => setCashReceived(event.target.value)}
              placeholder={money(activeTenant.currency, total)}
            />
            <div className="flex flex-wrap gap-2">
              {cashSuggestions.map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setCashReceived(amount.toFixed(2))}
                >
                  {money(activeTenant.currency, amount)}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-end justify-between">
          <div className="text-xs text-muted-foreground">
            {discountAmount > 0 ? <p>Discount {money(activeTenant.currency, discountAmount)}</p> : null}
          </div>
          <p className="text-2xl font-bold tabular-nums">{money(activeTenant.currency, total)}</p>
        </div>
        {checkoutError ? <p className="text-sm text-destructive">{checkoutError}</p> : null}
        <Button type="submit" size="lg" disabled={cart.length === 0}>
          Charge
        </Button>
      </div>

      <Dialog open={showHoldModal} onOpenChange={setShowHoldModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hold this sale</DialogTitle>
          </DialogHeader>
          <form onSubmit={holdSale} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="hold-label">Name</Label>
              <Input
                id="hold-label"
                value={holdLabel}
                onChange={(event) => setHoldLabel(event.target.value)}
                placeholder="Counter 2"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!holdLabel.trim()}>
                Hold sale
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </form>
  );
}
