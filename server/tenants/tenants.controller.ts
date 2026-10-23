import { Controller, Get, Put, Delete, Body, Param, Inject, Req } from "@nestjs/common";
import type { AuthedRequest } from "../auth/auth.guard";
import { RealtimeService } from "../realtime/realtime.service";
import { TenantsService, Tenant } from "./tenants.service";

@Controller("api/tenants")
export class TenantsController {
  constructor(
    @Inject(TenantsService) private readonly tenantsService: TenantsService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService
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
    const saved = await this.tenantsService.save(req.user!.id, id, body);
    this.realtime.emit(id, "tenants"); // cashiers pick up a renamed store or a new tax rate
    return saved;
  }

  @Delete(":id")
  async removeTenant(@Req() req: AuthedRequest, @Param("id") id: string) {
    const result = await this.tenantsService.remove(req.user!.id, id);
    this.realtime.emit(id, "tenants");
    return result;
  }
}
