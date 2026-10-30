import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppError } from '../../common/app-error';
import type { Env } from '../../config/env.schema';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import type { AccessPayload } from '../auth.types';
import { TokenRevocationService } from '../token-revocation.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<Env, true>,
    private readonly revocation: TokenRevocationService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  /**
   * Kết quả gắn vào req.user:
   * Kiểm tra token revocation và account lock (Global Ban) tức thì
   */
  async validate(payload: AccessPayload): Promise<JwtUser> {
    const status = await this.revocation.checkToken(payload.sub, payload.iat);
    if (status === 'ACCOUNT_LOCKED') {
      throw new AppError('ACCOUNT_LOCKED', HttpStatus.FORBIDDEN);
    }
    if (status === 'SESSION_REVOKED') {
      throw new AppError('SESSION_REVOKED', HttpStatus.UNAUTHORIZED);
    }
    return { id: payload.sub, email: payload.email };
  }
}
