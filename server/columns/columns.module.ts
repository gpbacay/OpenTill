import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { TenantsModule } from "../tenants/tenants.module";
import { ColumnsController } from "./columns.controller";
import { ColumnsService } from "./columns.service";

@Module({
  imports: [TenantsModule, RealtimeModule],
  providers: [ColumnsService],
  controllers: [ColumnsController],
  exports: [ColumnsService],
})
export class ColumnsModule {}
