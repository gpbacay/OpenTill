import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { TenantStore } from "../common/tenant-store";
import { DatabaseService } from "../database/database.service";
import { RealtimeService } from "../realtime/realtime.service";
import { TenantsService } from "../tenants/tenants.service";

const TABLES = ["products", "suppliers", "expenses"];
const TYPES = ["text", "number", "date"];

export interface CustomColumn {
  id: string;
  tenantId: string;
  tableName: string;
  label: string;
  type: string;
  createdAt: string | Date;
}

@Injectable()
export class ColumnsService extends TenantStore<CustomColumn> {
  protected readonly topic = "columns" as const;

  constructor(
    @Inject(DatabaseService) db: DatabaseService,
    @Inject(TenantsService) tenants: TenantsService,
    @Inject(RealtimeService) realtime: RealtimeService
  ) {
    super(db, tenants, realtime);
  }

  protected table(client: PrismaClient) {
    return client.customColumn;
  }

  protected build(body: any): CustomColumn {
    return {
      id: body.id,
      tenantId: body.tenantId,
      tableName: TABLES.includes(body.tableName) ? body.tableName : "products",
      label: String(body.label ?? "").trim().slice(0, 40) || "Untitled",
      type: TYPES.includes(body.type) ? body.type : "text",
      createdAt: body.createdAt ? new Date(body.createdAt) : new Date(),
    };
  }
}
