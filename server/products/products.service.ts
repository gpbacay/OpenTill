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
      name: "Brake Shoe Set, Honda Wave",
      category: "Brakes",
      sku: "BRK-WAV-01",
      price: 350,
      stock: 40,
      description: "Front and rear brake shoes for Honda Wave 110 and 125.",
    },
    {
      id: "prod-102",
      tenantId: "tenant-1",
      name: "Drive Belt, Yamaha Mio",
      category: "Drive",
      sku: "DRV-MIO-02",
      price: 280,
      stock: 55,
      description: "Drive belt for Yamaha Mio and Soul scooters.",
    },
    {
      id: "prod-103",
      tenantId: "tenant-1",
      name: "NGK Spark Plug CPR8EA-9",
      category: "Ignition",
      sku: "IGN-NGK-03",
      price: 185,
      stock: 80,
      description: "Resistor spark plug for underbone motorcycles.",
    },
    {
      id: "prod-104",
      tenantId: "tenant-1",
      name: "Motul 5100 10W-40 1L",
      category: "Lubricants",
      sku: "OIL-MT5-04",
      price: 520,
      stock: 36,
      description: "Semi-synthetic motorcycle engine oil, 1 liter.",
    },
    {
      id: "prod-201",
      tenantId: "tenant-2",
      name: "Disc Brake Pad, Yamaha R15",
      category: "Brakes",
      sku: "BRK-R15-21",
      price: 890,
      stock: 18,
      description: "Front disc brake pads for Yamaha R15.",
    },
    {
      id: "prod-202",
      tenantId: "tenant-2",
      name: "LED Headlight Bulb H4",
      category: "Electrical",
      sku: "ELC-H4-22",
      price: 450,
      stock: 30,
      description: "H4 LED headlight bulb for motorcycle headlights.",
    },
    {
      id: "prod-203",
      tenantId: "tenant-2",
      name: "Handlebar Grip Pair",
      category: "Controls",
      sku: "GRP-UNI-23",
      price: 180,
      stock: 48,
      description: "Universal rubber handlebar grips, sold as a pair.",
    },
    {
      id: "prod-301",
      tenantId: "tenant-3",
      name: "Tubeless Tire 80/90-14",
      category: "Tires",
      sku: "TIR-8090-11",
      price: 1850,
      stock: 12,
      description: "Tubeless front tire for scooters, size 80/90-14.",
    },
    {
      id: "prod-302",
      tenantId: "tenant-3",
      name: "Inner Tube 2.50-17",
      category: "Tires",
      sku: "TUB-250-12",
      price: 220,
      stock: 40,
      description: "Butyl inner tube for 2.50-17 motorcycle wheels.",
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
