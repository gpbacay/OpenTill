import { Body, Controller, Get, Inject, Param, Put, Req } from "@nestjs/common";
import type { AuthedRequest } from "../auth/auth.guard";
import { InventoryService } from "./inventory.service";

@Controller("api/stock-movements")
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly inventory: InventoryService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.inventory.findAll(req.user!.id);
  }

  @Put(":id")
  record(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.inventory.record(req.user!.id, id, body);
  }
}
