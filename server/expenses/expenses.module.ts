import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { TenantsModule } from "../tenants/tenants.module";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";

@Module({
  imports: [TenantsModule, RealtimeModule],
  providers: [ExpensesService],
  controllers: [ExpensesController],
  exports: [ExpensesService],
})
export class ExpensesModule {}
