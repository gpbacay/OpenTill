import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { ProductsService } from "../products/products.service";
import { TenantsService } from "../tenants/tenants.service";

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
    @Inject(TenantsService) private readonly tenantsService: TenantsService
  ) {}

  async findAll(userId: string): Promise<any[]> {
    const owned = await this.tenantsService.ownedIds(userId);
    if (owned.size === 0) return [];
    if (this.dbService.client) {
      try {
        return await this.dbService.client.order.findMany({
          where: { tenantId: { in: [...owned] } },
          include: { items: true }
        });
      } catch (err: any) {
        console.error("Failed to query orders from the local database, falling back:", err.message);
      }
    }
    return this.memoryOrders
      .filter((order) => owned.has(order.tenantId))
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

  async sync(userId: string, orders: any[], items: any[]): Promise<{ success: boolean; count: number; mode?: string }> {
    await this.assertOwned(userId, orders, items);
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
          }
        }

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
        }
      }
    }

    return { success: true, count: results.length, mode: "memory" };
  }
}
