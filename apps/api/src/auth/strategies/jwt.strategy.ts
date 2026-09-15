import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../../config/env.schema';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import type { AccessPayload } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  /** Kết quả gắn vào req.user — chỉ những gì lấy từ token, không truy vấn DB mỗi request. */
  validate(payload: AccessPayload): JwtUser {
    return { id: payload.sub, email: payload.email };
  }
}
