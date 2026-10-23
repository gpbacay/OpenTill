import { Module } from "@nestjs/common";
import { RealtimeService } from "./realtime.service";

/** The change feed itself. Feature modules import this; the endpoints that serve it live in EventsModule. */
@Module({
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
