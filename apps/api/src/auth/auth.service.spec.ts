import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AppError } from '../common/app-error';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

/** Test đơn vị: Prisma và cấu hình được giả lập, JwtService thật (ký/verify với secret test). */
describe('AuthService', () => {
  let service: AuthService;
  let jwt: JwtService;
  const prisma = {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const env: Record<string, unknown> = {
    JWT_ACCESS_SECRET: 'access-secret-for-tests-0123456789',
    JWT_REFRESH_SECRET: 'refresh-secret-for-tests-0123456789',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL_DAYS: 7,
  };
  const user = {
    id: 'u1',
    email: 'lan@example.com',
    passwordHash: '',
    fullName: 'Lan',
    shortName: null,
    avatarUrl: null,
    timezone: 'Asia/Ho_Chi_Minh',
    isActive: true,
  };

  beforeAll(async () => {
    user.passwordHash = await bcrypt.hash('MatKhau@123', 4);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: (k: string) => env[k] } },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
    jwt = moduleRef.get(JwtService);
  });

  it('register: email trùng → EMAIL_TAKEN (409)', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(
      service.register({
        email: user.email,
        password: 'MatKhau@123',
        fullName: 'Lan',
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('register: tạo user, băm mật khẩu, cấp cặp token và lưu hash refresh', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(
      ({ data }: { data: { passwordHash: string } }) =>
        Promise.resolve({ ...user, passwordHash: data.passwordHash }),
    );
    prisma.refreshToken.create.mockResolvedValue({});
    const { tokens } = await service.register({
      email: user.email,
      password: 'MatKhau@123',
      fullName: 'Lan',
    });
    const created = prisma.user.create.mock.calls[0][0].data;
    expect(created.passwordHash).not.toEqual('MatKhau@123');
    expect(await bcrypt.compare('MatKhau@123', created.passwordHash)).toBe(
      true,
    );
    expect(tokens.accessToken).toBeTruthy();
    const stored = prisma.refreshToken.create.mock.calls[0][0].data;
    expect(stored.tokenHash).toHaveLength(64); // sha256 hex, không lưu token thô
    expect(stored.tokenHash).not.toEqual(tokens.refreshToken);
  });

  it('login: sai mật khẩu → INVALID_CREDENTIALS; đúng → cập nhật lastLoginAt', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(
      service.login({ email: user.email, password: 'sai' }),
    ).rejects.toBeInstanceOf(AppError);
    prisma.user.update.mockResolvedValue(user);
    prisma.refreshToken.create.mockResolvedValue({});
    const res = await service.login({
      email: user.email,
      password: 'MatKhau@123',
    });
    expect(res.user.email).toBe(user.email);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { lastLoginAt: expect.any(Date) } }),
    );
  });

  it('login: tài khoản khoá → ACCOUNT_LOCKED', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, isActive: false });
    await expect(
      service.login({ email: user.email, password: 'MatKhau@123' }),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
    });
  });

  it('refresh: token đã thu hồi bị dùng lại → thu hồi toàn bộ phiên của user', async () => {
    const token = await jwt.signAsync(
      { sub: 'u1', jti: 'j1' },
      { secret: env.JWT_REFRESH_SECRET as string },
    );
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      user,
    });
    await expect(service.refresh(token)).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_INVALID',
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('refresh: hợp lệ → thu hồi token cũ và cấp cặp mới', async () => {
    const token = await jwt.signAsync(
      { sub: 'u1', jti: 'j2' },
      { secret: env.JWT_REFRESH_SECRET as string },
    );
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'r2',
      userId: 'u1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 100_000),
      user,
    });
    prisma.refreshToken.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});
    const pair = await service.refresh(token);
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'r2' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(pair.refreshToken).not.toEqual(token);
  });

  it('refresh: thiếu cookie hoặc chữ ký sai → REFRESH_TOKEN_INVALID', async () => {
    await expect(service.refresh(undefined)).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_INVALID',
    });
    await expect(service.refresh('abc.def.ghi')).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_INVALID',
    });
  });
});
