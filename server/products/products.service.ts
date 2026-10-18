import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  sku: string;
  price: number;
  stock: number;
  description: string;
}

@Injectable()
export class ProductsService implements OnModuleInit {
  private memoryProducts: Product[] = [
    {
      id: "prod-101",
      tenantId: "tenant-1",
      name: "Artisanal Avocado Toast",
      category: "Breakfast",
      sku: "AVO-TST-01",
      price: 12.50,
      stock: 45,
      description: "Sourdough toast with organic mashed avocado, cherry tomatoes, and microgreens.",
    },
    {
      id: "prod-102",
      tenantId: "tenant-1",
      name: "Cold Brew Draft Coffee",
      category: "Beverages",
      sku: "CLD-BRW-02",
      price: 4.75,
      stock: 120,
      description: "24-hour slow steeped specialty cold brew coffee.",
    },
    {
      id: "prod-103",
      tenantId: "tenant-1",
      name: "Truffle Parmesan Fries",
      category: "Sides",
      sku: "TRF-PM-03",
      price: 8.00,
      stock: 60,
      description: "Golden rustic cut fries tossed in real truffle oil and finely grated Parmigiano.",
    },
    {
      id: "prod-104",
      tenantId: "tenant-1",
      name: "Acai Berry Super Bowl",
      category: "Breakfast",
      sku: "ACI-BWL-04",
      price: 14.00,
      stock: 30,
      description: "Organic acai puree topped with strawberries, blueberries, hemp seeds, and honey.",
    },
    {
      id: "prod-201",
      tenantId: "tenant-2",
      name: "Apex ANC Wireless Headphones",
      category: "Audio",
      sku: "APX-HDP-21",
      price: 249.99,
      stock: 15,
      description: "Active Noise Cancelling over-ear bluetooth headphones with 40-hr battery life.",
    },
    {
      id: "prod-202",
      tenantId: "tenant-2",
      name: "ErgoGlide Mechanical Keyboard",
      category: "Peripherals",
      sku: "ERG-KBD-22",
      price: 129.50,
      stock: 22,
      description: "Wireless split mechanical keyboard with Gateron brown tactile switches.",
    },
    {
      id: "prod-203",
      tenantId: "tenant-2",
      name: "Multi-Port USB-C Pro Dock",
      category: "Accessories",
      sku: "MPC-DCK-23",
      price: 79.99,
      stock: 40,
      description: "11-in-1 space gray desktop docking station supporting dual 4K monitors.",
    },
    {
      id: "prod-301",
      tenantId: "tenant-3",
      name: "Minimalist Linen Overshirt",
      category: "Men",
      sku: "MNM-LN-11",
      price: 65.00,
      stock: 25,
      description: "Lightweight, breathable 100% Belgian linen overshirt in oatmeal.",
    },
    {
      id: "prod-302",
      tenantId: "tenant-3",
      name: "Silk Slip Dress",
      category: "Women",
      sku: "SLK-DRS-12",
      price: 110.00,
      stock: 18,
      description: "Premium mulberry silk maxi slip dress with elegant cowl neckline.",
    }
  ];

  constructor(@Inject(DatabaseService) private readonly dbService: DatabaseService) {}

  async onModuleInit() {
    await this.seedIfNeeded();
  }

  private async seedIfNeeded() {
    const client = this.dbService?.client;
    if (!client) return;

    try {
      const count = await client.product.count();
      if (count > 0) return;

      console.log("🌱 [ProductsModule] Seeding products into database...");
      for (const p of this.memoryProducts) {
        await client.product.create({
          data: {
            id: p.id,
            tenantId: p.tenantId,
            name: p.name,
            category: p.category,
            sku: p.sku,
            price: p.price,
            stock: p.stock,
            description: p.description,
          },
        });
      }
      console.log("✅ [ProductsModule] Product seeding complete.");
    } catch (err: any) {
      console.warn("⚠️ [ProductsModule] Seeding check failed:", err.message);
    }
  }

  async findAll(): Promise<Product[]> {
    if (this.dbService.client) {
      try {
        return await this.dbService.client.product.findMany();
      } catch (err: any) {
        console.error("Failed to query products from the local database, falling back:", err.message);
      }
    }
    return this.memoryProducts;
  }

  async create(body: Partial<Product>): Promise<Product> {
    const id = body.id || `prod-${Date.now()}`;
    const newProd: Product = {
      id,
      tenantId: body.tenantId || "tenant-1",
      name: body.name || "New Product",
      category: body.category || "General",
      sku: body.sku || `SKU-${Date.now()}`,
      price: parseFloat(body.price as any) || 0,
      stock: parseInt(body.stock as any) || 0,
      description: body.description || ""
    };

    if (this.dbService.client) {
      try {
        return await this.dbService.client.product.create({
          data: {
            id: newProd.id,
            tenantId: newProd.tenantId,
            name: newProd.name,
            category: newProd.category,
            sku: newProd.sku,
            price: newProd.price,
            stock: newProd.stock,
            description: newProd.description
          }
        });
      } catch (err: any) {
        console.error("Failed to insert product to the local database, fallback to memory:", err.message);
      }
    }

    this.memoryProducts.push(newProd);
    return newProd;
  }

  async update(id: string, body: Partial<Product>): Promise<Product | { error: string }> {
    if (this.dbService.client) {
      try {
        return await this.dbService.client.product.update({
          where: { id },
          data: {
            name: body.name,
            category: body.category,
            price: body.price !== undefined ? parseFloat(body.price as any) : undefined,
            stock: body.stock !== undefined ? parseInt(body.stock as any) : undefined,
            description: body.description
          }
        });
      } catch (err: any) {
        console.error("Failed to update product in the local database, fallback to memory:", err.message);
      }
    }

    const idx = this.memoryProducts.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.memoryProducts[idx] = {
        ...this.memoryProducts[idx],
        name: body.name !== undefined ? body.name : this.memoryProducts[idx].name,
        category: body.category !== undefined ? body.category : this.memoryProducts[idx].category,
        price: body.price !== undefined ? parseFloat(body.price as any) : this.memoryProducts[idx].price,
        stock: body.stock !== undefined ? parseInt(body.stock as any) : this.memoryProducts[idx].stock,
        description: body.description !== undefined ? body.description : this.memoryProducts[idx].description
      };
      return this.memoryProducts[idx];
    }
    return { error: "Not found" };
  }

  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    if (this.dbService.client) {
      try {
        await this.dbService.client.product.delete({
          where: { id }
        });
        return { success: true };
      } catch (err: any) {
        console.error("Failed to delete product in the local database, fallback to memory:", err.message);
      }
    }

    const idx = this.memoryProducts.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.memoryProducts.splice(idx, 1);
      return { success: true };
    }
    return { success: false, error: "Not found" };
  }

  async decrementStock(productId: string, quantity: number) {
    if (this.dbService.client) {
      try {
        await this.dbService.client.product.update({
          where: { id: productId },
          data: {
            stock: {
              decrement: quantity
            }
          }
        });
        return;
      } catch (err: any) {
        console.warn(`Could not deduct stock in the local database for product ${productId}:`, err.message);
      }
    }

    const p = this.memoryProducts.find(product => product.id === productId);
    if (p) {
      p.stock = Math.max(0, p.stock - quantity);
    }
  }
}
