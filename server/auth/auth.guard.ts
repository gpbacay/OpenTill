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

// Cashiers can read their store, its products (without costs, see ProductsController) and their own sales (see
// OrdersService), the latter only when their admin gave them a page that shows sales. Ringing a sale needs the
// Register page. Inventory and Expenses each open their own endpoints (PAGE_ROUTES) only when that page is on.
// Writes stay scoped to the cashier's store by the services' ownership checks. Settings and suppliers stay with
// the admin. Everything not listed here is admin-only, so new endpoints are closed to cashiers by default.
type Route = [method: string, path: RegExp];

const CASHIER_ROUTES: Route[] = [
  ["GET", /^\/api\/(auth\/me|tenants|products|events|changes|orders|columns)$/],
  ["PATCH", /^\/api\/auth\/account$/],
  ["POST", /^\/api\/orders\/[^/]+\/void$/],
];

const PAGE_ROUTES: Record<string, Route[]> = {
  "/orders": [["POST", /^\/api\/orders\/sync$/]],
  "/inventory": [
    ["POST", /^\/api\/products$/],
    ["PUT", /^\/api\/(products|stock-movements)\/[^/]+$/],
    ["DELETE", /^\/api\/products\/[^/]+$/],
    // Read-only: suppliers and categories are managed on admin pages.
    ["GET", /^\/api\/(stock-movements|suppliers|categories)$/],
  ],
  "/expenses": [
    ["PUT", /^\/api\/expenses\/[^/]+$/],
    ["DELETE", /^\/api\/expenses\/[^/]+$/],
    ["GET", /^\/api\/(expenses|suppliers)$/],
  ],
};

const cashierRoutes = (pages: string[] | null) => [...CASHIER_ROUTES, ...(pages ?? []).flatMap((page) => PAGE_ROUTES[page] ?? [])];

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
    if (user?.role === "CASHIER") await this.authService.touch(user);
    if (isPublic) return true;
    if (!user) throw new UnauthorizedException("Sign in required.");
    if (user.role === "CASHIER") {
      const path = req.originalUrl.split("?")[0].replace(/\/$/, "");
      if (!cashierRoutes(user.pages).some(([method, pattern]) => method === req.method && pattern.test(path))) {
        throw new ForbiddenException("Cashier accounts can't change this. Ask your admin.");
      }
      const salesApi =
        (req.method === "GET" && path === "/api/orders") ||
        (req.method === "POST" && /^\/api\/orders\/[^/]+\/void$/.test(path));
      if (salesApi && !user.pages?.some((page) => SALES_PAGES.includes(page))) {
        throw new ForbiddenException("Your admin hasn't given you a page that shows sales.");
      }
    }
    return true;
  }
}
