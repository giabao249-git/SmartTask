import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { REFRESH_COOKIE } from '../config/constants';
import type { Env } from '../config/env.schema';
import { AuthService } from './auth.service';
import type { AuthUserView, TokenPair } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản (UC-01)' })
  @ApiResponse({
    status: 201,
    description: 'user + accessToken; refresh token trong cookie httpOnly',
  })
  async register(
    @Body() dto: RegisterDto,
    @Headers('user-agent') ua: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthUserView; accessToken: string }> {
    const { user, tokens } = await this.auth.register(dto, ua);
    this.setRefreshCookie(res, tokens);
    return { user, accessToken: tokens.accessToken };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng nhập (UC-02) — 10 lần/phút/IP' })
  async login(
    @Body() dto: LoginDto,
    @Headers('user-agent') ua: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthUserView; accessToken: string }> {
    const { user, tokens } = await this.auth.login(dto, ua);
    this.setRefreshCookie(res, tokens);
    return { user, accessToken: tokens.accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({
    summary: 'Làm mới access token bằng cookie rt (xoay vòng refresh token)',
  })
  async refresh(
    @Req() req: Request,
    @Headers('user-agent') ua: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const tokens = await this.auth.refresh(this.readRefreshCookie(req), ua);
    this.setRefreshCookie(res, tokens);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Đăng xuất: thu hồi refresh token, xoá cookie' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(this.readRefreshCookie(req));
    res.clearCookie(REFRESH_COOKIE, { path: this.cookiePath() });
  }

  private readRefreshCookie(req: Request): string | undefined {
    // @types/express khai cookies là any; ép về unknown trước khi kiểm tra kiểu.
    const cookies = (req as unknown as { cookies?: Record<string, unknown> })
      .cookies;
    const value: unknown = cookies?.[REFRESH_COOKIE];
    return typeof value === 'string' ? value : undefined;
  }

  private setRefreshCookie(res: Response, tokens: TokenPair): void {
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      path: this.cookiePath(),
      expires: tokens.refreshExpiresAt,
    });
  }

  /** Cookie chỉ gửi kèm các route /auth/* — không đi theo mọi request. */
  private cookiePath(): string {
    return '/api/v1/auth';
  }
}
