import { Controller, Get, Post, Body, Inject, Req } from "@nestjs/common";
import type { AuthedRequest } from "../auth/auth.guard";
import { TenantsService, Tenant } from "./tenants.service";

@Controller("api/tenants")
export class TenantsController {
  constructor(
    @Inject(TenantsService) private readonly tenantsService: TenantsService
  ) {}

  @Get()
  async getTenants(@Req() req: AuthedRequest): Promise<Tenant[]> {
    return this.tenantsService.findAll(req.user!.id);
  }

  @Post()
  async createTenant(@Req() req: AuthedRequest, @Body() body: Partial<Tenant>): Promise<Tenant> {
    return this.tenantsService.create(req.user!.id, body);
  }
}
