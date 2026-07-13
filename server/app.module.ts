import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module";
import { TenantsModule } from "./tenants/tenants.module";
import { ProductsModule } from "./products/products.module";
import { OrdersModule } from "./orders/orders.module";

@Module({
  imports: [
    DatabaseModule,
    TenantsModule,
    ProductsModule,
    OrdersModule,
  ],
})
export class AppModule {}
