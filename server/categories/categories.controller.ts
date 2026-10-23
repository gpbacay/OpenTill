import { Controller, Inject } from "@nestjs/common";
import { CrudController } from "../common/crud.controller";
import { Category, CategoriesService } from "./categories.service";

@Controller("api/categories")
export class CategoriesController extends CrudController<Category> {
  constructor(@Inject(CategoriesService) protected readonly store: CategoriesService) {
    super();
  }
}
