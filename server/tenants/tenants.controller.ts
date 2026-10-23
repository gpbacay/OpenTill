import { Controller, Get, Put, Delete, Body, Param, Inject, Req } from "@nestjs/common";
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

  @Put(":id")
  async saveTenant(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Partial<Tenant>
  ): Promise<Tenant> {
    return this.tenantsService.save(req.user!.id, id, body);
  }

  @Delete(":id")
  async removeTenant(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.tenantsService.remove(req.user!.id, id);
  }
}
