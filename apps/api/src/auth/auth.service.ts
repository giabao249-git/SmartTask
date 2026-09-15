import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { AppError } from '../common/app-error';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AccessPayload,
  AuthUserView,
  RefreshPayload,
  TokenPair,
} from './auth.types';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

const BCRYPT_COST = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async register(
    dto: RegisterDto,
    userAgent?: string,
  ): Promise<{ user: AuthUserView; tokens: TokenPair }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw AppError.conflict('EMAIL_TAKEN');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, fullName: dto.fullName.trim() },
    });
    const tokens = await this.issueTokens(user.id, user.email, userAgent);
    return { user: this.toView(user), tokens };
  }

  async login(
    dto: LoginDto,
    userAgent?: string,
  ): Promise<{ user: AuthUserView; tokens: TokenPair }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    // So sánh cả khi không có user để thời gian phản hồi không lộ email tồn tại hay không.
    const ok = user
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;
    if (!user || !ok)
      throw new AppError('INVALID_CREDENTIALS', HttpStatus.UNAUTHORIZED);
    if (!user.isActive)
      throw new AppError('ACCOUNT_LOCKED', HttpStatus.FORBIDDEN);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    const tokens = await this.issueTokens(user.id, user.email, userAgent);
    return { user: this.toView(user), tokens };
  }

  /** Xoay vòng: token cũ bị thu hồi, cấp cặp mới. Token đã thu hồi mà dùng lại → thu hồi cả chuỗi của user. */
  async refresh(
    refreshToken: string | undefined,
    userAgent?: string,
  ): Promise<TokenPair> {
    if (!refreshToken)
      throw new AppError('REFRESH_TOKEN_INVALID', HttpStatus.UNAUTHORIZED);

    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new AppError('REFRESH_TOKEN_INVALID', HttpStatus.UNAUTHORIZED);
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(refreshToken) },
      include: { user: true },
    });
    if (!stored || stored.userId !== payload.sub) {
      throw new AppError('REFRESH_TOKEN_INVALID', HttpStatus.UNAUTHORIZED);
    }
    if (stored.revokedAt) {
      // Dùng lại token đã xoay = có dấu hiệu bị đánh cắp → thu hồi toàn bộ phiên của user.
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new AppError('REFRESH_TOKEN_INVALID', HttpStatus.UNAUTHORIZED);
    }
    if (stored.expiresAt < new Date() || !stored.user.isActive) {
      throw new AppError('REFRESH_TOKEN_INVALID', HttpStatus.UNAUTHORIZED);
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.userId, stored.user.email, userAgent);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    userId: string,
    email: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const accessPayload: AccessPayload = { sub: userId, email };
    const refreshPayload: RefreshPayload = { sub: userId, jti: randomUUID() };
    const refreshDays = this.config.get('JWT_REFRESH_TTL_DAYS', {
      infer: true,
    });
    const refreshExpiresAt = new Date(
      Date.now() + refreshDays * 24 * 60 * 60 * 1000,
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: `${refreshDays}d`,
      }),
    ]);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(refreshToken),
        userAgent: userAgent?.slice(0, 200),
        expiresAt: refreshExpiresAt,
      },
    });
    return { accessToken, refreshToken, refreshExpiresAt };
  }

  /** Lưu hash, không lưu token thô — lộ DB không lộ phiên. */
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  toView(user: {
    id: string;
    email: string;
    fullName: string;
    shortName: string | null;
    avatarUrl: string | null;
    timezone: string;
  }): AuthUserView {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      shortName: user.shortName,
      avatarUrl: user.avatarUrl,
      timezone: user.timezone,
    };
  }
}
