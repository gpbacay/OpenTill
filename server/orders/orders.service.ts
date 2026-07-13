import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { ProductsService } from "../products/products.service";

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
export class OrdersService implements OnModuleInit {
  private memoryOrders: Order[] = [
    {
      id: "ord-1001",
      tenantId: "tenant-1",
      status: "COMPLETED",
      subtotal: 17.25,
      tax: 1.73,
      total: 18.98,
      paymentMethod: "MOBILE_WALLET",
      isOffline: false,
      date: "2026-07-12T14:22:15Z",
      syncedAt: "2026-07-12T14:22:16Z",
    },
    {
      id: "ord-1002",
      tenantId: "tenant-2",
      status: "COMPLETED",
      subtotal: 329.98,
      tax: 26.40,
      total: 356.38,
      paymentMethod: "CARD",
      isOffline: false,
      date: "2026-07-12T16:10:42Z",
      syncedAt: "2026-07-12T16:10:45Z",
    }
  ];

  private memoryOrderItems: OrderItem[] = [
    {
      id: "item-1001-1",
      orderId: "ord-1001",
      productId: "prod-101",
      name: "Artisanal Avocado Toast",
      price: 12.50,
      quantity: 1,
    },
    {
      id: "item-1001-2",
      orderId: "ord-1001",
      productId: "prod-102",
      name: "Cold Brew Draft Coffee",
      price: 4.75,
      quantity: 1,
    },
    {
      id: "item-1002-1",
      orderId: "ord-1002",
      productId: "prod-201",
      name: "Apex ANC Wireless Headphones",
      price: 249.99,
      quantity: 1,
    },
    {
      id: "item-1002-2",
      orderId: "ord-1002",
      productId: "prod-203",
      name: "Multi-Port USB-C Pro Dock",
      price: 79.99,
      quantity: 1,
    }
  ];

  constructor(
    @Inject(DatabaseService) private readonly dbService: DatabaseService,
    @Inject(ProductsService) private readonly productsService: ProductsService
  ) {}

  async onModuleInit() {
    await this.seedIfNeeded();
  }

  private async seedIfNeeded() {
    const client = this.dbService?.client;
    if (!client) return;

    try {
      const count = await client.order.count();
      if (count > 0) return;

      console.log("🌱 [OrdersModule] Seeding orders into database...");
      for (const o of this.memoryOrders) {
        await client.order.create({
          data: {
            id: o.id,
            tenantId: o.tenantId,
            status: o.status,
            subtotal: o.subtotal,
            tax: o.tax,
            total: o.total,
            paymentMethod: o.paymentMethod,
            isOffline: o.isOffline,
            date: new Date(o.date),
            syncedAt: o.syncedAt ? new Date(o.syncedAt) : null,
          },
        });
      }

      for (const item of this.memoryOrderItems) {
        await client.orderItem.create({
          data: {
            id: item.id,
            orderId: item.orderId,
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          },
        });
      }
      console.log("✅ [OrdersModule] Order seeding complete.");
    } catch (err: any) {
      console.warn("⚠️ [OrdersModule] Seeding check failed:", err.message);
    }
  }

  async findAll(): Promise<any[]> {
    if (this.dbService.client) {
      try {
        return await this.dbService.client.order.findMany({
          include: { items: true }
        });
      } catch (err: any) {
        console.error("Failed to query orders from PostgreSQL, falling back:", err.message);
      }
    }
    return this.memoryOrders.map(o => ({
      ...o,
      items: this.memoryOrderItems.filter(item => item.orderId === o.id)
    }));
  }

  async sync(orders: any[], items: any[]): Promise<{ success: boolean; count: number; mode?: string }> {
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
                discountAmount: o.discountAmount ? parseFloat(o.discountAmount) : null,
                discountPercent: o.discountPercent ? parseFloat(o.discountPercent) : null,
                cashReceived: o.cashReceived ? parseFloat(o.cashReceived) : null,
                changeDue: o.changeDue ? parseFloat(o.changeDue) : null
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
            discountAmount: o.discountAmount ? parseFloat(o.discountAmount) : null,
            discountPercent: o.discountPercent ? parseFloat(o.discountPercent) : null,
            cashReceived: o.cashReceived ? parseFloat(o.cashReceived) : null,
            changeDue: o.changeDue ? parseFloat(o.changeDue) : null
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
