import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { encodeCustom, parseCustom } from "../common/custom-fields";
import { DatabaseService } from "../database/database.service";
import { RealtimeService } from "../realtime/realtime.service";
import { TenantsService } from "../tenants/tenants.service";

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  sku: string;
  price: number;
  stock: number;
  description: string;
  costPrice: number;
  reorderLevel: number;
  supplierId: string | null;
  custom: Record<string, string>;
}

const fromRow = (row: any): Product => ({ ...row, custom: parseCustom(row.custom) });

@Injectable()
export class ProductsService {
  private memoryProducts: Product[] = [];

  constructor(
    @Inject(DatabaseService) private readonly dbService: DatabaseService,
    @Inject(TenantsService) private readonly tenantsService: TenantsService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService
  ) {}

  async getById(id: string): Promise<Product | null> {
    if (this.dbService.client) {
      try {
        const row = await this.dbService.client.product.findUnique({ where: { id } });
        return row ? fromRow(row) : null;
      } catch (err: any) {
        console.error("Failed to load product from the local database, falling back:", err.message);
      }
    }
    return this.memoryProducts.find((product) => product.id === id) ?? null;
  }

  private async requireOwned(userId: string, id: string): Promise<Product> {
    const owned = await this.tenantsService.ownedIds(userId);
    const product = await this.getById(id);
    if (!product) throw new NotFoundException("Product not found.");
    if (!owned.has(product.tenantId)) {
      throw new ForbiddenException("You do not have access to this store.");
    }
    return product;
  }

  async findAll(userId: string): Promise<Product[]> {
    const owned = await this.tenantsService.ownedIds(userId);
    const ids = [...owned];
    if (ids.length === 0) return [];
    if (this.dbService.client) {
      try {
        const rows = await this.dbService.client.product.findMany({
          where: { tenantId: { in: ids } },
        });
        return rows.map(fromRow);
      } catch (err: any) {
        console.error("Failed to query products from the local database, falling back:", err.message);
      }
    }
    return this.memoryProducts.filter((product) => owned.has(product.tenantId));
  }

  /** Fields editable from the product form. Stock is deliberately absent: it only moves through stock movements. */
  private editable(body: Partial<Product>) {
    return {
      name: body.name?.trim() || undefined,
      category: body.category?.trim() || undefined,
      price: body.price !== undefined ? Math.max(0, parseFloat(body.price as any) || 0) : undefined,
      description: body.description,
      costPrice: body.costPrice !== undefined ? Math.max(0, parseFloat(body.costPrice as any) || 0) : undefined,
      reorderLevel: body.reorderLevel !== undefined ? Math.max(0, parseInt(body.reorderLevel as any) || 0) : undefined,
      supplierId: body.supplierId === undefined ? undefined : body.supplierId || null,
      custom: body.custom === undefined ? undefined : parseCustom(body.custom),
    };
  }

  async create(userId: string, body: Partial<Product>): Promise<Product> {
    if (!body.tenantId || !(await this.tenantsService.owns(userId, body.tenantId))) {
      throw new ForbiddenException("You do not have access to this store.");
    }
    const edit = this.editable(body);
    const newProd: Product = {
      id: body.id || `prod-${Date.now()}`,
      tenantId: body.tenantId,
      name: edit.name || "New Product",
      category: edit.category || "General",
      sku: body.sku || `SKU-${Date.now()}`,
      price: edit.price ?? 0,
      stock: 0, // opening stock arrives as an OPENING stock movement
      description: edit.description || "",
      costPrice: edit.costPrice ?? 0,
      reorderLevel: edit.reorderLevel ?? 5,
      supplierId: edit.supplierId ?? null,
      custom: edit.custom ?? {},
    };

    let saved = false;
    if (this.dbService.client) {
      try {
        await this.dbService.client.product.create({
          data: { ...newProd, custom: encodeCustom(newProd.custom) },
        });
        saved = true;
      } catch (err: any) {
        console.error("Failed to insert product to the local database, fallback to memory:", err.message);
      }
    }
    if (!saved) this.memoryProducts.push(newProd);
    this.realtime.emit(newProd.tenantId, "products");
    return newProd;
  }

  async update(userId: string, id: string, body: Partial<Product>): Promise<Product> {
    const current = await this.requireOwned(userId, id);
    const edit = this.editable(body);
    if (this.dbService.client) {
      try {
        const row = await this.dbService.client.product.update({
          where: { id },
          data: { ...edit, custom: edit.custom === undefined ? undefined : encodeCustom(edit.custom) },
        });
        this.realtime.emit(current.tenantId, "products");
        return fromRow(row);
      } catch (err: any) {
        console.error("Failed to update product in the local database, fallback to memory:", err.message);
      }
    }

    const idx = this.memoryProducts.findIndex((p) => p.id === id);
    if (idx !== -1) {
      const defined = Object.fromEntries(Object.entries(edit).filter(([, v]) => v !== undefined));
      this.memoryProducts[idx] = { ...this.memoryProducts[idx], ...defined };
      this.realtime.emit(current.tenantId, "products");
      return this.memoryProducts[idx];
    }
    throw new NotFoundException("Product not found.");
  }

  async delete(userId: string, id: string): Promise<{ success: boolean }> {
    const current = await this.requireOwned(userId, id);
    if (this.dbService.client) {
      try {
        await this.dbService.client.product.delete({ where: { id } });
        this.realtime.emit(current.tenantId, "products");
        return { success: true };
      } catch (err: any) {
        console.error("Failed to delete product in the local database, fallback to memory:", err.message);
      }
    }

    const idx = this.memoryProducts.findIndex((p) => p.id === id);
    if (idx !== -1) {
      this.memoryProducts.splice(idx, 1);
      this.realtime.emit(current.tenantId, "products");
      return { success: true };
    }
    throw new NotFoundException("Product not found.");
  }

  /** Move stock by a signed delta. A restock may also refresh the unit cost and preferred supplier. */
  async adjustStock(
    productId: string,
    delta: number,
    restock?: { unitCost?: number | null; supplierId?: string | null }
  ) {
    const cost = restock?.unitCost != null && restock.unitCost > 0 ? restock.unitCost : undefined;
    const supplierId = restock?.supplierId || undefined;
    if (this.dbService.client) {
      try {
        await this.dbService.client.product.update({
          where: { id: productId },
          data: { stock: { increment: delta }, costPrice: cost, supplierId },
        });
        return;
      } catch (err: any) {
        console.warn(`Could not adjust stock in the local database for product ${productId}:`, err.message);
      }
    }
    const p = this.memoryProducts.find((product) => product.id === productId);
    if (p) {
      p.stock = p.stock + delta;
      if (cost !== undefined) p.costPrice = cost;
      if (supplierId) p.supplierId = supplierId;
    }
  }

  async decrementStock(productId: string, quantity: number) {
    await this.adjustStock(productId, -quantity);
  }
}
