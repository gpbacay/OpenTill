"use client";

import { ProductsManager } from "@/components/ProductsManager";
import { usePos } from "@/contexts/pos-context";

export default function ProductsPage() {
  const {
    products,
    activeTenant,
    handleAddProduct,
    handleUpdateProduct,
    handleDeleteProduct,
  } = usePos();
  if (!activeTenant) return null;

  return (
    <ProductsManager
      products={products}
      activeTenant={activeTenant}
      onAddProduct={handleAddProduct}
      onUpdateProduct={handleUpdateProduct}
      onDeleteProduct={handleDeleteProduct}
    />
  );
}
