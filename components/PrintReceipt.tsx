"use client";

import React, { useMemo } from "react";
import { Order, OrderItem, Tenant } from "@/lib/types";
import { 
  Printer, 
  Scissors, 
  CheckCircle, 
  Coins, 
  CreditCard, 
  Wallet,
  Calendar,
  User,
  ShoppingBag,
  Ticket
} from "lucide-react";

interface PrintReceiptProps {
  order: Order;
  items: OrderItem[];
  tenant: Tenant;
}

export function PrintReceipt({ order, items, tenant }: PrintReceiptProps) {
  const currencySymbol = useMemo(() => {
    return tenant.currency === "EUR" ? "€" : tenant.currency === "PHP" ? "₱" : "$";
  }, [tenant.currency]);

  // Generate dynamic vertical line barcode using simple SVG representation
  const barcodeValue = useMemo(() => {
    return order.id.replace("ord-", "").toUpperCase();
  }, [order.id]);

  const barcodeBars = useMemo(() => {
    // Generate deterministic pattern of thick/thin lines
    const hash = barcodeValue.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const bars: { width: string; space: string }[] = [];
    
    for (let i = 0; i < 26; i++) {
      const bit1 = (hash >> (i % 8)) & 1;
      const bit2 = (hash >> ((i + 3) % 8)) & 1;
      bars.push({
        width: bit1 ? "2.5px" : "1px",
        space: bit2 ? "3px" : "1.5px",
      });
    }
    return bars;
  }, [barcodeValue]);

  // Handle native browser printing of the receipt
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center justify-center p-1 w-full">
      {/* Dynamic CSS styles for clean physical printing */}
      <style>{`
        @media print {
          /* Hide everything on the page */
          body * {
            visibility: hidden !important;
            background: none !important;
          }
          /* Show only this specific print area container and its descendants */
          .printable-receipt-area, .printable-receipt-area * {
            visibility: visible !important;
            color: #000000 !important;
          }
          /* Position the receipt at the top left of the printable page */
          .printable-receipt-area {
            position: absolute !important;
            left: 50% !important;
            top: 0 !important;
            transform: translateX(-50%) !important;
            width: 80mm !important; /* Standard thermal receipt printer size */
            margin: 0 !important;
            padding: 5mm !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
          }
          /* Hide UI action buttons during printing */
          .non-printable-actions {
            display: none !important;
          }
        }
      `}</style>

      {/* RECEIPT PAPER CONTAINER */}
      <div 
        id="thermal-receipt-to-print"
        className="printable-receipt-area w-full max-w-[310px] bg-white text-slate-900 p-4 font-mono text-[11px] rounded-lg shadow-xl border border-slate-200 select-none relative overflow-hidden"
      >
        {/* Decorative receipt tear lines */}
        <div className="absolute top-0 left-0 right-0 h-1 flex justify-between overflow-hidden">
          {Array.from({ length: 32 }).map((_, i) => (
            <div key={i} className="w-2 h-2 bg-slate-100 rotate-45 shrink-0 -translate-y-1" />
          ))}
        </div>

        {/* Scissors Indicator */}
        <div className="non-printable-actions flex items-center justify-between text-slate-400 text-[8px] border-b border-dashed border-slate-200 pb-2 mb-3 mt-1 font-mono">
          <span className="flex items-center gap-1">
            <Scissors className="w-3 h-3 text-slate-300" />
            RECEIPT CUT-LINE
          </span>
          <span>80mm Thermal</span>
        </div>

        {/* Header Block */}
        <div className="text-center space-y-1 mb-4 pt-1">
          <h2 className="text-sm font-extrabold tracking-wide text-black uppercase leading-tight">
            {tenant.name}
          </h2>
          <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">
            {tenant.businessType}
          </p>
          <div className="text-[8px] text-slate-400 space-y-0.5">
            <p>Station: Terminal #1024</p>
            <p>Location: Store ID-{tenant.id.substring(7, 13).toUpperCase()}</p>
          </div>
          <div className="border-b border-dashed border-slate-300 my-2"></div>
        </div>

        {/* Receipt Meta Details */}
        <div className="space-y-1 mb-3.5 text-[9px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
          <div className="flex justify-between items-center">
            <span className="font-bold text-black">RECEIPT #:</span>
            <span className="font-extrabold text-black">{barcodeValue}</span>
          </div>
          <div className="flex justify-between">
            <span className="flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5 text-slate-400" />
              DATE:
            </span>
            <span>{new Date(order.date).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="flex items-center gap-1">
              <User className="w-2.5 h-2.5 text-slate-400" />
              OPERATOR:
            </span>
            <span className="truncate max-w-[120px]">{order.cashierName || "System Operator"}</span>
          </div>
          <div className="flex justify-between">
            <span className="flex items-center gap-1">
              <ShoppingBag className="w-2.5 h-2.5 text-slate-400" />
              CUSTOMER:
            </span>
            <span className="truncate max-w-[120px]">{order.customerName || "Walk-In Guest"}</span>
          </div>
        </div>

        {/* Items Table Headers */}
        <div className="border-b border-dashed border-slate-300 pb-1 mb-1.5 flex justify-between font-bold text-black text-[9px]">
          <span className="w-1/2">ITEM DESCRIPTION</span>
          <span className="w-1/6 text-center">QTY</span>
          <span className="w-1/3 text-right">TOTAL</span>
        </div>

        {/* Items List */}
        <div className="space-y-1.5 mb-3.5">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between items-start text-[10px] leading-tight">
              <div className="w-1/2 pr-1">
                <p className="font-bold text-slate-800 break-words">{item.name}</p>
                <p className="text-[8px] text-slate-400">
                  {currencySymbol}{item.price.toFixed(2)} ea
                </p>
              </div>
              <span className="w-1/6 text-center text-slate-600 font-bold">
                {item.quantity}
              </span>
              <span className="w-1/3 text-right font-bold text-black">
                {currencySymbol}{(item.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="border-b border-dashed border-slate-300 my-2.5"></div>
        </div>

        {/* Calculations Block */}
        <div className="space-y-1 text-[9px] text-slate-600">
          <div className="flex justify-between">
            <span>SUBTOTAL:</span>
            <span className="font-bold text-slate-800">
              {currencySymbol}{(order.subtotal + (order.discountAmount || 0)).toFixed(2)}
            </span>
          </div>

          {order.discountAmount && order.discountAmount > 0 ? (
            <div className="flex justify-between text-red-600 font-medium">
              <span className="flex items-center gap-1">
                <Ticket className="w-3 h-3 text-red-500" />
                DISCOUNT ({order.discountPercent}%):
              </span>
              <span>
                -{currencySymbol}{order.discountAmount.toFixed(2)}
              </span>
            </div>
          ) : null}

          <div className="flex justify-between">
            <span>VAT RATE ({(tenant.taxRate * 100).toFixed(1)}%):</span>
            <span>{currencySymbol}{order.tax.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-black font-extrabold text-[12px] border-t border-dashed border-slate-300 pt-2 mt-1.5">
            <span>GRAND TOTAL:</span>
            <span>{currencySymbol}{order.total.toFixed(2)}</span>
          </div>

          {/* Payment Method Details */}
          <div className="border-t border-dashed border-slate-300 pt-2 mt-2 space-y-1">
            <div className="flex justify-between">
              <span>PAYMENT METHOD:</span>
              <span className="font-extrabold text-slate-800">{order.paymentMethod}</span>
            </div>

            {order.paymentMethod === "CASH" ? (
              <>
                <div className="flex justify-between text-slate-500">
                  <span>CASH TENDERED:</span>
                  <span>{currencySymbol}{(order.cashReceived || order.total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-600 text-[10px]">
                  <span>CHANGE DUE:</span>
                  <span>{currencySymbol}{(order.changeDue || 0).toFixed(2)}</span>
                </div>
              </>
            ) : order.paymentMethod === "CARD" ? (
              <div className="flex justify-between text-slate-500 text-[8px]">
                <span className="flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-slate-400" />
                  AUTH CODE:
                </span>
                <span className="font-mono">#OK-{(barcodeValue.charCodeAt(1) * 32).toString(16).toUpperCase()}</span>
              </div>
            ) : (
              <div className="flex justify-between text-slate-500 text-[8px]">
                <span className="flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-slate-400" />
                  REF ID:
                </span>
                <span className="font-mono">TXN-{(barcodeValue.charCodeAt(2) * 55).toString(10)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Barcode representation */}
        <div className="my-4 text-center">
          <div className="border-t border-dashed border-slate-200 pt-3.5 mb-2.5"></div>
          
          {/* Barcode design representation */}
          <div className="flex flex-col items-center">
            <div className="flex items-end h-8 overflow-hidden bg-white px-2">
              {barcodeBars.map((bar, idx) => (
                <React.Fragment key={idx}>
                  <div className="h-full bg-black shrink-0" style={{ width: bar.width }} />
                  <div className="h-full bg-transparent shrink-0" style={{ width: bar.space }} />
                </React.Fragment>
              ))}
            </div>
            <span className="text-[7.5px] font-mono tracking-[3px] mt-1.5 text-slate-700 font-bold">
              *{barcodeValue}*
            </span>
          </div>
        </div>

        {/* Footer Greetings */}
        <div className="text-center text-[8px] text-slate-400 space-y-1 border-t border-dashed border-slate-200 pt-3">
          <p className="font-bold text-slate-600">THANK YOU FOR YOUR PATRONAGE!</p>
          <p>POWERED BY NXTGEN POS SYSTEMS</p>
          <p className="text-[7px]">Please retain this copy for exchanges.</p>
        </div>

        {/* Decorative receipt tear lines at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 flex justify-between overflow-hidden">
          {Array.from({ length: 32 }).map((_, i) => (
            <div key={i} className="w-2 h-2 bg-slate-100 rotate-45 shrink-0 translate-y-1" />
          ))}
        </div>
      </div>

      {/* Screen action button to trigger print directly */}
      <div className="non-printable-actions w-full max-w-[310px] mt-3">
        <button
          onClick={handlePrint}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#208C8C] hover:bg-[#208C8C]/85 text-[#010326] text-xs font-mono font-extrabold rounded-lg shadow-lg hover:shadow-xl transition-all uppercase cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Print Receipt Now
        </button>
      </div>
    </div>
  );
}
