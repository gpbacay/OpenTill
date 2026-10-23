import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { TenantsModule } from "../tenants/tenants.module";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";

@Module({
  imports: [TenantsModule, RealtimeModule],
  providers: [CategoriesService],
  controllers: [CategoriesController],
})
export class CategoriesModule {}
