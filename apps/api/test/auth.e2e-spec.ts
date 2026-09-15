import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, extractCookie, uniqueEmail } from './helpers';

describe('Auth & tài khoản (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = uniqueEmail('lan');
  const password = 'MatKhau@123';
  let accessToken = '';
  let rtCookie = '';

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@e2e.test' } },
    });
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('GET /health/ready → db ok', async () => {
    await api().get('/api/v1/health/ready').expect(200).expect({ db: 'ok' });
  });

  it('POST /auth/register → 201, có accessToken và cookie rt httpOnly', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ email, password, fullName: 'Nguyễn Thị Lan' })
      .expect(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.accessToken).toBeTruthy();
    const cookie = extractCookie(res, 'rt');
    expect(cookie).toBeTruthy();
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    accessToken = res.body.accessToken;
    rtCookie = cookie!;
  });

  it('POST /auth/register trùng email (khác hoa thường) → 409 EMAIL_TAKEN', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ email: email.toUpperCase(), password, fullName: 'Lan 2' })
      .expect(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('POST /auth/register thiếu trường → 400 VALIDATION_FAILED có details.fields', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ email: 'x', password: '1' })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.details.fields.length).toBeGreaterThan(0);
  });

  it('GET /me không token → 401 UNAUTHENTICATED', async () => {
    const res = await api().get('/api/v1/me').expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('GET /me có token → hồ sơ + workspaces rỗng', async () => {
    const res = await api()
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.user.email).toBe(email);
    expect(res.body.workspaces).toEqual([]);
  });

  it('POST /auth/login sai mật khẩu → 401 INVALID_CREDENTIALS', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: 'sai-roi' })
      .expect(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /auth/refresh xoay vòng: cookie cũ dùng lại → 401', async () => {
    const first = await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', rtCookie)
      .expect(200);
    expect(first.body.accessToken).toBeTruthy();
    const newCookie = extractCookie(first, 'rt')!;
    expect(newCookie).not.toEqual(rtCookie);

    await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', rtCookie)
      .expect(401);
    // Dùng lại token cũ → cả chuỗi bị thu hồi, cookie mới cũng chết
    await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', newCookie)
      .expect(401);
  });

  it('PATCH /me, PATCH /me/password, rồi mật khẩu cũ không đăng nhập được nữa', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const token = login.body.accessToken as string;

    const patched = await api()
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ shortName: 'Lan', timezone: 'Asia/Ho_Chi_Minh' })
      .expect(200);
    expect(patched.body.shortName).toBe('Lan');

    await api()
      .patch('/api/v1/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: password, newPassword: 'MatKhauMoi@456' })
      .expect(204);

    await api()
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(401);
    await api()
      .post('/api/v1/auth/login')
      .send({ email, password: 'MatKhauMoi@456' })
      .expect(200);
  });

  it('POST /auth/logout → 204 và cookie bị xoá', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: 'MatKhauMoi@456' })
      .expect(200);
    const cookie = extractCookie(login, 'rt')!;
    const res = await api()
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .expect(204);
    expect(res.headers['set-cookie'][0]).toMatch(/rt=;/);
    await api().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });
});
