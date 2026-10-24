import {
  BadRequestException,
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
import { hashPassword, newInvite, requireName, requirePassword, requireUsername, verifyPassword } from "../auth/auth.service";
import { CASHIER_PAGES, cashierPages } from "../../lib/cashier-pages";

export interface Cashier {
  id: string;
  name: string;
  username: string;
  tenantId: string;
  createdAt: string;
  /** The sign-in link: does one exist, on how many devices has it been used, and how many may use it. */
  hasLink: boolean;
  linkUses: number;
  linkMaxUses: number;
  /** The pages this cashier may open besides the Register and Account. */
  pages: string[];
  /** When the cashier last had the app open (ISO), or null if they never have. */
  lastSeenAt: string | null;
}

/** What creating or re-linking returns: the cashier plus the sign-in link token (shown once, only its hash is stored). */
export type CashierInvite = Cashier & { inviteToken: string };

export interface CashierInput {
  name?: string;
  username?: string;
  password?: string;
  /** The cashier's current password: required when an admin sets a new one. */
  currentPassword?: string;
  tenantId?: string;
  /** How many devices the sign-in link may sign in (1 to 20). */
  maxUses?: number;
  /** Pages from CASHIER_PAGES this cashier may open. Missing means the default ones on create, unchanged on edit. */
  pages?: string[];
}

const MAX_DEVICES = 20;
const withUses = { _count: { select: { inviteDevices: true } } } as const;

function requireMaxUses(value: unknown, fallback: number) {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_DEVICES) {
    throw new BadRequestException(`The link's devices must be a whole number from 1 to ${MAX_DEVICES}.`);
  }
  return value;
}

/** The stored form of a page list (JSON), after checking every entry is a page cashiers can be given. */
function requirePages(value: unknown) {
  if (!Array.isArray(value) || value.some((page) => !CASHIER_PAGES.some((p) => p.href === page))) {
    throw new BadRequestException("Pick pages from the list.");
  }
  return JSON.stringify([...new Set(value as string[])]);
}

function toCashier(row: {
  id: string;
  name: string;
  email: string;
  tenantId: string | null;
  createdAt: Date;
  inviteHash: string | null;
  inviteMaxUses: number;
  cashierPages: string | null;
  lastSeenAt: Date | null;
  _count: { inviteDevices: number };
}): Cashier {
  return {
    id: row.id,
    name: row.name,
    username: row.email,
    tenantId: row.tenantId ?? "",
    createdAt: row.createdAt.toISOString(),
    hasLink: row.inviteHash !== null,
    linkUses: row._count.inviteDevices,
    linkMaxUses: row.inviteMaxUses,
    pages: cashierPages(row.cashierPages ? JSON.parse(row.cashierPages) : null),
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
  };
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
      include: withUses,
    });
    return rows.map(toCashier);
  }

  /** The admin sets the password. The cashier also gets a sign-in link so they can start without typing it. */
  async create(adminId: string, body: CashierInput): Promise<CashierInvite> {
    const email = requireUsername(body.username);
    const name = body.name?.trim() ? requireName(body.name) : email;
    const passwordHash = await hashPassword(requirePassword(body.password));
    const maxUses = requireMaxUses(body.maxUses, 1);
    const tenantId = await this.requireStore(adminId, body.tenantId);
    await this.requireFreeUsername(email);
    const invite = newInvite();
    const row = await this.client.user.create({
      data: {
        id: randomBytes(16).toString("hex"),
        name,
        email,
        passwordHash,
        role: "CASHIER",
        tenantId,
        createdById: adminId,
        inviteHash: invite.hash,
        inviteMaxUses: maxUses,
        cashierPages: body.pages === undefined ? null : requirePages(body.pages),
      },
      include: withUses,
    });
    return { ...toCashier(row), inviteToken: invite.token };
  }

  /** Forget the devices that used the link and sign the cashier out everywhere (someone else may have got in first). */
  private async clearLinkUse(id: string) {
    await this.client.inviteDevice.deleteMany({ where: { userId: id } });
    await this.client.session.deleteMany({ where: { userId: id } });
  }

  /** A brand-new sign-in link. The old one stops working and its usage starts again from zero. */
  async invite(adminId: string, id: string): Promise<CashierInvite> {
    await this.mine(adminId, id);
    const invite = newInvite();
    await this.clearLinkUse(id);
    const row = await this.client.user.update({ where: { id }, data: { inviteHash: invite.hash }, include: withUses });
    return { ...toCashier(row), inviteToken: invite.token };
  }

  /** Same link, usage back to zero: the devices it remembered are forgotten and the cashier is signed out everywhere. */
  async resetLink(adminId: string, id: string): Promise<Cashier> {
    await this.mine(adminId, id);
    await this.clearLinkUse(id);
    return toCashier(await this.client.user.findUniqueOrThrow({ where: { id }, include: withUses }));
  }

  async update(adminId: string, id: string, body: CashierInput): Promise<Cashier> {
    const current = await this.mine(adminId, id);
    const email = body.username === undefined ? current.email : requireUsername(body.username);
    const data: Record<string, string | number> = {
      email,
      // A name that was just the username (the default) follows a username change.
      name: body.name !== undefined ? requireName(body.name) : current.name === current.email ? email : current.name,
    };
    if (email !== current.email) await this.requireFreeUsername(email, id);
    if (body.tenantId !== undefined) data.tenantId = await this.requireStore(adminId, body.tenantId);
    const resetPassword = typeof body.password === "string" && body.password.length > 0;
    if (resetPassword) {
      const known = typeof body.currentPassword === "string" && (await verifyPassword(body.currentPassword, current.passwordHash));
      if (!known) throw new BadRequestException("The cashier's current password is incorrect.");
      data.passwordHash = await hashPassword(requirePassword(body.password));
    }
    if (body.maxUses !== undefined) data.inviteMaxUses = requireMaxUses(body.maxUses, 1);
    // Takes effect on the cashier's next request: the API reads their pages fresh each time.
    if (body.pages !== undefined) data.cashierPages = requirePages(body.pages);
    const row = await this.client.user.update({ where: { id }, data, include: withUses });
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
