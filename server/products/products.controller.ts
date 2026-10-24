import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Inject,
  Req,
} from "@nestjs/common";
import type { AuthedRequest } from "../auth/auth.guard";
import { ProductsService, Product } from "./products.service";

@Controller("api/products")
export class ProductsController {
  constructor(
    @Inject(ProductsService) private readonly productsService: ProductsService
  ) {}

  // Cashiers don't see what the shop pays for stock or who supplies it, unless their admin gave them Inventory.
  @Get()
  async getProducts(@Req() req: AuthedRequest): Promise<Partial<Product>[]> {
    const products = await this.productsService.findAll(req.user!.id);
    if (req.user!.role !== "CASHIER" || req.user!.pages?.includes("/inventory")) return products;
    return products.map(({ costPrice: _cost, supplierId: _supplier, ...product }) => product);
  }

  @Post()
  async createProduct(
    @Req() req: AuthedRequest,
    @Body() body: Partial<Product>
  ): Promise<Product> {
    return this.productsService.create(req.user!.id, body);
  }

  @Put(":id")
  async updateProduct(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Partial<Product>
  ): Promise<Product> {
    return this.productsService.update(req.user!.id, id, body);
  }

  @Delete(":id")
  async deleteProduct(
    @Req() req: AuthedRequest,
    @Param("id") id: string
  ): Promise<{ success: boolean }> {
    return this.productsService.delete(req.user!.id, id);
  }
}
