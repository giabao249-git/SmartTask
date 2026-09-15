export interface AccessPayload {
  sub: string;
  email: string;
}

export interface RefreshPayload {
  sub: string;
  jti: string;
}

export interface AuthUserView {
  id: string;
  email: string;
  fullName: string;
  shortName: string | null;
  avatarUrl: string | null;
  timezone: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}
