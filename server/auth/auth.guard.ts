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

const IS_PUBLIC = "isPublic";

export const Public = () => SetMetadata(IS_PUBLIC, true);

export interface AuthedRequest {
  headers: { cookie?: string };
  method: string;
  originalUrl: string;
  user?: AuthUser;
}

// Cashiers can only ring up sales: read their store and its products, post orders, and edit their own account.
// Everything not listed here is admin-only, so new endpoints are closed to cashiers by default.
const CASHIER_ROUTES: [method: string, path: RegExp][] = [
  ["GET", /^\/api\/(auth\/me|tenants|products|events)$/],
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
        throw new ForbiddenException("Cashier accounts can only use the register.");
      }
    }
    return true;
  }
}
