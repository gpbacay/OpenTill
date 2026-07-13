import { Controller, Get, Post, Body, Inject } from "@nestjs/common";
import { TenantsService, Tenant } from "./tenants.service";

@Controller("api/tenants")
export class TenantsController {
  constructor(
    @Inject(TenantsService) private readonly tenantsService: TenantsService
  ) {}

  @Get()
  async getTenants(): Promise<Tenant[]> {
    return this.tenantsService.findAll();
  }

  @Post()
  async createTenant(@Body() body: Partial<Tenant>): Promise<Tenant> {
    return this.tenantsService.create(body);
  }
}
