"use client";

import React, { useState, useMemo } from "react";
import { Product, Tenant, Order, OrderItem, PaymentMethod, HeldCart, Customer } from "@/lib/types";
import { Trash2, Plus, Minus, CreditCard, Wallet, Coins, AlertCircle, Sparkles, FileCheck, RefreshCw, User, Tag, Download, Printer, Bookmark, Calendar } from "lucide-react";
import { PrintReceipt } from "./PrintReceipt";

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

const CASHIERS = ["Cashier Juan", "Cashier Maria", "Manager Pedro", "Supervisor Ana"];

const LOYALTY_CUSTOMERS: Customer[] = [
  { id: "cust-1", name: "Walk-in Guest", phone: "N/A", loyaltyPoints: 0, email: "walkin@guest.com" },
  { id: "cust-2", name: "Juan Dela Cruz (VIP)", phone: "+63 917 555 0199", loyaltyPoints: 450, email: "juan@reyes.parts" },
  { id: "cust-3", name: "Maria Santos", phone: "+63 918 555 0142", loyaltyPoints: 120, email: "maria@motoline.ph" },
  { id: "cust-4", name: "Carlo Reyes", phone: "+63 919 555 0177", loyaltyPoints: 35, email: "carlo@barriocycle.ph" },
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
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [receiptItems, setReceiptItems] = useState<OrderItem[]>([]);
  const [checkoutError, setCheckoutError] = useState("");
  const [showPrintReceipt, setShowPrintReceipt] = useState(false);

  // Operator & Customer States
  const [selectedCashier, setSelectedCashier] = useState(CASHIERS[0]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(LOYALTY_CUSTOMERS[0].id);

  // Discount presets
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Hold cart modal state
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdLabel, setHoldLabel] = useState("");
  const [showHeldCartsMenu, setShowHeldCartsMenu] = useState(false);

  // Find active customer object
  const activeCustomer = useMemo(() => {
    return LOYALTY_CUSTOMERS.find((c) => c.id === selectedCustomerId) || LOYALTY_CUSTOMERS[0];
  }, [selectedCustomerId]);

  // Subtotal, discount, tax, and totals
  const subtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const tax = discountedSubtotal * activeTenant.taxRate;
  const total = discountedSubtotal + tax;

  const getCurrencySymbol = () => {
    return activeTenant.currency === "EUR" ? "€" : activeTenant.currency === "PHP" ? "₱" : "$";
  };

  // Dynamic suggestions for cash tendered based on Grand Total
  const cashSuggestions = useMemo(() => {
    if (total <= 0) return [];
    const exact = total;
    const next5 = Math.ceil(total / 5) * 5;
    const next10 = Math.ceil(total / 10) * 10;
    const next20 = Math.ceil(total / 20) * 20;
    const next50 = Math.ceil(total / 50) * 50;
    const next100 = Math.ceil(total / 100) * 100;

    const list = new Set<number>();
    list.add(exact);
    if (next5 > total) list.add(next5);
    if (next10 > total) list.add(next10);
    if (next20 > total) list.add(next20);
    if (next50 > total) list.add(next50);
    if (next100 > total) list.add(next100);

    return Array.from(list).slice(0, 4); // return up to 4 recommendations
  }, [total]);

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    const cashReceivedNum = parseFloat(cashReceived);
    if (paymentMethod === "CASH") {
      if (!cashReceived || isNaN(cashReceivedNum) || cashReceivedNum < total) {
        setCheckoutError(`Please enter a cash amount of at least ${getCurrencySymbol()}${total.toFixed(2)}.`);
        return;
      }
    }

    setCheckoutError("");

    // Generate the order object
    const orderId = "ord-" + Date.now();
    const changeDueValue = paymentMethod === "CASH" ? Math.max(0, cashReceivedNum - total) : 0;

    const order: Order = {
      id: orderId,
      tenantId: activeTenant.id,
      status: isOnline ? "COMPLETED" : "PENDING_SYNC",
      subtotal: discountedSubtotal,
      tax,
      total,
      paymentMethod,
      isOffline: !isOnline,
      date: new Date().toISOString(),
      syncedAt: isOnline ? new Date().toISOString() : undefined,
      cashierName: selectedCashier,
      customerName: activeCustomer.name,
      discountAmount,
      discountPercent,
      cashReceived: paymentMethod === "CASH" ? cashReceivedNum : total,
      changeDue: changeDueValue,
    };

    // Generate items snapshots
    const items: OrderItem[] = cart.map((item) => ({
      id: "item-" + orderId + "-" + item.product.id,
      orderId,
      productId: item.product.id,
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
    }));

    // Trigger parent callback
    onCheckout(order, items);

    // If we have loyalty program, add points
    if (activeCustomer.id !== "cust-1" && isOnline) {
      const addedPoints = Math.floor(total / 10);
      activeCustomer.loyaltyPoints += addedPoints;
    }

    // Save for the local visual receipt
    setReceiptOrder(order);
    setReceiptItems(items);
  };

  const handleHoldSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || !holdLabel.trim() || !onHoldCart) return;
    onHoldCart(holdLabel.trim());
    setHoldLabel("");
    setShowHoldModal(false);
  };

  const closeReceipt = () => {
    setReceiptOrder(null);
    setReceiptItems([]);
    setCashReceived("");
    setDiscountPercent(0);
    setShowPrintReceipt(false);
    onClearCart();
  };

  // Generate ASCII Invoice for Thermal Printer download or Print
  const getASCIIInvoice = () => {
    if (!receiptOrder) return "";
    const border = "========================================\n";
    const dash = "----------------------------------------\n";
    let invoice = "";
    invoice += border;
    invoice += `        ${activeTenant.name.toUpperCase()}        \n`;
    invoice += `        ${activeTenant.businessType.toUpperCase()}        \n`;
    invoice += `           STATION #opentill            \n`;
    invoice += border;
    invoice += `Date   : ${new Date(receiptOrder.date).toLocaleString()}\n`;
    invoice += `Receipt: ${receiptOrder.id.substring(4).toUpperCase()}\n`;
    invoice += `Operator: ${receiptOrder.cashierName || "N/A"}\n`;
    invoice += `Customer: ${receiptOrder.customerName || "N/A"}\n`;
    invoice += dash;
    invoice += "Item                     Qty      Amount\n";
    invoice += dash;
    
    receiptItems.forEach((item) => {
      const nameStr = item.name.substring(0, 22).padEnd(24);
      const qtyStr = item.quantity.toString().padStart(3);
      const valStr = `${getCurrencySymbol()}${(item.price * item.quantity).toFixed(2)}`.padStart(11);
      invoice += `${nameStr}${qtyStr}${valStr}\n`;
    });

    invoice += dash;
    invoice += `Subtotal:`.padEnd(25) + `${getCurrencySymbol()}${(receiptOrder.subtotal + (receiptOrder.discountAmount || 0)).toFixed(2)}`.padStart(15) + "\n";
    if (receiptOrder.discountAmount) {
      invoice += `Discount (${receiptOrder.discountPercent}%):`.padEnd(25) + `-${getCurrencySymbol()}${receiptOrder.discountAmount.toFixed(2)}`.padStart(15) + "\n";
    }
    invoice += `VAT Rate (${(activeTenant.taxRate * 100).toFixed(1)}%):`.padEnd(25) + `${getCurrencySymbol()}${receiptOrder.tax.toFixed(2)}`.padStart(15) + "\n";
    invoice += border;
    invoice += `GRAND TOTAL:`.padEnd(25) + `${getCurrencySymbol()}${receiptOrder.total.toFixed(2)}`.padStart(15) + "\n";
    invoice += border;
    
    if (receiptOrder.paymentMethod === "CASH") {
      invoice += `Cash Tendered:`.padEnd(25) + `${getCurrencySymbol()}${(receiptOrder.cashReceived || 0).toFixed(2)}`.padStart(15) + "\n";
      invoice += `Change Due:`.padEnd(25) + `${getCurrencySymbol()}${(receiptOrder.changeDue || 0).toFixed(2)}`.padStart(15) + "\n";
    } else {
      invoice += `Paid via:`.padEnd(25) + `${receiptOrder.paymentMethod}`.padStart(15) + "\n";
    }
    
    invoice += border;
    invoice += "     THANK YOU FOR YOUR PATRONAGE!     \n";
    invoice += "                OpenTill                \n";
    invoice += "========================================\n";
    return invoice;
  };

  const downloadReceiptText = () => {
    const text = getASCIIInvoice();
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `receipt-${receiptOrder?.id.substring(4, 12).toUpperCase()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handlePrintSimulation = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt ${receiptOrder?.id.substring(4, 12).toUpperCase()}</title>
            <style>
              body {
                background: #fff;
                color: #000;
                font-family: monospace;
                padding: 20px;
                white-space: pre-wrap;
                font-size: 14px;
                max-width: 400px;
                margin: 0 auto;
              }
              button {
                margin-bottom: 20px;
                padding: 10px;
                background: #000;
                color: #fff;
                border: none;
                cursor: pointer;
                font-weight: bold;
                width: 100%;
              }
              @media print {
                button { display: none; }
              }
            </style>
          </head>
          <body>
            <button onclick="window.print()">Print Receipt</button>
            <div>${getASCIIInvoice()}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      alert("Popup blocked! Please allow popups to view printed invoice.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#024959]/10 rounded-xl border border-[#024959] overflow-hidden relative shadow-md">
      {/* Receipts visual modal overlay */}
      {receiptOrder && (
        <div className="absolute inset-0 bg-[#0D0D0D]/95 backdrop-blur-sm z-50 p-3 flex flex-col justify-between overflow-y-auto animate-fade-in">
          {showPrintReceipt ? (
            <div className="flex-1 flex flex-col justify-between overflow-y-auto p-1 h-full">
              <div className="flex justify-between items-center mb-3 font-mono text-slate-300">
                <span className="text-[10px] font-bold text-[#89D9C2]">THERMAL RECEIPT PREVIEW</span>
                <button 
                  type="button"
                  onClick={() => setShowPrintReceipt(false)}
                  className="px-2 py-0.5 border border-[#024959] hover:bg-[#024959]/20 text-[9px] text-slate-400 hover:text-white rounded transition-colors font-bold uppercase cursor-pointer"
                >
                  BACK
                </button>
              </div>
              <div className="flex-1 overflow-y-auto mb-3">
                <PrintReceipt 
                  order={receiptOrder} 
                  items={receiptItems} 
                  tenant={activeTenant} 
                />
              </div>
              <button
                type="button"
                onClick={closeReceipt}
                className="w-full bg-[#024959]/30 hover:bg-[#024959]/50 border border-[#024959] text-slate-300 font-bold py-2 rounded-lg text-xs font-mono transition-colors tracking-widest uppercase mt-1 animate-pulse"
              >
                Done & Close
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 flex items-center justify-center py-1">
            <div className="w-full max-w-sm bg-[#0D0D0D] text-white font-mono p-4 rounded-xl border border-[#024959] shadow-2xl relative overflow-hidden">
              {/* Receipt edge lines decoration */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#208C8C] via-[#89D9C2] to-[#208C8C]"></div>

              <div className="text-center space-y-1 mb-3">
                <h4 className="text-xs font-extrabold tracking-wider text-white uppercase">{activeTenant.name}</h4>
                <p className="text-[8px] text-[#89D9C2] uppercase font-semibold">{activeTenant.businessType}</p>
                <p className="text-[8px] text-slate-400">Date: {new Date(receiptOrder.date).toLocaleString()}</p>
                <div className="border-b border-dashed border-[#024959] my-2"></div>
              </div>

              {/* Receipt stats */}
              <div className="flex justify-between text-[9px] text-slate-300 mb-2.5 font-mono">
                <span>Receipt #: {receiptOrder.id.substring(4, 12).toUpperCase()}</span>
                <span
                  className={`font-semibold uppercase ${
                    receiptOrder.isOffline ? "text-amber-400" : "text-[#89D9C2]"
                  }`}
                >
                  {receiptOrder.isOffline ? "[OFFLINE QUEUED]" : "[PAID ONLINE]"}
                </span>
              </div>

              {/* Cashier & Customer Info */}
              <div className="flex justify-between text-[8px] text-slate-400 mb-2 font-mono bg-[#024959]/10 p-1.5 rounded border border-[#024959]/30">
                <span>Cashier: {receiptOrder.cashierName}</span>
                <span>Customer: {receiptOrder.customerName}</span>
              </div>

              {/* Receipt Items list */}
              <div className="space-y-1 text-[9px] mb-3">
                {receiptItems.map((item) => (
                  <div key={item.id} className="flex justify-between gap-2">
                    <span className="truncate flex-1">
                      {item.name} <span className="text-slate-500">x{item.quantity}</span>
                    </span>
                    <span className="shrink-0 text-slate-300">
                      {getCurrencySymbol()}{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="border-b border-dashed border-[#024959] my-2"></div>
              </div>

              {/* Tender Details */}
              <div className="space-y-1 text-[9px] text-slate-400 font-mono">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{getCurrencySymbol()}{(receiptOrder.subtotal + (receiptOrder.discountAmount || 0)).toFixed(2)}</span>
                </div>
                {receiptOrder.discountAmount ? (
                  <div className="flex justify-between text-amber-400">
                    <span>Discount ({receiptOrder.discountPercent}%):</span>
                    <span>-{getCurrencySymbol()}{receiptOrder.discountAmount.toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span>VAT Rate:</span>
                  <span>{(activeTenant.taxRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-white font-bold text-[10px] border-t border-[#024959] pt-1 mt-1">
                  <span>GRAND TOTAL:</span>
                  <span className="text-[#89D9C2] glow-text-mint">{getCurrencySymbol()}{receiptOrder.total.toFixed(2)}</span>
                </div>
                {receiptOrder.paymentMethod === "CASH" && (
                  <>
                    <div className="flex justify-between text-[9px] pt-1">
                      <span>Cash Tendered:</span>
                      <span className="text-white">{getCurrencySymbol()}{(receiptOrder.cashReceived || receiptOrder.total).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[9px] font-bold text-amber-400">
                      <span>Change Due:</span>
                      <span>{getCurrencySymbol()}{(receiptOrder.changeDue || 0).toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-[8px] pt-2 text-slate-500">
                  <span>Method: {receiptOrder.paymentMethod}</span>
                  <span>Operator ID: OpenTill</span>
                </div>
              </div>

              <div className="text-center text-[8px] text-[#89D9C2]/60 mt-3 flex items-center justify-center gap-1">
                <FileCheck className="w-2.5 h-2.5" />
                {receiptOrder.isOffline
                  ? "Queued locally. Synced once online."
                  : "Database sync completed successfully."}
              </div>

              {/* Output Actions for Receipt */}
              <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-dashed border-[#024959]">
                <button
                  type="button"
                  onClick={() => setShowPrintReceipt(true)}
                  className="col-span-2 flex items-center justify-center gap-1.5 px-2.5 py-2 bg-[#208C8C] hover:bg-[#208C8C]/85 text-[#010326] text-[10px] rounded font-bold transition-all uppercase shadow-md cursor-pointer mb-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Receipt
                </button>
                <button
                  type="button"
                  onClick={downloadReceiptText}
                  className="flex items-center justify-center gap-1 px-2 py-1 bg-[#0D0D0D] hover:bg-[#024959]/20 border border-[#024959] text-[9px] text-[#89D9C2] rounded font-bold transition-all uppercase cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  Txt Invoice
                </button>
                <button
                  type="button"
                  onClick={handlePrintSimulation}
                  className="flex items-center justify-center gap-1 px-2 py-1 bg-[#0D0D0D] hover:bg-[#024959]/20 border border-[#024959] text-[9px] text-[#89D9C2] rounded font-bold transition-all uppercase cursor-pointer"
                >
                  <Printer className="w-3 h-3" />
                  Thermal Print
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={closeReceipt}
            className="w-full bg-[#208C8C] hover:bg-[#208C8C]/85 text-[#010326] font-bold py-2 rounded-lg text-xs font-mono transition-colors tracking-widest uppercase shadow-md cursor-pointer"
          >
            Acknowledge & Close
          </button>
            </>
          )}
        </div>
      )}

      {/* Suspend / Hold Cart Prompt Modal */}
      {showHoldModal && (
        <div className="absolute inset-0 bg-[#0D0D0D]/95 backdrop-blur-sm z-50 p-4 flex flex-col justify-center animate-fade-in">
          <form onSubmit={handleHoldSubmit} className="bg-[#0D0D0D] p-4 rounded-xl border border-[#024959] space-y-3 shadow-2xl">
            <div className="flex items-center gap-2 text-[#89D9C2]">
              <Bookmark className="w-4 h-4" />
              <h4 className="text-xs font-bold uppercase font-mono tracking-wider">Suspend / Hold Cart Transaction</h4>
            </div>
            <p className="text-[9.5px] text-slate-400 font-mono leading-relaxed">
              Place the active cart on hold to serve another customer. Assign a friendly identifier to resume it later.
            </p>
            <div>
              <label className="block text-[8px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                Transaction Tag / Label *
              </label>
              <input
                type="text"
                required
                value={holdLabel}
                onChange={(e) => setHoldLabel(e.target.value)}
                placeholder="e.g. Table 4, Customer Mike, Phone order"
                className="w-full bg-[#0D0D0D] border border-[#024959] rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#208C8C]"
              />
            </div>
            <div className="flex gap-2 pt-1 font-mono text-[9px]">
              <button
                type="button"
                onClick={() => setShowHoldModal(false)}
                className="flex-1 bg-transparent hover:bg-[#024959]/20 border border-[#024959] text-slate-400 py-1.5 rounded-lg transition-all"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="flex-1 bg-[#208C8C] hover:bg-[#208C8C]/85 text-[#010326] font-bold py-1.5 rounded-lg transition-all"
              >
                HOLD TRANSACTION
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cart Title & Header */}
      <div className="p-2.5 border-b border-[#024959] bg-[#0D0D0D] flex justify-between items-center shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="relative">
            <span className="absolute -top-1 -right-1 bg-[#89D9C2] text-[#010326] text-[7px] font-bold font-mono px-1 rounded-full shrink-0">
              {cart.reduce((a, b) => a + b.quantity, 0)}
            </span>
            <span className="p-1 bg-[#208C8C]/10 border border-[#208C8C]/30 rounded-md text-[#89D9C2] flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-3 h-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="8" cy="21" r="1" />
                <circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
            </span>
          </span>
          <span className="text-[11px] font-mono font-bold text-white tracking-wide">Register Cart</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Held Carts Dropdown Selector */}
          {heldCarts.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowHeldCartsMenu(!showHeldCartsMenu)}
                className="text-[9px] font-mono text-[#89D9C2] hover:text-white bg-[#208C8C]/10 border border-[#208C8C]/35 px-2 py-0.5 rounded transition-all flex items-center gap-1"
              >
                <Bookmark className="w-2.5 h-2.5 fill-current text-[#89D9C2]" />
                Held ({heldCarts.length})
              </button>
              {showHeldCartsMenu && (
                <div className="absolute right-0 mt-1 w-52 bg-[#0D0D0D] border border-[#024959] rounded-lg shadow-2xl z-40 p-1.5 space-y-1 font-mono text-[9px]">
                  <div className="p-1 text-[#89D9C2] font-bold border-b border-[#024959]/50 flex justify-between items-center">
                    <span>HELD TRANSACTION QUEUE</span>
                    <span className="text-[7px] text-slate-500">RESUME / SCRAP</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pt-1">
                    {heldCarts.map((hc) => (
                      <div key={hc.id} className="flex items-center justify-between bg-[#024959]/5 p-1 rounded hover:bg-[#024959]/20 transition-all border border-[#024959]/10">
                        <div className="truncate pr-1 flex-1">
                          <p className="font-bold text-white truncate leading-tight">{hc.label}</p>
                          <p className="text-[7.5px] text-slate-500">{new Date(hc.date).toLocaleTimeString()}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              if (onResumeHeldCart) onResumeHeldCart(hc.id);
                              setShowHeldCartsMenu(false);
                            }}
                            className="bg-[#208C8C]/20 border border-[#208C8C]/40 hover:bg-[#208C8C]/40 text-[#89D9C2] px-1 rounded font-bold"
                          >
                            LOAD
                          </button>
                          <button
                            onClick={() => {
                              if (onDeleteHeldCart) onDeleteHeldCart(hc.id);
                            }}
                            className="bg-red-950/20 hover:bg-red-950/40 text-red-400 px-1 rounded border border-red-900/10"
                          >
                            DEL
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {cart.length > 0 && (
            <>
              {onHoldCart && (
                <button
                  type="button"
                  onClick={() => setShowHoldModal(true)}
                  className="text-[9px] font-mono text-slate-400 hover:text-[#89D9C2] bg-transparent border border-[#024959] px-2 py-0.5 rounded transition-all flex items-center gap-1"
                  title="Place cart on hold"
                >
                  <Bookmark className="w-2.5 h-2.5" />
                  Hold
                </button>
              )}
              <button
                onClick={onClearCart}
                className="text-[9px] font-mono text-slate-400 hover:text-red-400 flex items-center gap-1 bg-transparent border border-[#024959] px-2 py-0.5 rounded transition-all"
              >
                <Trash2 className="w-2.5 h-2.5" />
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Operator Details Bar */}
      <div className="bg-[#0D0D0D]/60 p-1.5 px-2.5 border-b border-[#024959]/60 grid grid-cols-2 gap-2 font-mono text-[9px] shrink-0">
        <div className="flex items-center gap-1">
          <User className="w-3 h-3 text-[#208C8C]" />
          <select
            value={selectedCashier}
            onChange={(e) => setSelectedCashier(e.target.value)}
            className="bg-transparent text-slate-200 focus:outline-none cursor-pointer hover:text-white"
          >
            {CASHIERS.map((c) => (
              <option key={c} value={c} className="bg-[#0D0D0D] text-slate-200">{c}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1 justify-end">
          <User className="w-3 h-3 text-[#89D9C2]" />
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="bg-transparent text-slate-200 focus:outline-none cursor-pointer hover:text-white text-right max-w-[100px] truncate"
          >
            {LOYALTY_CUSTOMERS.map((cust) => (
              <option key={cust.id} value={cust.id} className="bg-[#0D0D0D] text-slate-200">{cust.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cart Items List viewport */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <div className="p-2.5 bg-[#0D0D0D] border border-[#024959] rounded-full text-[#208C8C]/60 mb-1.5">
              <Plus className="w-4 h-4 animate-pulse" />
            </div>
            <p className="text-[10px] text-slate-300 font-mono">Cart is empty</p>
            <p className="text-[9px] text-slate-500 mt-0.5 max-w-[180px]">
              Tap products from the inventory catalog to queue items.
            </p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.product.id}
              className="flex items-center justify-between bg-[#0D0D0D]/40 border border-[#024959] p-2 rounded-lg transition-all"
            >
              <div className="space-y-0.5 truncate flex-1 pr-1.5">
                <p className="text-[11px] font-bold text-white truncate">{item.product.name}</p>
                <div className="flex items-center gap-1 text-[8px] font-mono text-slate-400">
                  <span>
                    {getCurrencySymbol()}
                    {item.product.price.toFixed(2)} ea
                  </span>
                  <span>•</span>
                  <span>SKU: {item.product.sku}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex items-center bg-[#024959]/30 border border-[#024959] rounded-md overflow-hidden">
                  <button
                    onClick={() => onUpdateQuantity(item.product.id, "sub")}
                    className="p-1 hover:bg-[#208C8C]/15 text-slate-300 transition-colors"
                  >
                    <Minus className="w-2.5 h-2.5" />
                  </button>
                  <span className="px-1.5 text-[10px] font-mono font-bold text-white min-w-[16px] text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => onUpdateQuantity(item.product.id, "add")}
                    className="p-1 hover:bg-[#208C8C]/15 text-slate-300 transition-colors"
                    disabled={item.quantity >= item.product.stock}
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                </div>

                <button
                  onClick={() => onRemoveItem(item.product.id)}
                  className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart Summary Form Footer */}
      {cart.length > 0 && (
        <form
          onSubmit={handleCheckoutSubmit}
          className="p-3 border-t border-[#024959] bg-[#0D0D0D] space-y-2.5 shrink-0"
        >
          {checkoutError && (
            <div className="p-1.5 bg-red-950/40 border border-red-900/40 rounded flex items-start gap-1 text-[8px] text-red-200">
              <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
              <span className="leading-tight">{checkoutError}</span>
            </div>
          )}

          {/* Customer Loyalty Bonus Status Indicator */}
          {activeCustomer.id !== "cust-1" && (
            <div className="p-1.5 bg-[#89D9C2]/10 border border-[#89D9C2]/35 rounded flex items-center justify-between text-[8px] text-[#89D9C2] font-mono">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#89D9C2]" />
                LOYALTY REWARD ENROLLED
              </span>
              <span>Pts: {activeCustomer.loyaltyPoints} → <span className="font-bold">+{Math.floor(total / 10)} pts</span></span>
            </div>
          )}

          {/* Discount Segment Row */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-[8px] font-mono text-slate-400 uppercase tracking-wider">
                Discount / Promotions
              </label>
              {discountPercent > 0 && (
                <span className="text-[8.5px] font-mono text-[#89D9C2] font-bold">-{discountPercent}% APPLIED</span>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1.5 font-mono text-xs">
              {[0, 5, 10, 15, 20].map((pct) => (
                <button
                  type="button"
                  key={pct}
                  onClick={() => setDiscountPercent(pct)}
                  className={`min-h-11 rounded border text-xs font-bold transition-all ${
                    discountPercent === pct
                      ? "bg-amber-500/20 border-amber-500 text-amber-300"
                      : "bg-[#0D0D0D] border-[#024959] text-slate-400 hover:text-white"
                  }`}
                >
                  {pct === 0 ? "NONE" : `${pct}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Detailed Calculations */}
          <div className="space-y-1 text-[9px] font-mono text-slate-400">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="text-slate-300">
                {getCurrencySymbol()}
                {subtotal.toFixed(2)}
              </span>
            </div>
            {discountPercent > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>Discount ({discountPercent}%):</span>
                <span>
                  -{getCurrencySymbol()}
                  {discountAmount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>VAT ({(activeTenant.taxRate * 100).toFixed(1)}%):</span>
              <span className="text-slate-300">
                {getCurrencySymbol()}
                {tax.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-[11px] font-bold text-[#89D9C2] border-t border-[#024959] pt-1.5 mt-0.5">
              <span>GRAND TOTAL:</span>
              <span className="glow-text-mint">
                {getCurrencySymbol()}
                {total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1 pt-0.5">
            <label className="block text-[8px] font-mono text-slate-400 uppercase tracking-wider">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => setPaymentMethod("CASH")}
                className={`min-h-12 rounded-md border text-[11px] font-mono font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                  paymentMethod === "CASH"
                    ? "bg-[#208C8C]/25 border-[#89D9C2]/50 text-white"
                    : "bg-[#0D0D0D] border-[#024959] text-slate-400 hover:text-white"
                }`}
              >
                <Coins className="w-3 h-3" />
                CASH
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("CARD")}
                className={`min-h-12 rounded-md border text-[11px] font-mono font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                  paymentMethod === "CARD"
                    ? "bg-[#208C8C]/25 border-[#89D9C2]/50 text-white"
                    : "bg-[#0D0D0D] border-[#024959] text-slate-400 hover:text-white"
                }`}
              >
                <CreditCard className="w-3 h-3" />
                CARD
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("MOBILE_WALLET")}
                className={`min-h-12 rounded-md border text-[11px] font-mono font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                  paymentMethod === "MOBILE_WALLET"
                    ? "bg-[#208C8C]/25 border-[#89D9C2]/50 text-white"
                    : "bg-[#0D0D0D] border-[#024959] text-slate-400 hover:text-white"
                }`}
              >
                <Wallet className="w-3 h-3" />
                WALLET
              </button>
            </div>
          </div>

          {/* Cash received calculation */}
          {paymentMethod === "CASH" && (
            <div className="pt-0.5 animate-fade-in space-y-1">
              <label className="block text-[8px] font-mono text-slate-400 uppercase tracking-wider">
                Tendered Cash Amount *
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-500">
                  {getCurrencySymbol()}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  inputMode="decimal"
                  className="w-full bg-[#0D0D0D] border border-[#024959] rounded-lg min-h-11 pl-5 pr-2 text-base text-white placeholder-slate-600 focus:outline-none focus:border-[#208C8C] font-mono"
                />
              </div>

              {/* Quick Suggestion buttons */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {cashSuggestions.map((val) => (
                  <button
                    type="button"
                    key={val}
                    onClick={() => setCashReceived(val.toFixed(2))}
                    className="min-h-11 px-3 bg-[#0D0D0D] hover:bg-[#024959]/30 border border-[#024959] rounded-lg text-xs font-mono text-slate-300 whitespace-nowrap"
                  >
                    {val === total ? "Exact" : `${getCurrencySymbol()}${val.toFixed(2)}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Checkout Process Button */}
          <button
            type="submit"
            className={`w-full min-h-12 rounded-lg text-xs font-mono font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-1 mt-1 shadow-md ${
              isOnline
                ? "bg-[#208C8C] hover:bg-[#208C8C]/85 text-[#010326] shadow-[#208C8C]/15"
                : "bg-amber-500 hover:bg-amber-400 text-[#010326] shadow-amber-500/10"
            }`}
          >
            {isOnline ? (
              <>
                <Sparkles className="w-3 h-3" />
                PROCESS TRANSACTION
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3 animate-spin-slow" />
                QUEUE OFFLINE
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
