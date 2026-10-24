import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { InventoryService } from "../inventory/inventory.service";
import { ProductsService } from "../products/products.service";
import { RealtimeService } from "../realtime/realtime.service";
import { TenantsService } from "../tenants/tenants.service";
import type { AuthUser } from "../auth/auth.service";

export interface Order {
  id: string;
  tenantId: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  isOffline: boolean;
  date: string;
  syncedAt?: string | null;
  cashierName?: string | null;
  /** The cashier account that rang it up; null for admins. */
  cashierId?: string | null;
  customerName?: string | null;
  discountAmount?: number | null;
  discountPercent?: number | null;
  cashReceived?: number | null;
  changeDue?: number | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

@Injectable()
export class OrdersService {
  private memoryOrders: Order[] = [];

  private memoryOrderItems: OrderItem[] = [];

  constructor(
    @Inject(DatabaseService) private readonly dbService: DatabaseService,
    @Inject(ProductsService) private readonly productsService: ProductsService,
    @Inject(TenantsService) private readonly tenantsService: TenantsService,
    @Inject(InventoryService) private readonly inventory: InventoryService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService
  ) {}

  /** Admins get every sale in their stores; a cashier only the sales they rang up. */
  async findAll(user: Pick<AuthUser, "id" | "role">): Promise<any[]> {
    const owned = await this.tenantsService.ownedIds(user.id);
    if (owned.size === 0) return [];
    const cashierId = user.role === "CASHIER" ? user.id : undefined;
    if (this.dbService.client) {
      try {
        return await this.dbService.client.order.findMany({
          where: { tenantId: { in: [...owned] }, ...(cashierId ? { cashierId } : {}) },
          include: { items: true }
        });
      } catch (err: any) {
        console.error("Failed to query orders from the local database, falling back:", err.message);
      }
    }
    return this.memoryOrders
      .filter((order) => owned.has(order.tenantId) && (!cashierId || order.cashierId === cashierId))
      .map(o => ({
        ...o,
        items: this.memoryOrderItems.filter(item => item.orderId === o.id)
      }));
  }

  private async assertOwned(userId: string, orders: any[], items: any[]) {
    const owned = await this.tenantsService.ownedIds(userId);
    const tenantByOrder = new Map<string, string>();
    for (const order of orders ?? []) {
      if (!order?.tenantId || !owned.has(order.tenantId)) {
        throw new ForbiddenException("You do not have access to this store.");
      }
      tenantByOrder.set(order.id, order.tenantId);
    }
    for (const item of items ?? []) {
      const tenantId = tenantByOrder.get(item?.orderId);
      if (!tenantId) throw new ForbiddenException("You do not have access to this store.");
      const product = item?.productId
        ? await this.productsService.getById(item.productId)
        : null;
      if (product && product.tenantId !== tenantId) {
        throw new ForbiddenException("You do not have access to this store.");
      }
    }
  }

