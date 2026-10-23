import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req } from "@nestjs/common";
import type { AuthedRequest } from "../auth/auth.guard";
import { CashiersService } from "./cashiers.service";
import type { CashierInput } from "./cashiers.service";

// Admin-only: the auth guard keeps cashier accounts out of everything except the register endpoints.
@Controller("api/cashiers")
export class CashiersController {
  constructor(@Inject(CashiersService) private readonly cashiers: CashiersService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.cashiers.list(req.user!.id);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() body: CashierInput) {
    return this.cashiers.create(req.user!.id, body);
  }

  @Post(":id/invite")
  invite(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.cashiers.invite(req.user!.id, id);
  }

  @Post(":id/reset-link")
  resetLink(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.cashiers.resetLink(req.user!.id, id);
  }

  @Patch(":id")
  update(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: CashierInput) {
    return this.cashiers.update(req.user!.id, id, body);
  }

  @Delete(":id")
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.cashiers.remove(req.user!.id, id);
  }
}
