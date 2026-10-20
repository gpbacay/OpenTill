import { Controller, Inject } from "@nestjs/common";
import { CrudController } from "../common/crud.controller";
import { Supplier, SuppliersService } from "./suppliers.service";

@Controller("api/suppliers")
export class SuppliersController extends CrudController<Supplier> {
  constructor(@Inject(SuppliersService) protected readonly store: SuppliersService) {
    super();
  }
}