  async sync(user: Pick<AuthUser, "id" | "role">, orders: any[], items: any[]): Promise<{ success: boolean; count: number; mode?: string }> {
    await this.assertOwned(user.id, orders, items);
    // Set here, never from the request body, so a cashier can't file sales under someone else.
    const cashierId = user.role === "CASHIER" ? user.id : null;
    const tenantByOrder = new Map<string, string>((orders ?? []).map((o) => [o.id, o.tenantId]));
    const dateByOrder = new Map<string, string>((orders ?? []).map((o) => [o.id, o.date]));
    console.log(`📡 [OrdersModule] Sync batch received: ${orders?.length || 0} orders, ${items?.length || 0} items.`);

    if (this.dbService.client) {
      try {
        const results = [];
        for (const o of orders) {
          const existing = await this.dbService.client.order.findUnique({ where: { id: o.id } });
          if (!existing) {
            const created = await this.dbService.client.order.create({
              data: {
                id: o.id,
                tenantId: o.tenantId,
                status: "COMPLETED",
                subtotal: parseFloat(o.subtotal) || 0,
                tax: parseFloat(o.tax) || 0,
                total: parseFloat(o.total) || 0,
                paymentMethod: o.paymentMethod,
                isOffline: false,
                date: new Date(o.date),
                syncedAt: new Date(),
                cashierName: o.cashierName,
                cashierId,
                customerName: o.customerName,
                discountAmount: o.discountAmount == null || o.discountAmount === "" ? null : parseFloat(o.discountAmount),
                discountPercent: o.discountPercent == null || o.discountPercent === "" ? null : parseFloat(o.discountPercent),
                cashReceived: o.cashReceived == null || o.cashReceived === "" ? null : parseFloat(o.cashReceived),
                changeDue: o.changeDue == null || o.changeDue === "" ? null : parseFloat(o.changeDue)
              }
            });
            results.push(created);
          }
        }

        for (const item of items) {
          const existingItem = await this.dbService.client.orderItem.findUnique({ where: { id: item.id } });
          if (!existingItem) {
            await this.dbService.client.orderItem.create({
              data: {
                id: item.id,
                orderId: item.orderId,
                productId: item.productId,
                name: item.name,
                price: parseFloat(item.price) || 0,
                quantity: parseInt(item.quantity) || 1
              }
            });

            // Clean decoupling: use injected ProductsService to decrement stock!
            await this.productsService.decrementStock(item.productId, parseInt(item.quantity) || 1);
            await this.inventory.logSale(
              { id: item.id, productId: item.productId, name: item.name, quantity: parseInt(item.quantity) || 1 },
              { tenantId: tenantByOrder.get(item.orderId)!, date: new Date(dateByOrder.get(item.orderId) ?? Date.now()) }
            );
          }
        }

        this.announce(orders);
        return { success: true, count: results.length };
      } catch (err: any) {
        if (err instanceof ForbiddenException) throw err;
        console.error("Prisma sync error:", err);
      }
    }

    // In-memory Fallback
    const results = [];
    if (orders) {
      for (const o of orders) {
        const exists = this.memoryOrders.some(existing => existing.id === o.id);
        if (!exists) {
          const syncedOrder: Order = {
            id: o.id,
            tenantId: o.tenantId,
            status: "COMPLETED",
            subtotal: parseFloat(o.subtotal) || 0,
            tax: parseFloat(o.tax) || 0,
            total: parseFloat(o.total) || 0,
            paymentMethod: o.paymentMethod,
            isOffline: false,
            date: o.date,
            syncedAt: new Date().toISOString(),
            cashierName: o.cashierName,
            cashierId,
            customerName: o.customerName,
            discountAmount: o.discountAmount == null || o.discountAmount === "" ? null : parseFloat(o.discountAmount),
            discountPercent: o.discountPercent == null || o.discountPercent === "" ? null : parseFloat(o.discountPercent),
            cashReceived: o.cashReceived == null || o.cashReceived === "" ? null : parseFloat(o.cashReceived),
            changeDue: o.changeDue == null || o.changeDue === "" ? null : parseFloat(o.changeDue)
          };
          this.memoryOrders.push(syncedOrder);
          results.push(syncedOrder);
        }
      }
    }

    if (items) {
      for (const item of items) {
        const exists = this.memoryOrderItems.some(existing => existing.id === item.id);
        if (!exists) {
          const newOrderItem: OrderItem = {
            id: item.id,
            orderId: item.orderId,
            productId: item.productId,
            name: item.name,
            price: parseFloat(item.price) || 0,
            quantity: parseInt(item.quantity) || 1
          };
          this.memoryOrderItems.push(newOrderItem);
          // Decrement in memory using injected ProductsService
          await this.productsService.decrementStock(item.productId, parseInt(item.quantity) || 1);
          await this.inventory.logSale(
            { id: item.id, productId: item.productId, name: item.name, quantity: parseInt(item.quantity) || 1 },
            { tenantId: tenantByOrder.get(item.orderId)!, date: new Date(dateByOrder.get(item.orderId) ?? Date.now()) }
          );
        }
      }
    }

    this.announce(orders);
    return { success: true, count: results.length, mode: "memory" };
  }

  private announce(orders: any[]) {
    for (const tenantId of new Set((orders ?? []).map((o) => o.tenantId as string))) {
      this.realtime.emit(tenantId, "orders");
      this.realtime.emit(tenantId, "products");
      this.realtime.emit(tenantId, "stock");
    }
  }
}
