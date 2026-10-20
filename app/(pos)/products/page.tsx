import { redirect } from "next/navigation";

// Products now live in Inventory; keep old links working.
export default function ProductsPage() {
  redirect("/inventory");
}
