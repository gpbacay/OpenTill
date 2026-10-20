import { Controller, Inject } from "@nestjs/common";
import { CrudController } from "../common/crud.controller";
import { ColumnsService, CustomColumn } from "./columns.service";

@Controller("api/columns")
export class ColumnsController extends CrudController<CustomColumn> {
  constructor(@Inject(ColumnsService) protected readonly store: ColumnsService) {
    super();
  }
}
