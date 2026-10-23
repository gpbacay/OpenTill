import { Module } from "@nestjs/common";
import { TenantsModule } from "../tenants/tenants.module";
import { ChangesController, RealtimeController } from "./realtime.controller";
import { RealtimeModule } from "./realtime.module";

@Module({
  imports: [TenantsModule, RealtimeModule],
  controllers: [RealtimeController, ChangesController],
})
export class EventsModule {}
