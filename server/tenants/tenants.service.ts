import { Inject, Injectable } from "@nestjs/common";
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

  async ownedIds(userId: string): Promise<Set<string>> {
    if (this.dbService.client) {
      try {
        const rows = await this.dbService.client.tenant.findMany({
          where: { ownerId: userId },
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
          where: { ownerId: userId },
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

  async create(userId: string, body: Partial<Tenant>): Promise<Tenant> {
    const stored: StoredTenant = {
      id: body.id || `tenant-${Date.now()}`,
      ownerId: userId,
      name: body.name || "Unnamed store",
      businessType: body.businessType || "Retail",
      taxRate: parseFloat(body.taxRate as any) || 0.12,
      currency: body.currency || "PHP",
      createdAt: new Date().toISOString(),
      active: true,
    };

    if (this.dbService.client) {
      try {
        const created = await this.dbService.client.tenant.create({
          data: {
            id: stored.id,
            ownerId: userId,
            name: stored.name,
            businessType: stored.businessType,
            taxRate: stored.taxRate,
            currency: stored.currency,
            createdAt: new Date(stored.createdAt),
            active: stored.active,
          },
        });
        return toTenant({
          ...stored,
          id: created.id,
          createdAt: created.createdAt.toISOString(),
        });
      } catch (err: any) {
        console.error("Failed to insert tenant to the local database, fallback to memory:", err.message);
      }
    }

    this.memoryTenants.push(stored);
    return toTenant(stored);
  }
}
