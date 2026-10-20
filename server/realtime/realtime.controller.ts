import { Controller, Inject, MessageEvent, Req, Sse } from "@nestjs/common";
import { Observable, filter, interval, map, merge, mergeMap } from "rxjs";
import type { AuthedRequest } from "../auth/auth.guard";
import { TenantsService } from "../tenants/tenants.service";
import { RealtimeService } from "./realtime.service";

@Controller("api/events")
export class RealtimeController {
  constructor(
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
    @Inject(TenantsService) private readonly tenants: TenantsService
  ) {}

  // Clients only see changes to stores they own. The heartbeat keeps proxies from closing an idle stream.
  @Sse()
  stream(@Req() req: AuthedRequest): Observable<MessageEvent> {
    const userId = req.user!.id;
    const changes = this.realtime.changes.pipe(
      mergeMap(async (event) => ((await this.tenants.owns(userId, event.tenantId)) ? event : null)),
      filter((event) => event !== null),
      map((event) => ({ data: event }))
    );
    const heartbeat = interval(25_000).pipe(map(() => ({ data: { topic: "ping" } })));
    return merge(changes, heartbeat);
  }
}
