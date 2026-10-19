"use client";

import { Order, OrderItem, Tenant } from "@/lib/types";
import { money } from "@/lib/money";
import { Button } from "@/components/ui/button";

interface PrintReceiptProps {
  order: Order;
  items: OrderItem[];
  tenant: Tenant;
}

export function PrintReceipt({ order, items, tenant }: PrintReceiptProps) {
  return (
    <div className="flex flex-col items-center">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .printable-receipt-area, .printable-receipt-area * {
            visibility: visible !important;
            color: #000 !important;
          }
          .printable-receipt-area {
            position: absolute !important;
            left: 50% !important;
            top: 0 !important;
            transform: translateX(-50%) !important;
            width: 80mm !important;
            background: #fff !important;
            padding: 5mm !important;
          }
          .non-printable-actions { display: none !important; }
        }
      `}</style>
      <div className="printable-receipt-area w-full max-w-[320px] bg-white p-4 text-black">
        <p className="text-center text-sm font-bold">{tenant.name}</p>
        <p className="mb-3 text-center text-xs">{tenant.businessType}</p>
        <p className="text-xs">{new Date(order.date).toLocaleString()}</p>
        <p className="mb-3 text-xs">{order.id}</p>
        {order.cashierName ? <p className="text-xs">Cashier {order.cashierName}</p> : null}
        {order.customerName ? <p className="mb-3 text-xs">Customer {order.customerName}</p> : null}
        <ul className="space-y-1 text-xs">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>
                {item.quantity} {item.name}
              </span>
              <span>{money(tenant.currency, item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between text-sm font-bold">
          <span>Total</span>
          <span>{money(tenant.currency, order.total)}</span>
        </p>
        <p className="text-xs">Tax {money(tenant.currency, order.tax)}</p>
        {order.paymentMethod === "CASH" ? (
          <>
            <p className="text-xs">Cash {money(tenant.currency, order.cashReceived || 0)}</p>
            <p className="text-xs">Change {money(tenant.currency, order.changeDue || 0)}</p>
          </>
        ) : (
          <p className="text-xs">{order.paymentMethod === "CARD" ? "Card" : "Wallet"}</p>
        )}
      </div>
      <Button className="non-printable-actions mt-3 w-full max-w-[320px]" onClick={() => window.print()}>
        Print
      </Button>
    </div>
  );
}
