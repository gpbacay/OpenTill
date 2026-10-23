import { Inject, Injectable } from "@nestjs/common";
import { Subject } from "rxjs";
import { DatabaseService } from "../database/database.service";

export type Topic = "products" | "orders" | "suppliers" | "expenses" | "stock" | "columns" | "tenants" | "categories";

export interface ChangeEvent {
  tenantId: string;
  topic: Topic;
}

/**
 * Change feed. Feature services call emit() after a write. It goes to this process's live stream (SSE) and is
 * counted in the database, so other server instances and polling browsers can see it too.
 */
@Injectable()
export class RealtimeService {
  readonly changes = new Subject<ChangeEvent>();
  private readonly memory = new Map<string, number>();
  private readonly pending = new Set<Promise<void>>();

  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  emit(tenantId: string, topic: Topic) {
    this.changes.next({ tenantId, topic });
    const job = this.bump(tenantId, topic).finally(() => this.pending.delete(job));
    this.pending.add(job);
  }

  /** Resolves once every counter write started by emit() has landed. Serverless hosts call it before answering. */
  async idle() {
    await Promise.allSettled([...this.pending]);
  }

  private async bump(tenantId: string, topic: Topic) {
    const id = `${tenantId}:${topic}`;
    const client = this.db.client;
    if (!client) {
      this.memory.set(id, (this.memory.get(id) ?? 0) + 1);
      return;
    }
    try {
      await client.change.upsert({
        where: { id },
        create: { id, tenantId, topic, version: 1 },
        update: { version: { increment: 1 } },
      });
    } catch (err: any) {
      console.warn("Could not record a change:", err.message);
    }
  }

  /** { "<tenantId>:<topic>": counter } for the given stores. */
  async versions(tenantIds: string[]): Promise<Record<string, number>> {
    const client = this.db.client;
    if (!client) {
      return Object.fromEntries([...this.memory].filter(([id]) => tenantIds.some((tenant) => id.startsWith(`${tenant}:`))));
    }
    const rows = await client.change.findMany({ where: { tenantId: { in: tenantIds } } });
    return Object.fromEntries(rows.map((row) => [row.id, row.version]));
  }
}
