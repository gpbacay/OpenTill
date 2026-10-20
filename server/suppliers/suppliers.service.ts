import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { encodeCustom, parseCustom } from "../common/custom-fields";
import { TenantStore } from "../common/tenant-store";
import { DatabaseService } from "../database/database.service";
import { RealtimeService } from "../realtime/realtime.service";
import { TenantsService } from "../tenants/tenants.service";

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  active: boolean;
  custom: Record<string, string>;
  createdAt: string | Date;
}

const text = (value: unknown) => String(value ?? "").trim();

@Injectable()
export class SuppliersService extends TenantStore<Supplier> {
  protected readonly topic = "suppliers" as const;

  constructor(
    @Inject(DatabaseService) db: DatabaseService,
    @Inject(TenantsService) tenants: TenantsService,
    @Inject(RealtimeService) realtime: RealtimeService
  ) {
    super(db, tenants, realtime);
  }

  protected table(client: PrismaClient) {
    return client.supplier;
  }

  protected build(body: any): Supplier {
    return {
      id: body.id,
      tenantId: body.tenantId,
      name: text(body.name) || "Unnamed supplier",
      contactPerson: text(body.contactPerson),
      phone: text(body.phone),
      email: text(body.email),
      address: text(body.address),
      notes: text(body.notes),
      active: body.active !== false,
      custom: parseCustom(body.custom),
      createdAt: body.createdAt ? new Date(body.createdAt) : new Date(),
    };
  }

  protected toDb(record: Supplier) {
    return { ...record, custom: encodeCustom(record.custom) };
  }

  protected fromDb(row: any): Supplier {
    return { ...row, custom: parseCustom(row.custom) };
  }
}
