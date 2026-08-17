import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwtSecret')!,
    });
  }

  async validate(payload: JwtPayload) {
    // Kept intentionally minimal: request.user becomes { userId, email }.
    // Any per-request freshness check (e.g. "is this user's account still
    // active") belongs in a guard/interceptor downstream, not here — this
    // strategy only verifies signature + expiry.
    return { userId: payload.sub, email: payload.email };
  }
}
