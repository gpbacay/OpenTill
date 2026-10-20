import { Body, Delete, Get, Param, Put, Req } from "@nestjs/common";
import type { AuthedRequest } from "../auth/auth.guard";
import type { TenantStore } from "./tenant-store";

/** GET list, PUT /:id (create or replace), DELETE /:id over a TenantStore. */
export abstract class CrudController<T extends { id: string; tenantId: string }> {
  protected abstract readonly store: TenantStore<T>;

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.store.findAll(req.user!.id);
  }

  @Put(":id")
  save(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.store.upsert(req.user!.id, id, body);
  }

  @Delete(":id")
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.store.remove(req.user!.id, id);
  }
}
