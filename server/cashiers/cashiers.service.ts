import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { DatabaseService } from "../database/database.service";
import { TenantsService } from "../tenants/tenants.service";
import { hashPassword, requireName, requirePassword, requireUsername } from "../auth/auth.service";

export interface Cashier {
  id: string;
  name: string;
  username: string;
  tenantId: string;
  createdAt: string;
}

export interface CashierInput {
  name?: string;
  username?: string;
  password?: string;
  tenantId?: string;
}

function toCashier(row: { id: string; name: string; email: string; tenantId: string | null; createdAt: Date }): Cashier {
  return { id: row.id, name: row.name, username: row.email, tenantId: row.tenantId ?? "", createdAt: row.createdAt.toISOString() };
}

/** Cashier accounts an admin creates for their stores. Needs the database: the in-memory fallback has no cashier support. */
@Injectable()
export class CashiersService {
  constructor(
    @Inject(DatabaseService) private readonly dbService: DatabaseService,
    @Inject(TenantsService) private readonly tenants: TenantsService
  ) {}

  private get client() {
    if (!this.dbService.client) {
      throw new ServiceUnavailableException("Cashier accounts need the database, which is unavailable right now.");
    }
    return this.dbService.client;
  }

  private async mine(adminId: string, id: string) {
    const row = await this.client.user.findFirst({ where: { id, createdById: adminId, role: "CASHIER" } });
    if (!row) throw new NotFoundException("Cashier not found.");
    return row;
  }

  private async requireStore(adminId: string, tenantId: unknown) {
    if (typeof tenantId !== "string" || !(await this.tenants.owns(adminId, tenantId))) {
      throw new ForbiddenException("Pick one of your own stores for this cashier.");
    }
    return tenantId;
  }

  private async requireFreeUsername(email: string, exceptId?: string) {
    const taken = await this.client.user.findUnique({ where: { email } });
    if (taken && taken.id !== exceptId) throw new ConflictException("That username is already in use.");
  }

  async list(adminId: string): Promise<Cashier[]> {
    const rows = await this.client.user.findMany({
      where: { createdById: adminId, role: "CASHIER" },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toCashier);
  }

  async create(adminId: string, body: CashierInput): Promise<Cashier> {
    const email = requireUsername(body.username);
    const name = body.name?.trim() ? requireName(body.name) : email;
    const passwordHash = await hashPassword(requirePassword(body.password));
    const tenantId = await this.requireStore(adminId, body.tenantId);
    await this.requireFreeUsername(email);
    const row = await this.client.user.create({
      data: { id: randomBytes(16).toString("hex"), name, email, passwordHash, role: "CASHIER", tenantId, createdById: adminId },
    });
    return toCashier(row);
  }

  async update(adminId: string, id: string, body: CashierInput): Promise<Cashier> {
    const current = await this.mine(adminId, id);
    const email = body.username === undefined ? current.email : requireUsername(body.username);
    const data: Record<string, string> = {
      email,
      name: body.name === undefined ? current.name : requireName(body.name),
    };
    if (email !== current.email) await this.requireFreeUsername(email, id);
    if (body.tenantId !== undefined) data.tenantId = await this.requireStore(adminId, body.tenantId);
    const resetPassword = typeof body.password === "string" && body.password.length > 0;
    if (resetPassword) data.passwordHash = await hashPassword(requirePassword(body.password));
    const row = await this.client.user.update({ where: { id }, data });
    // A new password signs the cashier out of every device.
    if (resetPassword) await this.client.session.deleteMany({ where: { userId: id } });
    return toCashier(row);
  }

  async remove(adminId: string, id: string) {
    await this.mine(adminId, id);
    await this.client.user.delete({ where: { id } }); // sessions cascade
    return { success: true };
  }
}
