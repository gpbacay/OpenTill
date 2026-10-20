import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { encodeCustom, parseCustom } from "../common/custom-fields";
import { TenantStore } from "../common/tenant-store";
import { DatabaseService } from "../database/database.service";
import { RealtimeService } from "../realtime/realtime.service";
import { TenantsService } from "../tenants/tenants.service";

export interface Expense {
  id: string;
  tenantId: string;
  date: string | Date;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  supplierId: string | null;
  custom: Record<string, string>;
  createdAt: string | Date;
}

@Injectable()
export class ExpensesService extends TenantStore<Expense> {
  protected readonly topic = "expenses" as const;

  constructor(
    @Inject(DatabaseService) db: DatabaseService,
    @Inject(TenantsService) tenants: TenantsService,
    @Inject(RealtimeService) realtime: RealtimeService
  ) {
    super(db, tenants, realtime);
  }

  protected table(client: PrismaClient) {
    return client.expense;
  }

  protected build(body: any): Expense {
    const date = new Date(body.date);
    return {
      id: body.id,
      tenantId: body.tenantId,
      date: Number.isNaN(date.getTime()) ? new Date() : date,
      category: String(body.category ?? "").trim() || "Other",
      description: String(body.description ?? "").trim(),
      amount: Math.max(0, parseFloat(body.amount) || 0),
      paymentMethod: ["CASH", "CARD", "MOBILE_WALLET"].includes(body.paymentMethod) ? body.paymentMethod : "CASH",
      supplierId: body.supplierId || null,
      custom: parseCustom(body.custom),
      createdAt: body.createdAt ? new Date(body.createdAt) : new Date(),
    };
  }

  protected toDb(record: Expense) {
    return { ...record, custom: encodeCustom(record.custom) };
  }

  protected fromDb(row: any): Expense {
    return { ...row, custom: parseCustom(row.custom) };
  }
}
