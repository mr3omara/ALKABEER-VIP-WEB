export interface AppConfig {
  nodeEnv: string;
  port: number;
  appUrl: string;
  corsOrigin: string;
  databaseUrl: string;
  sessionSecret: string;
  sessionCookieName: string;
  sessionExpiresInSeconds: number;
  cookieSecure: boolean;
  seedAdminUsername?: string;
  seedAdminEmail?: string;
  seedAdminPassword?: string;
  seedAdminFullName?: string;
}

export const getConfiguration = (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.APP_PORT || '4000', 10),
  appUrl: process.env.APP_URL || 'http://localhost:4000',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  sessionSecret: process.env.SESSION_SECRET || 'development_secret_key_32_characters_minimum_len',
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'alkabeer_session',
  sessionExpiresInSeconds: parseInt(process.env.SESSION_EXPIRES_IN_SECONDS || '86400', 10),
  cookieSecure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
  seedAdminUsername: process.env.SEED_ADMIN_USERNAME,
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL,
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD,
  seedAdminFullName: process.env.SEED_ADMIN_FULLNAME,
});
