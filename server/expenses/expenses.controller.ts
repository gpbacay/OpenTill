import { Controller, Inject } from "@nestjs/common";
import { CrudController } from "../common/crud.controller";
import { Expense, ExpensesService } from "./expenses.service";

@Controller("api/expenses")
export class ExpensesController extends CrudController<Expense> {
  constructor(@Inject(ExpensesService) protected readonly store: ExpensesService) {
    super();
  }
}
