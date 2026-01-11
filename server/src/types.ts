export interface Config {
  port: number;
  clientUrl: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;

  // Session cookie signing secret (recommended when using server sessions).
  // If not set, the server may fall back to jwtSecret.
  sessionSecret?: string;

  r2?: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicBaseUrl?: string;
    endpoint?: string;
  };
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
}

export interface JWTPayload {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    email?: string;
  }
}
