import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { TenantsModule } from "../tenants/tenants.module";
import { SuppliersController } from "./suppliers.controller";
import { SuppliersService } from "./suppliers.service";

@Module({
  imports: [TenantsModule, RealtimeModule],
  providers: [SuppliersService],
  controllers: [SuppliersController],
  exports: [SuppliersService],
})
export class SuppliersModule {}
