import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { DatabaseService } from "../database/database.service";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
export const SESSION_COOKIE = "opentill_session";

export interface AuthUser {
  id: string;
  name: string;
  username: string;
}

interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
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
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function hashPassword(password: string) {
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

function requireName(name: unknown) {
  if (typeof name !== "string" || !name.trim()) {
    throw new BadRequestException("Enter your name.");
  }
  return name.trim();
}

function requireUsername(username: unknown) {
  if (typeof username !== "string" || !username.trim()) {
    throw new BadRequestException("Enter a username.");
  }
  return username.trim().toLowerCase();
}

function chooseId(requested: unknown) {
  if (typeof requested === "string" && /^[a-f0-9]{32}$/.test(requested)) return requested;
  return randomBytes(16).toString("hex");
}

function requirePassword(password: unknown) {
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

function publicUser(user: { id: string; name: string; email: string }): AuthUser {
  return { id: user.id, name: user.name, username: user.email };
}

@Injectable()
export class AuthService {
  private memoryUsers: StoredUser[] = [];
  private memorySessions: MemorySession[] = [];

  constructor(@Inject(DatabaseService) private readonly dbService: DatabaseService) {}

  async register(body: { id?: string; name?: string; username?: string; password?: string }) {
    const name = requireName(body.name);
    const email = requireUsername(body.username);
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
    const user = { id, name, email, passwordHash };
    this.memoryUsers.push(user);
    const token = await this.createSession(id);
    return { user: publicUser(user), token };
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
    if (client) {
      const updated = await client.user.update({
        where: { id: userId },
        data: { name, email, passwordHash },
      });
      return publicUser(updated);
    }
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

export function sessionCookie(token: string, maxAge: number) {
  const value = encodeURIComponent(token);
  return `${SESSION_COOKIE}=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
}
