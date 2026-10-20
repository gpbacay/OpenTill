import { Module } from "@nestjs/common";
import { ProductsModule } from "../products/products.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { TenantsModule } from "../tenants/tenants.module";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";

@Module({
  imports: [ProductsModule, TenantsModule, RealtimeModule],
  providers: [InventoryService],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}
