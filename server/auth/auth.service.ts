import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { DatabaseService } from "../database/database.service";
import { cleanImage } from "../common/images";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
export const SESSION_COOKIE = "opentill_session";

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  avatar: string;
  role: Role;
  /** The store a cashier is limited to; null for admins. */
  tenantId: string | null;
}

export type Role = "ADMIN" | "CASHIER";

interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatar: string;
}

interface MemorySession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: number;
}

export interface AccountUpdate {
  name?: string;
  username?: string;
  currentPassword?: string;
  newPassword?: string;
  avatar?: string;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** A fresh cashier sign-in link: the token goes in the link, only its hash is stored. */
export function newInvite() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}

export const DEVICE_COOKIE = "opentill_device";

/** Marks a browser that used a cashier's link, so that browser can use it again but other devices count as new uses. */
export function deviceCookie(token: string) {
  return `${DEVICE_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=315360000`;
}

const BAD_LINK = "This link isn't valid any more. Ask your admin for a new one.";
const LINK_USED_UP = "This link was already used on the devices it allows. Ask your admin to reset it.";

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(hex, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function requireName(name: unknown) {
  if (typeof name !== "string" || !name.trim()) {
    throw new BadRequestException("Enter your name.");
  }
  return name.trim();
}

export function requireUsername(username: unknown) {
  if (typeof username !== "string" || !username.trim()) {
    throw new BadRequestException("Enter a username.");
  }
  return username.trim().toLowerCase();
}

function chooseId(requested: unknown) {
  if (typeof requested === "string" && /^[a-f0-9]{32}$/.test(requested)) return requested;
  return randomBytes(16).toString("hex");
}

export function requirePassword(password: unknown) {
  if (typeof password !== "string" || password.length < 8) {
    throw new BadRequestException("Password must be at least 8 characters.");
  }
  return password;
}

function readCookie(header: string | undefined, name: string) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function publicUser(user: {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  tenantId?: string | null;
}): AuthUser {
  return {
    id: user.id,
    name: user.name,
    username: user.email,
    avatar: user.avatar ?? "",
    role: user.role === "CASHIER" ? "CASHIER" : "ADMIN",
    tenantId: user.tenantId ?? null,
  };
}

@Injectable()
export class AuthService {
  private memoryUsers: StoredUser[] = [];
  private memorySessions: MemorySession[] = [];

  constructor(@Inject(DatabaseService) private readonly dbService: DatabaseService) {}

  async register(body: { id?: string; name?: string; username?: string; password?: string }) {
    const email = requireUsername(body.username);
    // Sign-up only asks for a username; the display name starts as the username and can be changed in Account.
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : email;
    const password = requirePassword(body.password);
    const passwordHash = await hashPassword(password);
    const id = chooseId(body.id);
    const client = this.dbService.client;

    if (client) {
      const existing = await client.user.findUnique({ where: { email } });
      if (existing) {
        throw new ConflictException("That username is already in use.");
      }
      try {
        const created = await client.user.create({
          data: { id, name, email, passwordHash },
        });
        await client.tenant.updateMany({
          where: { ownerId: null },
          data: { ownerId: created.id },
        });
        const token = await this.createSession(created.id);
        return { user: publicUser(created), token };
      } catch (err: any) {
        if (err?.code === "P2002") {
          throw new ConflictException("That username is already in use.");
        }
        throw err;
      }
    }

    if (this.memoryUsers.some((user) => user.email === email)) {
      throw new ConflictException("That username is already in use.");
    }
    const user = { id, name, email, passwordHash, avatar: "" };
    this.memoryUsers.push(user);
    const token = await this.createSession(id);
    return { user: publicUser(user), token };
  }

  private async pendingInvite(token: unknown, cookieHeader: string | undefined) {
    const client = this.dbService.client;
    if (!client) throw new ServiceUnavailableException("Sign-in links need the database, which is unavailable right now.");
    const row =
      typeof token === "string" && token
        ? await client.user.findUnique({ where: { inviteHash: hashToken(token) }, include: { store: true } })
        : null;
    if (!row || row.role !== "CASHIER") throw new NotFoundException(BAD_LINK);
    // This browser may already be one of the link's devices; if not, there has to be room for one more.
    const device = readCookie(cookieHeader, DEVICE_COOKIE);
    const known = device
      ? await client.inviteDevice.findUnique({ where: { userId_deviceHash: { userId: row.id, deviceHash: hashToken(device) } } })
      : null;
    if (!known && (await client.inviteDevice.count({ where: { userId: row.id } })) >= row.inviteMaxUses) {
      throw new ForbiddenException(LINK_USED_UP);
    }
    return { client, row, device: known ? device : null };
  }

  /** Who a sign-in link is for, so the page can greet them before they tap. */
  async inviteInfo(token: string, cookieHeader?: string) {
    const { row } = await this.pendingInvite(token, cookieHeader);
    return { username: row.email, store: row.store?.name ?? "" };
  }

  /**
   * The cashier opens their sign-in link and is signed in without typing the admin's password.
   * The first browsers to use it (up to the limit the admin set) are remembered and can use it again; others can't.
   */
  async join(body: { token?: string }, cookieHeader?: string) {
    const { client, row, device } = await this.pendingInvite(body.token, cookieHeader);
    let deviceToken = device;
    if (!deviceToken) {
      deviceToken = readCookie(cookieHeader, DEVICE_COOKIE) ?? randomBytes(24).toString("base64url");
      const mine = await client.inviteDevice.upsert({
        where: { userId_deviceHash: { userId: row.id, deviceHash: hashToken(deviceToken) } },
        create: { id: randomBytes(16).toString("hex"), userId: row.id, deviceHash: hashToken(deviceToken) },
        update: {},
      });
      // Two phones tapping at once could both pass the check above; whoever is over the limit now backs out.
      const used = await client.inviteDevice.findMany({ where: { userId: row.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: row.inviteMaxUses });
      if (!used.some((entry) => entry.id === mine.id)) {
        await client.inviteDevice.delete({ where: { id: mine.id } }).catch(() => undefined);
        throw new ForbiddenException(LINK_USED_UP);
      }
    }
    const token = await this.createSession(row.id);
    return { user: publicUser(row), token, device: deviceToken };
  }

  async login(body: { username?: string; password?: string }) {
    const email = requireUsername(body.username);
    const password = typeof body.password === "string" ? body.password : "";
    const client = this.dbService.client;
    const record = client
      ? await client.user.findUnique({ where: { email } })
      : this.memoryUsers.find((user) => user.email === email);
    if (!record || !(await verifyPassword(password, record.passwordHash))) {
      throw new UnauthorizedException("Username or password is incorrect.");
    }
    const token = await this.createSession(record.id);
    return { user: publicUser(record), token };
  }

  async logout(cookieHeader?: string) {
    const token = readCookie(cookieHeader, SESSION_COOKIE);
    if (!token) return;
    const tokenHash = hashToken(token);
    const client = this.dbService.client;
    if (client) {
      await client.session.deleteMany({ where: { tokenHash } });
      return;
    }
    this.memorySessions = this.memorySessions.filter((session) => session.tokenHash !== tokenHash);
  }

  async userFromCookie(cookieHeader?: string): Promise<AuthUser | null> {
    const token = readCookie(cookieHeader, SESSION_COOKIE);
    if (!token) return null;
    const tokenHash = hashToken(token);
    const client = this.dbService.client;

    if (client) {
      try {
        const session = await client.session.findUnique({
          where: { tokenHash },
          include: { user: true },
        });
        if (!session) return null;
        if (session.expiresAt.getTime() <= Date.now()) {
          await client.session.delete({ where: { id: session.id } }).catch(() => undefined);
          return null;
        }
        return publicUser(session.user);
      } catch (err: any) {
        console.error("Session lookup failed:", err.message);
        return null;
      }
    }

    const session = this.memorySessions.find((item) => item.tokenHash === tokenHash);
    if (!session || session.expiresAt <= Date.now()) return null;
    const user = this.memoryUsers.find((item) => item.id === session.userId);
    return user ? publicUser(user) : null;
  }

  async updateAccount(userId: string, body: AccountUpdate): Promise<AuthUser> {
    const client = this.dbService.client;
    const current = client
      ? await client.user.findUnique({ where: { id: userId } })
      : this.memoryUsers.find((user) => user.id === userId);
    if (!current) throw new UnauthorizedException("Sign in required.");

    const name = body.name === undefined ? current.name : requireName(body.name);
    const email = body.username === undefined ? current.email : requireUsername(body.username);
    const nextPassword =
      typeof body.newPassword === "string" && body.newPassword.length > 0
        ? requirePassword(body.newPassword)
        : null;
    const emailChanged = email !== current.email;
    // Cashier logins belong to the admin who made them: only an admin can change the username or password.
    if ("role" in current && current.role === "CASHIER" && (emailChanged || nextPassword)) {
      throw new ForbiddenException("Your admin manages your username and password. Ask them to change it.");
    }
    if (emailChanged || nextPassword) {
      const currentPassword =
        typeof body.currentPassword === "string" ? body.currentPassword : "";
      if (!(await verifyPassword(currentPassword, current.passwordHash))) {
        throw new UnauthorizedException("Current password is incorrect.");
      }
    }
    if (emailChanged) {
      const taken = client
        ? await client.user.findUnique({ where: { email } })
        : this.memoryUsers.find((user) => user.email === email);
      if (taken && taken.id !== userId) {
        throw new ConflictException("That username is already in use.");
      }
    }

    const passwordHash = nextPassword ? await hashPassword(nextPassword) : current.passwordHash;
    const avatar = body.avatar === undefined ? current.avatar : cleanImage(body.avatar);
    if (client) {
      const updated = await client.user.update({
        where: { id: userId },
        data: { name, email, passwordHash, avatar },
      });
      return publicUser(updated);
    }
    current.avatar = avatar;
    current.name = name;
    current.email = email;
    current.passwordHash = passwordHash;
    return publicUser(current);
  }

  private async createSession(userId: string) {
    const token = randomBytes(32).toString("hex");
    const id = randomBytes(16).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_MS);
    const client = this.dbService.client;
    if (client) {
      await client.session.create({ data: { id, userId, tokenHash, expiresAt } });
      return token;
    }
    this.memorySessions.push({ id, userId, tokenHash, expiresAt: expiresAt.getTime() });
    return token;
  }
}

export function sessionCookie(token: string, maxAge?: number) {
  const value = encodeURIComponent(token);
  const lifetime = maxAge === undefined ? "" : `; Max-Age=${maxAge}`;
  return `${SESSION_COOKIE}=${value}; HttpOnly; Path=/; SameSite=Lax${lifetime}`;
}
