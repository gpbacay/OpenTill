import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { ProductsModule } from "../products/products.module";
import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";

@Module({
  imports: [DatabaseModule, ProductsModule],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
