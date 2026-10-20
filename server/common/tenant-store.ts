import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import type { DatabaseService } from "../database/database.service";
import type { RealtimeService, Topic } from "../realtime/realtime.service";
import type { TenantsService } from "../tenants/tenants.service";

/**
 * Shared CRUD for records that belong to a store: ownership checks, SQLite via Prisma with an
 * in-memory fallback when the database is unreachable, and a realtime notification after each write.
 * Subclasses only say which table they use and how to validate a request body.
 */
export abstract class TenantStore<T extends { id: string; tenantId: string }> {
  protected memory: T[] = [];
  protected abstract readonly topic: Topic;
  protected abstract table(client: PrismaClient): any;
  protected abstract build(body: any): T;
  /** Map between the API shape and the stored row (e.g. JSON-encode custom fields). Identity by default. */
  protected toDb(record: T): any {
    return record;
  }
  protected fromDb(row: any): T {
    return row;
  }

  constructor(
    protected readonly dbService: DatabaseService,
    protected readonly tenants: TenantsService,
    protected readonly realtime: RealtimeService
  ) {}

  private async find(id: string): Promise<T | null> {
    if (this.dbService.client) {
      try {
        const row = await this.table(this.dbService.client).findUnique({ where: { id } });
        return row ? this.fromDb(row) : null;
      } catch (err: any) {
        console.error(`Failed to load ${this.topic} record, falling back:`, err.message);
      }
    }
    return this.memory.find((row) => row.id === id) ?? null;
  }

  async findAll(userId: string): Promise<T[]> {
    const owned = await this.tenants.ownedIds(userId);
    if (owned.size === 0) return [];
    if (this.dbService.client) {
      try {
        const rows = await this.table(this.dbService.client).findMany({
          where: { tenantId: { in: [...owned] } },
        });
        return rows.map((row: any) => this.fromDb(row));
      } catch (err: any) {
        console.error(`Failed to query ${this.topic}, falling back:`, err.message);
      }
    }
    return this.memory.filter((row) => owned.has(row.tenantId));
  }

  /** Create-or-replace by id, so an offline client can replay the same write safely. */
  async upsert(userId: string, id: string, body: any): Promise<T> {
    const owned = await this.tenants.ownedIds(userId);
    const existing = await this.find(id);
    if (!body?.tenantId || !owned.has(body.tenantId) || (existing && !owned.has(existing.tenantId))) {
      throw new ForbiddenException("You do not have access to this store.");
    }
    const record = this.build({ ...body, id });

    let saved = false;
    if (this.dbService.client) {
      try {
        const row = this.toDb(record);
        await this.table(this.dbService.client).upsert({ where: { id }, create: row, update: row });
        saved = true;
      } catch (err: any) {
        console.error(`Failed to save ${this.topic} record, falling back to memory:`, err.message);
      }
    }
    if (!saved) {
      const idx = this.memory.findIndex((row) => row.id === id);
      if (idx === -1) this.memory.push(record);
      else this.memory[idx] = record;
    }
    this.realtime.emit(record.tenantId, this.topic);
    return record;
  }

  async remove(userId: string, id: string): Promise<{ success: boolean }> {
    const existing = await this.find(id);
    if (!existing) throw new NotFoundException("Record not found.");
    if (!(await this.tenants.owns(userId, existing.tenantId))) {
      throw new ForbiddenException("You do not have access to this store.");
    }
    let removed = false;
    if (this.dbService.client) {
      try {
        await this.table(this.dbService.client).delete({ where: { id } });
        removed = true;
      } catch (err: any) {
        console.error(`Failed to delete ${this.topic} record, falling back to memory:`, err.message);
      }
    }
    if (!removed) this.memory = this.memory.filter((row) => row.id !== id);
    this.realtime.emit(existing.tenantId, this.topic);
    return { success: true };
  }
}
