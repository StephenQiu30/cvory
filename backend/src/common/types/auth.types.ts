export interface AuthenticatedUser {
  readonly userId: string;
  readonly email: string;
  readonly jti: string;
  readonly exp: number;
}

export interface JwtTokenPayload {
  readonly sub: string;
  readonly email: string;
  readonly jti: string;
  readonly type: 'access' | 'refresh';
  readonly exp?: number;
}
