import { Module } from "@nestjs/common";
import { TenantsModule } from "../tenants/tenants.module";
import { CashiersController } from "./cashiers.controller";
import { CashiersService } from "./cashiers.service";

@Module({
  imports: [TenantsModule],
  providers: [CashiersService],
  controllers: [CashiersController],
})
export class CashiersModule {}
