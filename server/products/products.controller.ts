import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Inject,
} from "@nestjs/common";
import { ProductsService, Product } from "./products.service";

@Controller("api/products")
export class ProductsController {
  constructor(
    @Inject(ProductsService) private readonly productsService: ProductsService
  ) {}

  @Get()
  async getProducts(): Promise<Product[]> {
    return this.productsService.findAll();
  }

  @Post()
  async createProduct(@Body() body: Partial<Product>): Promise<Product> {
    return this.productsService.create(body);
  }

  @Put(":id")
  async updateProduct(
    @Param("id") id: string,
    @Body() body: Partial<Product>
  ): Promise<Product | { error: string }> {
    return this.productsService.update(id, body);
  }

  @Delete(":id")
  async deleteProduct(
    @Param("id") id: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.productsService.delete(id);
  }
}
