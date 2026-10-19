import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
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
}

@Injectable()
export class ProductsService {
  private memoryProducts: Product[] = [];

  constructor(
    @Inject(DatabaseService) private readonly dbService: DatabaseService,
    @Inject(TenantsService) private readonly tenantsService: TenantsService
  ) {}

  async getById(id: string): Promise<Product | null> {
    if (this.dbService.client) {
      try {
        return await this.dbService.client.product.findUnique({ where: { id } });
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
        return await this.dbService.client.product.findMany({
          where: { tenantId: { in: ids } },
        });
      } catch (err: any) {
        console.error("Failed to query products from the local database, falling back:", err.message);
      }
    }
    return this.memoryProducts.filter((product) => owned.has(product.tenantId));
  }

  async create(userId: string, body: Partial<Product>): Promise<Product> {
    if (!body.tenantId || !(await this.tenantsService.owns(userId, body.tenantId))) {
      throw new ForbiddenException("You do not have access to this store.");
    }
    const id = body.id || `prod-${Date.now()}`;
    const newProd: Product = {
      id,
      tenantId: body.tenantId,
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

  async update(userId: string, id: string, body: Partial<Product>): Promise<Product> {
    await this.requireOwned(userId, id);
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
    throw new NotFoundException("Product not found.");
  }

  async delete(userId: string, id: string): Promise<{ success: boolean }> {
    await this.requireOwned(userId, id);
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
    throw new NotFoundException("Product not found.");
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
