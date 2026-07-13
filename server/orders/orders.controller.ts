import { Controller, Get, Post, Body, Inject } from "@nestjs/common";
import { OrdersService } from "./orders.service";

@Controller("api/orders")
export class OrdersController {
  constructor(
    @Inject(OrdersService) private readonly ordersService: OrdersService
  ) {}

  @Get()
  async getOrders() {
    return this.ordersService.findAll();
  }

  @Post("sync")
  async syncOrders(@Body() body: { orders: any[]; items: any[] }) {
    return this.ordersService.sync(body.orders, body.items);
  }
}
