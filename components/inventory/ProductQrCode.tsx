"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { HugeiconsIcon } from "@hugeicons/react";
import { LinkSquare01Icon, PrinterIcon } from "@hugeicons/core-free-icons";
import type { Product, Tenant } from "@/lib/types";
import { stockState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/motion/skeleton";

export function ProductQrCode({ product, tenant }: { product: Product; tenant: Tenant }) {
  const [image, setImage] = useState("");

  useEffect(() => {
    const url = `${window.location.origin}/inventory/product/${encodeURIComponent(product.id)}`;
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (!cancelled) setImage(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setImage("");
      });
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  const state = stockState(product);
  const status = state === "out" ? "Out of stock" : state === "low" ? "Low stock" : "In stock";

  return (
    <div className="space-y-3">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .printable-product-qr-area, .printable-product-qr-area * {
            visibility: visible !important;
            color: #000 !important;
          }
          .printable-product-qr-area {
            position: absolute !important;
            left: 50% !important;
            top: 0 !important;
            transform: translateX(-50%) !important;
            width: 70mm !important;
            background: #fff !important;
            padding: 6mm !important;
          }
          .non-printable-product-qr { display: none !important; }
        }
      `}</style>
      <div className="printable-product-qr-area mx-auto w-full max-w-64 rounded-xl bg-white p-4 text-center text-black">
        <p className="text-sm font-bold">{tenant.name}</p>
        <p className="mb-3 truncate text-lg font-semibold">{product.name}</p>
        {image ? (
          <img src={image} alt={`QR code for ${product.name}`} className="mx-auto aspect-square w-full max-w-48" />
        ) : (
          <Skeleton className="mx-auto aspect-square w-full max-w-48 rounded-none" />
        )}
        <p className="mt-3 font-mono text-xs">{product.id}</p>
        {product.sku ? <p className="text-xs">SKU {product.sku}</p> : null}
        <p className="mt-1 text-sm font-semibold">{status} · {product.stock}</p>
        <p className="mt-2 text-[10px]">Scan to view live product details</p>
      </div>
      <div className="non-printable-product-qr flex flex-wrap justify-center gap-2">
        <Button type="button" variant="secondary" disabled={!image} onClick={() => window.print()}>
          <HugeiconsIcon icon={PrinterIcon} size={16} data-icon="inline-start" />
          Print QR
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/inventory/product/${encodeURIComponent(product.id)}`}>
            <HugeiconsIcon icon={LinkSquare01Icon} size={16} data-icon="inline-start" />
            Live details
          </Link>
        </Button>
      </div>
    </div>
  );
}
