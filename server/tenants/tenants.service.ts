import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

export interface Tenant {
  id: string;
  name: string;
  businessType: string;
  taxRate: number;
  currency: string;
  createdAt: string;
  active: boolean;
}

interface StoredTenant extends Tenant {
  ownerId: string;
}

function toTenant(record: StoredTenant): Tenant {
  return {
    id: record.id,
    name: record.name,
    businessType: record.businessType,
    taxRate: record.taxRate,
    currency: record.currency,
    createdAt: record.createdAt,
    active: record.active,
  };
}

@Injectable()
export class TenantsService {
  private memoryTenants: StoredTenant[] = [];

  constructor(@Inject(DatabaseService) private readonly dbService: DatabaseService) {}

  /** Stores a user can work in: the ones an admin owns, or the one store a cashier belongs to. */
  private accessible(userId: string) {
    return { OR: [{ ownerId: userId }, { cashiers: { some: { id: userId } } }] };
  }

  async ownedIds(userId: string): Promise<Set<string>> {
    if (this.dbService.client) {
      try {
        const rows = await this.dbService.client.tenant.findMany({
          where: this.accessible(userId),
          select: { id: true },
        });
        return new Set(rows.map((row) => row.id));
      } catch (err: any) {
        console.error("Failed to query owned stores, falling back:", err.message);
      }
    }
    return new Set(
      this.memoryTenants.filter((tenant) => tenant.ownerId === userId).map((tenant) => tenant.id)
    );
  }

  async owns(userId: string, tenantId: string) {
    const ids = await this.ownedIds(userId);
    return ids.has(tenantId);
  }

  async findAll(userId: string): Promise<Tenant[]> {
    if (this.dbService.client) {
      try {
        const records = await this.dbService.client.tenant.findMany({
          where: this.accessible(userId),
          orderBy: { createdAt: "asc" },
        });
        return records.map((record) =>
          toTenant({
            id: record.id,
            ownerId: record.ownerId ?? userId,
            name: record.name,
            businessType: record.businessType,
            taxRate: record.taxRate,
            currency: record.currency,
            createdAt: record.createdAt.toISOString(),
            active: record.active,
          })
        );
      } catch (err: any) {
        console.error("Failed to query tenants from the local database, falling back:", err.message);
      }
    }
    return this.memoryTenants
      .filter((tenant) => tenant.ownerId === userId)
      .map((tenant) => toTenant(tenant));
  }

  /** Create-or-replace by id, so an offline client can replay the same write safely. */
  async save(userId: string, id: string, body: Partial<Tenant>): Promise<Tenant> {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new BadRequestException("Enter a store name.");
    if (name.length > 60) throw new BadRequestException("The store name must be 60 characters or fewer.");
    const taxRate = Math.min(1, Math.max(0, Number(body.taxRate) || 0));
    const data = {
      name,
      businessType: String(body.businessType || "Retail").slice(0, 60),
      taxRate,
      currency: String(body.currency || "PHP").slice(0, 8),
      active: body.active ?? true,
    };

    if (this.dbService.client) {
      try {
        const client = this.dbService.client;
        const existing = await client.tenant.findUnique({ where: { id } });
        if (existing && existing.ownerId !== userId) {
          throw new ForbiddenException("You do not have access to this store.");
        }
        const saved = await client.tenant.upsert({
          where: { id },
          create: { id, ownerId: userId, createdAt: new Date(body.createdAt ?? Date.now()), ...data },
          update: data,
        });
        return toTenant({ ...saved, ownerId: userId, createdAt: saved.createdAt.toISOString() });
      } catch (err: any) {
        if (err instanceof ForbiddenException) throw err;
        console.error("Failed to save tenant to the local database, fallback to memory:", err.message);
      }
    }

    const existing = this.memoryTenants.find((tenant) => tenant.id === id);
    if (existing && existing.ownerId !== userId) {
      throw new ForbiddenException("You do not have access to this store.");
    }
    const stored: StoredTenant = {
      id,
      ownerId: userId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      ...data,
    };
    this.memoryTenants = [...this.memoryTenants.filter((tenant) => tenant.id !== id), stored];
    return toTenant(stored);
  }

  /** Deletes the store with everything in it: products, sales, suppliers, expenses, stock history and cashier accounts. */
  async remove(userId: string, id: string): Promise<{ success: boolean }> {
    const client = this.dbService.client;
    if (client) {
      const tenant = await client.tenant.findUnique({ where: { id } });
      if (!tenant) throw new NotFoundException("Store not found.");
      if (tenant.ownerId !== userId) throw new ForbiddenException("You do not have access to this store.");
      // Cashier users go with the store through their foreign key; their sessions go with them.
      await client.$transaction([
        client.orderItem.deleteMany({ where: { order: { tenantId: id } } }),
        client.order.deleteMany({ where: { tenantId: id } }),
        client.product.deleteMany({ where: { tenantId: id } }),
        client.supplier.deleteMany({ where: { tenantId: id } }),
        client.expense.deleteMany({ where: { tenantId: id } }),
        client.stockMovement.deleteMany({ where: { tenantId: id } }),
        client.customColumn.deleteMany({ where: { tenantId: id } }),
        client.tenant.delete({ where: { id } }),
      ]);
      return { success: true };
    }
    // ponytail: the in-memory fallback only drops the store; other services' rows become unreachable, not erased.
    const tenant = this.memoryTenants.find((item) => item.id === id);
    if (!tenant) throw new NotFoundException("Store not found.");
    if (tenant.ownerId !== userId) throw new ForbiddenException("You do not have access to this store.");
    this.memoryTenants = this.memoryTenants.filter((item) => item.id !== id);
    return { success: true };
  }
}
