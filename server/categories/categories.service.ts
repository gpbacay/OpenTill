import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { TenantStore } from "../common/tenant-store";
import { DatabaseService } from "../database/database.service";
import { RealtimeService } from "../realtime/realtime.service";
import { TenantsService } from "../tenants/tenants.service";

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string | Date;
}

@Injectable()
export class CategoriesService extends TenantStore<Category> {
  protected readonly topic = "categories" as const;

  constructor(
    @Inject(DatabaseService) db: DatabaseService,
    @Inject(TenantsService) tenants: TenantsService,
    @Inject(RealtimeService) realtime: RealtimeService
  ) {
    super(db, tenants, realtime);
  }

  protected table(client: PrismaClient) {
    return client.category;
  }

  protected build(body: any): Category {
    return {
      id: body.id,
      tenantId: body.tenantId,
      name: String(body.name ?? "").trim().slice(0, 40) || "Untitled",
      createdAt: body.createdAt ? new Date(body.createdAt) : new Date(),
    };
  }

  /** Products store the category's name, so renaming a category renames it on the store's products too. */
  protected async afterSave(previous: Category | null, record: Category) {
    const client = this.dbService.client;
    if (!client || !previous || previous.name === record.name) return;
    await client.product.updateMany({ where: { tenantId: record.tenantId, category: previous.name }, data: { category: record.name } });
    this.realtime.emit(record.tenantId, "products");
  }
}
