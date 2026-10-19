import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class DatabaseService implements OnModuleInit {
  public client: PrismaClient | null = null;

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      console.warn(
        "DATABASE_URL is not configured. Running with the in-memory store."
      );
      return;
    }
    try {
      this.client = new PrismaClient();
      await this.client.$connect();
      await this.purgeDemoRecords();
      console.log("Connected to the local SQLite database.");
    } catch (err: any) {
      console.error(
        "Local database connection failed. In-memory store will be used. Error:",
        err.message
      );
      this.client = null;
    }
  }

  private async purgeDemoRecords() {
    const client = this.client;
    if (!client) return;
    const demoOrders = ["ord-1001", "ord-1002"];
    const demoProducts = [
      "prod-101",
      "prod-102",
      "prod-103",
      "prod-104",
      "prod-201",
      "prod-202",
      "prod-203",
      "prod-301",
      "prod-302",
    ];
    const demoTenants = ["tenant-1", "tenant-2", "tenant-3"];
    await client.orderItem.deleteMany({ where: { orderId: { in: demoOrders } } });
    await client.order.deleteMany({ where: { id: { in: demoOrders } } });
    await client.product.deleteMany({ where: { id: { in: demoProducts } } });
    for (const id of demoTenants) {
      const [products, orders] = await Promise.all([
        client.product.count({ where: { tenantId: id } }),
        client.order.count({ where: { tenantId: id } }),
      ]);
      if (products === 0 && orders === 0) {
        await client.tenant.deleteMany({ where: { id } });
      }
    }
  }
}
