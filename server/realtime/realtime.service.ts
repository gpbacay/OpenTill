import { Injectable } from "@nestjs/common";
import { Subject } from "rxjs";

export type Topic = "products" | "orders" | "suppliers" | "expenses" | "stock" | "columns";

export interface ChangeEvent {
  tenantId: string;
  topic: Topic;
}

/** In-process change feed. Feature services call emit() after a write; the SSE controller fans it out. */
@Injectable()
export class RealtimeService {
  readonly changes = new Subject<ChangeEvent>();

  emit(tenantId: string, topic: Topic) {
    this.changes.next({ tenantId, topic });
  }
}
