import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";
import type { AuthedRequest } from "../auth/auth.guard";
import { OrdersService } from "./orders.service";

@Controller("api/orders")
export class OrdersController {
  constructor(
    @Inject(OrdersService) private readonly ordersService: OrdersService
  ) {}

  @Get()
  async getOrders(@Req() req: AuthedRequest) {
    return this.ordersService.findAll(req.user!);
  }

  @Post(":id/void")
  async voidOrder(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { reason?: string }) {
    return this.ordersService.voidSale(req.user!, id, body?.reason);
  }

  @Post("sync")
  async syncOrders(
    @Req() req: AuthedRequest,
    @Body() body: { orders: any[]; items: any[] }
  ) {
    return this.ordersService.sync(req.user!, body.orders, body.items);
  }
}
