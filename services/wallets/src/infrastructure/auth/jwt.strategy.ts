import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { passportJwtSecret } from "jwks-rsa";

export interface AuthenticatedPlayer {
  sub: string;
  username: string;
}

interface KeycloakJwtPayload {
  sub: string;
  preferred_username: string;
  iss: string;
  aud: string | string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: process.env.KEYCLOAK_JWKS_URI!,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer: process.env.KEYCLOAK_ISSUER,
      algorithms: ["RS256"],
    });
  }

  validate(payload: KeycloakJwtPayload): AuthenticatedPlayer {
    return {
      sub: payload.sub,
      username: payload.preferred_username,
    };
  }
}
