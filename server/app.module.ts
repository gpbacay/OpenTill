import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./auth/auth.module";
import { AuthGuard } from "./auth/auth.guard";
import { TenantsModule } from "./tenants/tenants.module";
import { CashiersModule } from "./cashiers/cashiers.module";
import { ProductsModule } from "./products/products.module";
import { OrdersModule } from "./orders/orders.module";
import { InventoryModule } from "./inventory/inventory.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { ColumnsModule } from "./columns/columns.module";
import { RealtimeModule } from "./realtime/realtime.module";

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    TenantsModule,
    CashiersModule,
    ProductsModule,
    OrdersModule,
    InventoryModule,
    SuppliersModule,
    ExpensesModule,
    ColumnsModule,
    RealtimeModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
