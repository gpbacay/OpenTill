import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { AuthService, SESSION_MAX_AGE, deviceCookie, sessionCookie } from "./auth.service";
import type { AccountUpdate } from "./auth.service";
import { Public } from "./auth.guard";
import type { AuthedRequest } from "./auth.guard";

@Controller("api/auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  async register(
    @Body() body: {
      id?: string;
      name?: string;
      username?: string;
      password?: string;
      remember?: boolean;
    },
    @Res({ passthrough: true }) res: Response
  ) {
    const { user, token } = await this.authService.register(body);
    res.setHeader(
      "Set-Cookie",
      sessionCookie(token, body.remember === false ? undefined : SESSION_MAX_AGE)
    );
    return user;
  }

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(
    @Body() body: { username?: string; password?: string; remember?: boolean },
    @Res({ passthrough: true }) res: Response
  ) {
    const { user, token } = await this.authService.login(body);
    res.setHeader(
      "Set-Cookie",
      sessionCookie(token, body.remember === false ? undefined : SESSION_MAX_AGE)
    );
    return user;
  }

  @Public()
  @Get("invite/:token")
  invite(@Param("token") token: string, @Req() req: AuthedRequest) {
    return this.authService.inviteInfo(token, req.headers.cookie);
  }

  @Public()
  @Post("join")
  @HttpCode(200)
  async join(@Body() body: { token?: string; password?: string }, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const { user, token, device } = await this.authService.join(body, req.headers.cookie);
    res.setHeader("Set-Cookie", [sessionCookie(token, SESSION_MAX_AGE), deviceCookie(device)]);
    return user;
  }

  @Public()
  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.headers.cookie);
    res.setHeader("Set-Cookie", sessionCookie("", 0));
    return { ok: true };
  }

  @Get("me")
  me(@Req() req: AuthedRequest) {
    return req.user;
  }

  @Patch("account")
  update(@Req() req: AuthedRequest, @Body() body: AccountUpdate) {
    return this.authService.updateAccount(req.user!.id, body);
  }
}
