import { Module } from "@nestjs/common";
import { TenantsModule } from "../tenants/tenants.module";
import { RealtimeController } from "./realtime.controller";
import { RealtimeService } from "./realtime.service";

@Module({
  imports: [TenantsModule],
  providers: [RealtimeService],
  controllers: [RealtimeController],
  exports: [RealtimeService],
})
export class RealtimeModule {}
