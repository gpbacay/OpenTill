import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService, AuthUser } from "./auth.service";
import { SALES_PAGES } from "../../lib/cashier-pages";

const IS_PUBLIC = "isPublic";

export const Public = () => SetMetadata(IS_PUBLIC, true);

export interface AuthedRequest {
  headers: { cookie?: string };
  method: string;
  originalUrl: string;
  user?: AuthUser;
}

// Cashiers ring up sales and can read their store, its products (without costs, see ProductsController) and their
// own sales (see OrdersService), the latter only when their admin gave them a page that shows sales.
// Expenses, suppliers, the stock ledger and settings stay with the admin. Everything not listed here is admin-only,
// so new endpoints are closed to cashiers by default.
const CASHIER_ROUTES: [method: string, path: RegExp][] = [
  ["GET", /^\/api\/(auth\/me|tenants|products|events|changes|orders)$/],
  ["PATCH", /^\/api\/auth\/account$/],
  ["POST", /^\/api\/orders\/sync$/],
];

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const user = await this.authService.userFromCookie(req.headers.cookie);
    if (user) req.user = user;
    if (isPublic) return true;
    if (!user) throw new UnauthorizedException("Sign in required.");
    if (user.role === "CASHIER") {
      const path = req.originalUrl.split("?")[0].replace(/\/$/, "");
      if (!CASHIER_ROUTES.some(([method, pattern]) => method === req.method && pattern.test(path))) {
        throw new ForbiddenException("Cashier accounts can't change this. Ask your admin.");
      }
      if (req.method === "GET" && path === "/api/orders" && !user.pages?.some((page) => SALES_PAGES.includes(page))) {
        throw new ForbiddenException("Your admin hasn't given you a page that shows sales.");
      }
    }
    return true;
  }
}
