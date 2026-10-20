import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { InventoryModule } from "../inventory/inventory.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { ProductsModule } from "../products/products.module";
import { TenantsModule } from "../tenants/tenants.module";
import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";

@Module({
  imports: [DatabaseModule, ProductsModule, TenantsModule, InventoryModule, RealtimeModule],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
