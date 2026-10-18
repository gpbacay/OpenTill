import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
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

@Injectable()
export class TenantsService implements OnModuleInit {
  private memoryTenants: Tenant[] = [
    {
      id: "tenant-1",
      name: "Reyes Motor Parts",
      businessType: "Motorcycle Parts",
      taxRate: 0.12,
      currency: "PHP",
      createdAt: new Date().toISOString(),
      active: true,
    },
    {
      id: "tenant-2",
      name: "MotoLine Spare Parts",
      businessType: "Motorcycle Parts",
      taxRate: 0.12,
      currency: "PHP",
      createdAt: new Date().toISOString(),
      active: true,
    },
    {
      id: "tenant-3",
      name: "Barrio Cycle Supply",
      businessType: "Motorcycle Parts",
      taxRate: 0.12,
      currency: "PHP",
      createdAt: new Date().toISOString(),
      active: true,
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
      const tenantCount = await client.tenant.count();
      if (tenantCount > 0) return;

      console.log("🌱 [TenantsModule] Seeding tenants into database...");
      for (const t of this.memoryTenants) {
        await client.tenant.create({
          data: {
            id: t.id,
            name: t.name,
            businessType: t.businessType,
            taxRate: t.taxRate,
            currency: t.currency,
            createdAt: new Date(t.createdAt),
            active: t.active,
          },
        });
      }
      console.log("✅ [TenantsModule] Tenant seeding complete.");
    } catch (err: any) {
      console.warn("⚠️ [TenantsModule] Seeding check failed:", err.message);
    }
  }

  async findAll(): Promise<Tenant[]> {
    if (this.dbService.client) {
      try {
        const records = await this.dbService.client.tenant.findMany();
        return records.map(r => ({
          id: r.id,
          name: r.name,
          businessType: r.businessType,
          taxRate: r.taxRate,
          currency: r.currency,
          createdAt: r.createdAt.toISOString(),
          active: r.active
        }));
      } catch (err: any) {
        console.error("Failed to query tenants from the local database, falling back:", err.message);
      }
    }
    return this.memoryTenants;
  }

  async create(body: Partial<Tenant>): Promise<Tenant> {
    const id = body.id || `tenant-${Date.now()}`;
    const newTenant: Tenant = {
      id,
      name: body.name || "Unnamed Tenant",
      businessType: body.businessType || "Motorcycle Parts",
      taxRate: parseFloat(body.taxRate as any) || 0.12,
      currency: body.currency || "PHP",
      createdAt: new Date().toISOString(),
      active: true
    };

    if (this.dbService.client) {
      try {
        const created = await this.dbService.client.tenant.create({
          data: {
            id: newTenant.id,
            name: newTenant.name,
            businessType: newTenant.businessType,
            taxRate: newTenant.taxRate,
            currency: newTenant.currency,
            createdAt: new Date(newTenant.createdAt),
            active: newTenant.active
          }
        });
        return {
          id: created.id,
          name: created.name,
          businessType: created.businessType,
          taxRate: created.taxRate,
          currency: created.currency,
          createdAt: created.createdAt.toISOString(),
          active: created.active
        };
      } catch (err: any) {
        console.error("Failed to insert tenant to the local database, fallback to memory:", err.message);
      }
    }

    this.memoryTenants.push(newTenant);
    return newTenant;
  }
}
