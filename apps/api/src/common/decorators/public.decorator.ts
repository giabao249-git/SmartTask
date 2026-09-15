import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Bỏ qua JwtAuthGuard toàn cục cho route này (đăng ký, đăng nhập, health, xem lời mời). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
